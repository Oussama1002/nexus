<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdSet extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'campaign_id',
        'external_ad_set_id',
        'name',
        'status',
        'effective_status',
        'optimization_goal',
        'billing_event',
        'bid_strategy',
        'daily_budget',
        'lifetime_budget',
        'start_time',
        'stop_time',
        'targeting_summary',
        'last_synced_at',
    ];

    protected $casts = [
        'daily_budget' => 'decimal:2',
        'lifetime_budget' => 'decimal:2',
        'start_time' => 'datetime',
        'stop_time' => 'datetime',
        'last_synced_at' => 'datetime',
    ];

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function ads()
    {
        return $this->hasMany(Ad::class);
    }

    public function metrics()
    {
        return $this->hasMany(AdSetMetric::class);
    }
}
