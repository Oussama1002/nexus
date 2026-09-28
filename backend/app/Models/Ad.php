<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ad extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'campaign_id',
        'ad_set_id',
        'external_ad_id',
        'name',
        'status',
        'effective_status',
        'creative_name',
        'creative_title',
        'creative_body',
        'creative_thumbnail_url',
        'creative_permalink',
        'creative_call_to_action',
        'last_synced_at',
    ];

    protected $casts = [
        'last_synced_at' => 'datetime',
    ];

    public function adSet()
    {
        return $this->belongsTo(AdSet::class);
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function metrics()
    {
        return $this->hasMany(AdMetric::class);
    }
}
