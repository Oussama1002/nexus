<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CampaignMetric extends Model
{
    use HasFactory;

    protected $fillable = [
        'campaign_id',
        'metric_date',
        'reach',
        'messages',
        'spend',
        'impressions',
        'clicks',
        'leads',
        'confirmed_orders',
        'delivered_orders',
        'revenue',
        'cpc',
        'cpm',
        'cpl',
        'cpa',
        'roas',
    ];

    protected $casts = [
        'metric_date' => 'date',
        'spend' => 'decimal:2',
        'revenue' => 'decimal:2',
        'cpc' => 'decimal:4',
        'cpm' => 'decimal:4',
        'cpl' => 'decimal:4',
        'cpa' => 'decimal:4',
        'roas' => 'decimal:4',
    ];

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }
}
