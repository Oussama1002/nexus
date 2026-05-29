<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryCompany extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'contact_name',
        'phone',
        'email',
        'api_key',
        'api_url',
        'api_key_ref',
        'tracking_base_url',
        'avg_cost',
        'avg_delivery_days',
        'status',
        'notes',
    ];

    protected $casts = [
        'avg_cost' => 'decimal:2',
        'avg_delivery_days' => 'integer',
    ];

    public function shipments()
    {
        return $this->hasMany(Shipment::class);
    }

    public function payments()
    {
        return $this->hasMany(DeliveryPayment::class);
    }

    /** Prefer explicit api_url then legacy tracking_base_url. */
    public function integrationApiUrl(): ?string
    {
        return $this->api_url ?: $this->tracking_base_url;
    }

    /** Prefer api_key_ref then legacy api_key. */
    public function integrationApiKey(): ?string
    {
        return $this->api_key_ref ?: $this->api_key;
    }
}
