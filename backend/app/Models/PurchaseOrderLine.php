<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrderLine extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_order_id',
        'product_id',
        'sku_snapshot',
        'product_name_snapshot',
        'quantity_ordered',
        'quantity_received',
        'unit_price',
        'line_discount',
        'line_tax',
        'line_total',
    ];

    protected $casts = [
        'line_discount' => 'decimal:4',
        'line_tax' => 'decimal:4',
    ];

    protected $appends = ['quantity_remaining'];

    public function getQuantityRemainingAttribute(): int
    {
        return max(0, (int) $this->quantity_ordered - (int) $this->quantity_received);
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
