<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerContentLog extends Model
{
    use HasFactory;

    protected $table = 'influencer_content_logs';

    protected $fillable = [
        'brand_id',
        'cm_user_id',
        'influencer_id',
        'collaboration_id',
        'content_type',
        'platform',
        'content_url',
        'screenshot_url',
        'published_at',
        'is_archived',
        'notes',
        'live_duration_minutes',
        'live_viewers_count',
        'no_publication',
        'quantity',
        'archive_url',
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'is_archived' => 'boolean',
        'no_publication' => 'boolean',
        'live_duration_minutes' => 'integer',
        'live_viewers_count' => 'integer',
        'quantity' => 'integer',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function cmUser()
    {
        return $this->belongsTo(User::class, 'cm_user_id');
    }

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function collaboration()
    {
        return $this->belongsTo(InfluencerCollaboration::class);
    }
}
