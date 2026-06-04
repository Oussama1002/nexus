<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'origin_lead_id',
        'assigned_user_id',
        'client_source',
        'full_name',
        'phone',
        'phone_secondary',
        'email',
        'city',
        'neighborhood',
        'address',
        'gender',
        'birth_date',
        'status',
        'lifecycle_status',
        'client_type',
        'interest_level',
        'delivery_city',
        'delivery_address',
        'delivery_landmark',
        'delivery_zone',
        'default_shipping_fee',
        'preferred_products',
        'preferred_variant',
        'preferred_language',
        'preferred_payment',
        'internal_notes',
        'blacklist_reason',
        'risk_score',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'default_shipping_fee' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::saving(function (Customer $c) {
            if ($c->lifecycle_status !== null && $c->lifecycle_status !== '') {
                $c->status = match ($c->lifecycle_status) {
                    'inactive' => 'inactive',
                    'blacklisted' => 'blacklisted',
                    default => 'active',
                };
            }
        });
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function originLead()
    {
        return $this->belongsTo(\App\Models\Lead::class, 'origin_lead_id');
    }

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function leads()
    {
        return $this->hasMany(Lead::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function conversations()
    {
        return $this->hasMany(Conversation::class);
    }

    public function latestConversation()
    {
        return $this->hasOne(Conversation::class)->orderByDesc('last_message_at')->orderByDesc('id');
    }
}
