<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Shipment extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'brand_id',
        'delivery_company_id',
        'delivery_payment_id',
        'tracking_number',
        'external_tracking_id',
        'status',
        'payment_status',
        'carrier_status',
        'carrier_response_json',
        'carrier_label_url',
        'carrier_last_sync_at',
        'sync_error',
        'cod_amount',
        'delivery_fee',
        'insurance_fee',
        'recipient_name',
        'recipient_phone',
        'city',
        'address',
        'recipient_city',
        'recipient_address',
        'failure_reason',
        'return_reason',
        'pickup_date',
        'shipped_at',
        'delivered_at',
        'returned_at',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'shipped_at' => 'datetime',
        'delivered_at' => 'datetime',
        'returned_at' => 'datetime',
        'carrier_last_sync_at' => 'datetime',
        'pickup_date' => 'date',
        'carrier_response_json' => 'array',
        'cod_amount' => 'decimal:2',
        'delivery_fee' => 'decimal:2',
        'insurance_fee' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::saving(function (Shipment $s) {
            if ($s->recipient_city && ! $s->city) {
                $s->city = $s->recipient_city;
            }
            if ($s->recipient_address && ! $s->address) {
                $s->address = $s->recipient_address;
            }
        });
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function deliveryCompany()
    {
        return $this->belongsTo(DeliveryCompany::class);
    }

    public function deliveryPayment()
    {
        return $this->belongsTo(DeliveryPayment::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function events()
    {
        return $this->hasMany(ShipmentEvent::class)->orderByDesc('event_at');
    }
}
