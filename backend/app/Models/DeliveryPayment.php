<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryPayment extends Model
{
    use HasFactory;

    protected $fillable = [
        'delivery_company_id',
        'brand_id',
        'reference',
        'label',
        'amount',
        'state',
        'period_start',
        'period_end',
        'payment_date',
        'reconciled_at',
        'note',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'period_start' => 'date',
        'period_end' => 'date',
        'reconciled_at' => 'datetime',
    ];

    public function deliveryCompany()
    {
        return $this->belongsTo(DeliveryCompany::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function shipments()
    {
        return $this->belongsToMany(Shipment::class, 'delivery_payment_shipment')
            ->withPivot('cod_amount')
            ->withTimestamps();
    }
}
