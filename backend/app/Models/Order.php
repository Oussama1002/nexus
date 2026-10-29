<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use RuntimeException;

class Order extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        // A cancelled/returned order has no cash-on-delivery to collect.
        static::saving(function (Order $order) {
            if (in_array($order->status, ['cancelled', 'returned'], true) && $order->payment_state === 'cod_pending') {
                $order->payment_state = 'unpaid';
            }
        });

        // Une commande payee (COD livre, virement verifie, paiement manuel...) genere
        // une charge de livraison. Branche ici et non dans le controleur : la synchro
        // transporteur (Ameex/Sendit) et les commandes console passent aussi par save().
        static::saved(function (Order $order) {
            self::ensureDeliveryCharge($order);
            self::ensureInvoiceLifecycle($order);
        });
    }

    /**
     * Cycle de vie de la facture, centralisé ici pour couvrir TOUS les chemins
     * (contrôleur, synchro transporteur Ameex/Sendit, console) : facture en
     * « brouillon » dès que la commande est confirmée ou au-delà, puis
     * « Validée » (approved) à la livraison.
     */
    protected static function ensureInvoiceLifecycle(Order $order): void
    {
        $confirmedOrBeyond = in_array($order->status, [
            'confirmed', 'scheduled', 'postponed', 'prepared', 'shipped', 'delivered',
        ], true);
        if (! $confirmedOrBeyond) {
            return;
        }

        $invoice = app(\App\Services\ClientInvoiceService::class)->createFromOrder($order, auth()->id());
        if (! $invoice) {
            return; // pas de client rattaché → pas de facture possible
        }

        if ($order->status === 'delivered'
            && ! in_array($invoice->status, ['approved', 'sent', 'paid', 'cancelled'], true)) {
            $invoice->status = 'approved';
            $invoice->approval_user_id = $invoice->approval_user_id ?? auth()->id();
            $invoice->approved_at = $invoice->approved_at ?? now();
            $invoice->save();
        }
    }

    protected static function ensureDeliveryCharge(Order $order): void
    {
        if ($order->payment_state !== 'paid') {
            return;
        }
        // Coût réel facturé par le transporteur (Sendit/Ameex), remonté par la
        // synchro API sur l'expédition. À défaut (pas de colis / coût non fourni
        // par l'API), on retombe sur les frais de livraison de la commande.
        $order->loadMissing('shipment');
        $cost = (float) ($order->shipment?->delivery_fee ?? 0);
        if ($cost <= 0) {
            $cost = (float) $order->shipping_fee;
        }
        if ($cost <= 0) {
            return;
        }
        $alreadyBilled = Charge::query()
            ->where('order_id', $order->id)
            ->where('type', 'delivery')
            ->exists();
        if ($alreadyBilled) {
            return;
        }
        Charge::query()->create([
            'brand_id' => $order->brand_id,
            'order_id' => $order->id,
            'created_by' => auth()->id(),
            'charge_date' => $order->delivered_at ? $order->delivered_at->toDateString() : now()->toDateString(),
            'type' => 'delivery',
            'amount' => $cost,
            'note' => 'Frais de livraison – Commande '.$order->order_number,
        ]);
    }

    protected $fillable = [
        'brand_id',
        'campaign_id',
        'customer_id',
        'lead_id',
        'assigned_user_id',
        'delivery_company_id',
        'order_number',
        'source',
        'status',
        'payment_method',
        'payment_state',
        'bank_transfer_declared_paid',
        'bank_transfer_reference',
        'bank_transfer_declared_at',
        'bank_transfer_verified_at',
        'bank_transfer_verification_status',
        'bank_transfer_verification_note',
        'subtotal',
        'shipping_fee',
        'discount',
        'total',
        'shipping_address',
        'notes',
        'follow_up_note',
        'follow_up_date',
        'follow_up_handled_at',
        'cancellation_reason',
        'confirmed_at',
        'double_confirmation_status',
        'double_confirmed_at',
        'double_confirmed_by',
        'delivered_at',
        'stock_dispatched_at',
        'archived_at',
    ];

    protected $casts = [
        'archived_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'double_confirmed_at' => 'datetime',
        'follow_up_date' => 'date',
        'follow_up_handled_at' => 'datetime',
        'delivered_at' => 'datetime',
        'stock_dispatched_at' => 'datetime',
        'bank_transfer_declared_paid' => 'boolean',
        'bank_transfer_declared_at' => 'datetime',
        'bank_transfer_verified_at' => 'datetime',
        'subtotal' => 'decimal:2',
        'shipping_fee' => 'decimal:2',
        'discount' => 'decimal:2',
        'total' => 'decimal:2',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function lead()
    {
        return $this->belongsTo(Lead::class);
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function lines()
    {
        return $this->hasMany(OrderLine::class);
    }

    public function shipment()
    {
        return $this->hasOne(Shipment::class);
    }

    public function events()
    {
        return $this->hasMany(OrderEvent::class);
    }

    public function clientInvoice()
    {
        return $this->hasOne(ClientInvoice::class);
    }

    public static function generateUniqueOrderNumber(Brand|int|null $brand = null): string
    {
        $prefix = self::resolveOrderPrefix($brand);
        for ($i = 0; $i < 12; $i++) {
            $candidate = $prefix.'-'.now()->format('ymd').'-'.strtoupper(Str::random(5));
            if (! static::query()->where('order_number', $candidate)->exists()) {
                return $candidate;
            }
        }

        throw new RuntimeException('Could not generate unique order number.');
    }

    /**
     * Order-number prefix = brand code (uppercase), fallback to "NX" when
     * the brand or its code isn't set. The facture and every reference we
     * ship to the customer key off this — MED-260928-A09XB reads far more
     * like "Medicaldine" than the old NX-… prefix.
     */
    private static function resolveOrderPrefix(Brand|int|null $brand): string
    {
        if ($brand instanceof Brand) {
            $code = trim((string) ($brand->code ?? ''));
        } elseif (is_int($brand) || (is_string($brand) && ctype_digit($brand))) {
            $code = trim((string) (Brand::query()->whereKey($brand)->value('code') ?? ''));
        } else {
            $code = '';
        }
        return $code !== '' ? strtoupper($code) : 'NX';
    }
}
