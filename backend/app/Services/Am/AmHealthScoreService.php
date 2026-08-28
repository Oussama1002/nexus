<?php

namespace App\Services\Am;

use App\Models\AmBrandEconomics;
use App\Models\AmHealthScoreConfig;
use App\Models\AmRoadmap;
use Carbon\CarbonImmutable;

/**
 * Composite Brand Health Score (spec §14).
 * 4 weighted components: economics, conversion, execution, risk.
 * LTV window = 180 days per §25 answer #2.
 */
class AmHealthScoreService
{
    public const LTV_WINDOW_DAYS = 180;

    public function computeForBrand(int $brandId): array
    {
        $cfg = $this->configForBrand($brandId);
        $weights = $cfg['weights'];

        $components = [
            'economics' => $this->scoreEconomics($brandId),
            'conversion' => $this->scoreConversion($brandId),
            'execution' => $this->scoreExecution($brandId),
            'risk' => $this->scoreRisk($brandId),
        ];

        $composite = 0.0;
        $wSum = 0.0;
        foreach ($weights as $key => $w) {
            if (! isset($components[$key])) continue;
            $composite += ($components[$key] * (float) $w);
            $wSum += (float) $w;
        }
        $composite = $wSum > 0 ? round($composite / $wSum, 2) : 0.0;

        return [
            'brand_id' => $brandId,
            'composite' => $composite,
            'components' => $components,
            'weights' => $weights,
            'ltv_window_days' => self::LTV_WINDOW_DAYS,
            'computed_at' => now()->toIso8601String(),
        ];
    }

    private function scoreEconomics(int $brandId): float
    {
        $eco = AmBrandEconomics::query()->where('brand_id', $brandId)->whereNull('product_id')->first()
            ?: AmBrandEconomics::query()->where('brand_id', $brandId)->first();
        if (! $eco) return 0.0;

        $marginOk = ($eco->gross_margin !== null && $eco->gross_margin_target > 0)
            ? min(1.0, (float) $eco->gross_margin / (float) $eco->gross_margin_target) : 0.0;
        $ratioOk = ($eco->ltv_cac_ratio !== null && (float) $eco->ltv_cac_threshold > 0)
            ? min(1.0, (float) $eco->ltv_cac_ratio / (float) $eco->ltv_cac_threshold) : 0.0;
        return round((($marginOk + $ratioOk) / 2) * 100, 2);
    }

    private function scoreConversion(int $brandId): float
    {
        // Placeholder — will read from Media Buying + SMM performance when wired in Phase 4.
        return 60.0;
    }

    private function scoreExecution(int $brandId): float
    {
        $roadmap = AmRoadmap::query()->where('brand_id', $brandId)->whereIn('status', ['en_cours', 'suspendue'])->first();
        if (! $roadmap) return 0.0;

        $gates = $roadmap->gates()->get();
        if ($gates->isEmpty()) return 0.0;
        $passed = $gates->whereIn('status', ['franchie', 'franchie_par_derogation'])->count();
        return round(($passed / max(1, $gates->count())) * 100, 2);
    }

    private function scoreRisk(int $brandId): float
    {
        $openAlerts = \App\Models\AmAlert::query()
            ->where('brand_id', $brandId)
            ->whereIn('status', ['ouverte', 'escaladee'])
            ->count();
        // 0 alerts = 100. Each open alert costs 10, floor at 0.
        return (float) max(0, 100 - ($openAlerts * 10));
    }

    private function configForBrand(int $brandId): array
    {
        $cfg = AmHealthScoreConfig::query()
            ->where(function ($q) use ($brandId) { $q->where('brand_id', $brandId)->orWhereNull('brand_id'); })
            ->where('is_active', true)
            ->orderByDesc('brand_id')
            ->first();

        return [
            'weights' => $cfg?->weights_json ?? [
                'economics' => 0.40,
                'conversion' => 0.25,
                'execution' => 0.20,
                'risk' => 0.15,
            ],
        ];
    }
}
