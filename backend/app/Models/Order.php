<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use RuntimeException;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'campaign_id',
        'customer_id',
        'lead_id',
        'assigned_user_id',
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
        'confirmed_at',
        'delivered_at',
        'stock_dispatched_at',
    ];

    protected $casts = [
        'confirmed_at' => 'datetime',
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

    public static function generateUniqueOrderNumber(): string
    {
        for ($i = 0; $i < 12; $i++) {
            $candidate = 'NX-'.now()->format('ymd').'-'.strtoupper(Str::random(5));
            if (! static::query()->where('order_number', $candidate)->exists()) {
                return $candidate;
            }
        }

        throw new RuntimeException('Could not generate unique order number.');
    }
}
