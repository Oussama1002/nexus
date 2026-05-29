<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'name',
        'supplier_code',
        'supplier_type',
        'contact_name',
        'phone',
        'phone_secondary',
        'whatsapp',
        'email',
        'address',
        'city',
        'country',
        'category',
        'products_supplied',
        'avg_lead_days',
        'min_order_amount',
        'currency',
        'payment_terms',
        'preferred_payment_mode',
        'status',
        'note',
        'quality_score',
        'frequent_delays',
        'complaints_notes',
        'ice',
        'if_number',
        'rc_number',
        'patente',
        'rib_iban',
        'contract_reference',
        'price_list_reference',
    ];

    protected $casts = [
        'avg_lead_days' => 'integer',
        'min_order_amount' => 'decimal:2',
        'quality_score' => 'decimal:2',
        'frequent_delays' => 'boolean',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }
}
