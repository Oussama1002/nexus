<?php

namespace App\Services;

use App\Models\CampaignMetric;

class CampaignMetricCalculator
{
    public function apply(CampaignMetric $m): void
    {
        $spend = (float) $m->spend;
        $clicks = max(0, (int) $m->clicks);
        $impr = max(0, (int) $m->impressions);
        $leads = max(0, (int) $m->leads);
        $conf = max(0, (int) $m->confirmed_orders);
        $rev = (float) $m->revenue;

        $m->cpc = $clicks > 0 ? round($spend / $clicks, 4) : null;
        $m->cpm = $impr > 0 ? round($spend / $impr * 1000, 4) : null;
        $m->cpl = $leads > 0 ? round($spend / $leads, 4) : null;
        $m->cpa = $conf > 0 ? round($spend / $conf, 4) : null;
        $m->roas = $spend > 0 ? round($rev / $spend, 4) : null;
    }
}
