<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerShipment extends Model
{
    use HasFactory;

    protected $fillable = [
        'collaboration_id',
        'influencer_id',
        'brand_id',
        'created_by',
        'reference',
        'status',
        'products_json',
        'shipping_company',
        'tracking_number',
        'tracking_url',
        'shipped_at',
        'estimated_delivery',
        'received_at',
        'delivery_address',
        'notes',
    ];

    protected $casts = [
        'products_json' => 'array',
        'shipped_at' => 'date',
        'estimated_delivery' => 'date',
        'received_at' => 'date',
    ];

    public function collaboration()
    {
        return $this->belongsTo(InfluencerCollaboration::class, 'collaboration_id');
    }

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
