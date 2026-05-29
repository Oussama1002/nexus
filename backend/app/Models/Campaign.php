<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Campaign extends Model
{
    use HasFactory;

    protected $fillable = [
        'brand_id',
        'ad_account_id',
        'product_id',
        'name',
        'source',
        'external_campaign_id',
        'last_synced_at',
        'marketing_objective',
        'budget',
        'daily_budget',
        'campaign_currency',
        'attribution_model',
        'spend',
        'status',
        'start_date',
        'end_date',
        'notes',
        'objective',
        'description',
        'creatives_summary',
        'landing_url',
        'confirmatrice_user_id',
        'influencer_id',
        'utm_source',
        'utm_campaign',
        'utm_medium',
        'pixel_id',
        'target_cac',
        'target_cpa',
        'target_roas',
        'target_leads',
    ];

    protected $casts = [
        'last_synced_at' => 'datetime',
        'start_date' => 'date',
        'end_date' => 'date',
        'budget' => 'decimal:2',
        'daily_budget' => 'decimal:2',
        'spend' => 'decimal:2',
        'target_cac' => 'decimal:4',
        'target_cpa' => 'decimal:4',
        'target_roas' => 'decimal:4',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function adAccount()
    {
        return $this->belongsTo(AdAccount::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function confirmatrice()
    {
        return $this->belongsTo(User::class, 'confirmatrice_user_id');
    }

    public function influencer()
    {
        return $this->belongsTo(Influencer::class);
    }

    public function metrics()
    {
        return $this->hasMany(CampaignMetric::class);
    }

    public function leads()
    {
        return $this->hasMany(Lead::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function influencerCollaborations()
    {
        return $this->hasMany(InfluencerCollaboration::class);
    }
}
