<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerPublishedContent extends Model
{
    use HasFactory;

    protected $fillable = [
        'deliverable_id',
        'collaboration_id',
        'influencer_id',
        'brand_id',
        'recorded_by',
        'content_type',
        'platform',
        'content_url',
        'screenshot_url',
        'published_at',
        'quantity',
        'is_archived',
        'archive_url',
        'no_publication',
        'no_publication_reason',
        'live_duration_minutes',
        'live_viewers_count',
        'views',
        'reach',
        'impressions',
        'likes',
        'comments_count',
        'shares',
        'saves',
        'clicks',
        'notes',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'is_archived' => 'boolean',
        'no_publication' => 'boolean',
    ];

    public function deliverable()
    {
        return $this->belongsTo(InfluencerDeliverable::class, 'deliverable_id');
    }

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

    public function recordedByUser()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
