<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerPerformance extends Model
{
    use HasFactory;

    protected $table = 'influencer_performance';

    protected $fillable = [
        'influencer_id',
        'influencer_collaboration_id',
        'campaign_id',
        'metric_date',
        'action_type',
        'planned_actions',
        'completed_actions',
        'manager_comment',
        'views',
        'reach',
        'impressions',
        'likes',
        'comments',
        'shares',
        'saves',
        'clicks',
        'leads',
        'orders',
        'revenue',
        'engagement_rate',
        'conversion_rate',
        'roi_percent',
    ];

    protected $casts = [
        'metric_date' => 'date',
    ];

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function collaboration()
    {
        return $this->belongsTo(InfluencerCollaboration::class, 'influencer_collaboration_id');
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }
}
