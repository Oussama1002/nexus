<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InfluencerCollaboration extends Model
{
    use HasFactory;

    protected $fillable = [
        'influencer_id',
        'brand_id',
        'campaign_id',
        'owner_user_id',
        'title',
        'description',
        'objectives',
        'collaboration_type',
        'status',
        'deliverables',
        'contract_url',
        'brief_url',
        'agreed_amount',
        'currency',
        'start_date',
        'end_date',
        'v1_status',
        'v1_requested_by',
        'v1_requested_at',
        'v1_decided_by',
        'v1_decided_at',
        'v1_comment',
        'v2_status',
        'v2_requested_by',
        'v2_requested_at',
        'v2_decided_by',
        'v2_decided_at',
        'v2_comment',
        'v4_status',
        'v4_requested_by',
        'v4_requested_at',
        'v4_decided_by',
        'v4_decided_at',
        'v4_comment',
        'onboarding_notes',
        'review_notes',
        'review_rating',
        'reviewed_at',
        'reviewed_by',
        'pause_reason',
        'stop_reason',
        'refuse_reason',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'v1_requested_at' => 'datetime',
        'v1_decided_at' => 'datetime',
        'v2_requested_at' => 'datetime',
        'v2_decided_at' => 'datetime',
        'v4_requested_at' => 'datetime',
        'v4_decided_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function v1RequestedByUser()
    {
        return $this->belongsTo(User::class, 'v1_requested_by');
    }

    public function v1DecidedByUser()
    {
        return $this->belongsTo(User::class, 'v1_decided_by');
    }

    public function v2DecidedByUser()
    {
        return $this->belongsTo(User::class, 'v2_decided_by');
    }

    public function v4DecidedByUser()
    {
        return $this->belongsTo(User::class, 'v4_decided_by');
    }

    public function reviewedByUser()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function performance()
    {
        return $this->hasMany(InfluencerPerformance::class, 'influencer_collaboration_id');
    }

    public function deliverableItems()
    {
        return $this->hasMany(InfluencerDeliverable::class, 'collaboration_id');
    }

    public function publishedContents()
    {
        return $this->hasMany(InfluencerPublishedContent::class, 'collaboration_id');
    }

    public function shipments()
    {
        return $this->hasMany(InfluencerShipment::class, 'collaboration_id');
    }

    public function payments()
    {
        return $this->hasMany(InfluencerPayment::class, 'collaboration_id');
    }

    public function documents()
    {
        return $this->hasMany(InfluencerDocument::class, 'collaboration_id');
    }
}
