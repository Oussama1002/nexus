<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SmmContentPerformance extends Model
{
    use HasFactory;

    protected $table = 'smm_content_performances';

    protected $fillable = [
        'brand_id', 'content_id', 'platform', 'last_synced_at',
        'reach', 'impressions', 'views', 'engagement_rate',
        'shares', 'saves', 'comments_count',
        'profile_visits', 'followers_gained',
        'clicks', 'conversions',
        'sync_failed', 'sync_error',
    ];

    protected $casts = [
        'last_synced_at' => 'datetime',
        'engagement_rate' => 'decimal:3',
        'sync_failed' => 'boolean',
    ];

    public function brand() { return $this->belongsTo(Brand::class); }
    public function content() { return $this->belongsTo(SmmContent::class, 'content_id'); }
}
