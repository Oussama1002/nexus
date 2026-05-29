<?php

namespace App\Services;

use App\Models\InfluencerCollaboration;
use App\Models\InfluencerPerformance;

class InfluencerPerformanceCalculator
{
    /**
     * @param  array<string, mixed>  $attrs
     * @return array<string, mixed>
     */
    public static function computeRatios(InfluencerPerformance $metric, ?InfluencerCollaboration $collaboration, array $attrs = []): array
    {
        $reach = (int) ($attrs['reach'] ?? $metric->reach ?? 0);
        $likes = (int) ($attrs['likes'] ?? $metric->likes ?? 0);
        $comments = (int) ($attrs['comments'] ?? $metric->comments ?? 0);
        $shares = (int) ($attrs['shares'] ?? $metric->shares ?? 0);
        $saves = (int) ($attrs['saves'] ?? $metric->saves ?? 0);
        $clicks = (int) ($attrs['clicks'] ?? $metric->clicks ?? 0);
        $orders = (int) ($attrs['orders'] ?? $metric->orders ?? 0);
        $revenue = (float) ($attrs['revenue'] ?? $metric->revenue ?? 0);

        $engagementSum = $likes + $comments + $shares + $saves;
        $engagementRate = $reach > 0 ? round($engagementSum / $reach * 100, 4) : null;
        $conversionRate = $clicks > 0 ? round($orders / $clicks * 100, 4) : null;

        $agreed = (float) ($collaboration?->agreed_amount ?? 0);
        $roiPercent = $agreed > 0 ? round(($revenue - $agreed) / $agreed * 100, 4) : null;

        return [
            'engagement_rate' => $engagementRate,
            'conversion_rate' => $conversionRate,
            'roi_percent' => $roiPercent,
        ];
    }
}
