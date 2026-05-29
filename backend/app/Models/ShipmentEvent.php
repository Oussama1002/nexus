<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShipmentEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_id',
        'actor_user_id',
        'event_type',
        'status',
        'note',
        'location',
        'description',
        'raw_payload_json',
        'event_at',
    ];

    protected $casts = [
        'event_at' => 'datetime',
        'raw_payload_json' => 'array',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
