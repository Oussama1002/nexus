<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DailyKpi extends Model
{
    use HasFactory;

    protected $table = 'daily_kpis';

    protected $fillable = [
        'brand_id',
        'kpi_date',
        'total_orders',
        'returned_orders',
        'shipped_orders',
        'revenue',
        'ad_spend',
        'influencer_spend',
        'total_marketing_spend',
        'new_customers',
        'cac',
        'cpa',
        'cpc',
        'cpd',
        'aov',
        'ltv',
        'churn_rate',
        'leads_count',
        'messages_count',
        'orders_confirmed',
        'orders_delivered',
        'engagement_rate',
        'reach',
        'impressions',
        'content_performance',
        'posting_consistency',
        'influencer_cost',
        'influencer_revenue',
        'influencer_roi',
        'influencer_conversion_rate',
    ];

    protected $casts = [
        'kpi_date' => 'date',
        'revenue' => 'decimal:2',
        'ad_spend' => 'decimal:2',
        'influencer_spend' => 'decimal:2',
        'total_marketing_spend' => 'decimal:2',
    ];

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }
}
