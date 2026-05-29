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
        'collaboration_type',
        'status',
        'deliverables',
        'contract_url',
        'agreed_amount',
        'start_date',
        'end_date',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
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

    public function performance()
    {
        return $this->hasMany(InfluencerPerformance::class, 'influencer_collaboration_id');
    }
}
