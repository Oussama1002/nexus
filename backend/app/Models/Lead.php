<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lead extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'campaign_id',
        'customer_id',
        'assigned_user_id',
        'source',
        'status',
        'estimated_value',
        'product_interest',
        'interest_level',
        'notes',
        'first_contact_at',
        'closed_at',
    ];

    protected $casts = [
        'first_contact_at' => 'datetime',
        'closed_at' => 'datetime',
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

    public function assignedUser()
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function events()
    {
        return $this->hasMany(LeadEvent::class);
    }

    public function conversation()
    {
        return $this->hasOne(Conversation::class);
    }
}
