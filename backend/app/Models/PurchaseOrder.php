<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'supplier_id',
        'created_by',
        'responsible_user_id',
        'reference',
        'status',
        'payment_status',
        'currency',
        'subtotal',
        'discount',
        'tax',
        'total_amount',
        'paid_amount',
        'remaining_amount',
        'payment_method',
        'payment_due_date',
        'shipping_mode',
        'carrier_name',
        'tracking_number',
        'shipping_fee',
        'warehouse_destination',
        'supplier_conditions',
        'attachments_json',
        'supplier_invoice_ref',
        'delivery_note_ref',
        'ordered_at',
        'expected_delivery_date',
        'received_at',
        'internal_notes',
    ];

    protected $casts = [
        'ordered_at' => 'date',
        'expected_delivery_date' => 'date',
        'payment_due_date' => 'date',
        'received_at' => 'datetime',
        'attachments_json' => 'array',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function responsibleUser()
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function lines()
    {
        return $this->hasMany(PurchaseOrderLine::class);
    }

    public function syncPaymentAmounts(): void
    {
        $total = (float) $this->total_amount;
        $paid = (float) $this->paid_amount;
        $this->remaining_amount = round(max(0, $total - $paid), 2);

        if (in_array($this->payment_status, ['refunded', 'cancelled'], true)) {
            return;
        }

        if ($paid <= 0) {
            $this->payment_status = 'unpaid';
        } elseif ($paid >= $total && $total > 0) {
            $this->payment_status = 'paid';
        } elseif ($paid > 0 && $paid < $total) {
            $this->payment_status = 'partial';
        }
    }
}
