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
    ];

    protected $casts = [
        'published_at' => 'datetime',
        'is_archived' => 'boolean',
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
