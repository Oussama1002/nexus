<?php

namespace App\Services;

use App\Models\Charge;
use Carbon\Carbon;

class FinanceSummaryService
{
    /**
     * @param  array<string, mixed>|null  $filters  date_from, date_to, brand_id
     * @return array<string, mixed>
     */
    public function summary(?int $brandId, ?string $dateFrom, ?string $dateTo): array
    {
        $from = $dateFrom ? Carbon::parse($dateFrom)->startOfDay() : now()->startOfMonth();
        $to = $dateTo ? Carbon::parse($dateTo)->endOfDay() : now()->endOfDay();

        $base = Charge::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('charge_date', [$from->toDateString(), $to->toDateString()]);

        $total = (float) (clone $base)->sum('amount');

        $byType = (clone $base)->selectRaw('type, SUM(amount) as total')->groupBy('type')->pluck('total', 'type');

        $byBrand = Charge::query()
            ->whereBetween('charge_date', [$from->toDateString(), $to->toDateString()])
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->selectRaw('COALESCE(brand_id, 0) as bid, SUM(amount) as total')
            ->groupBy('bid')
            ->pluck('total', 'bid');

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'total_charges' => round($total, 2),
            'charges_by_type' => $byType->map(fn ($v) => round((float) $v, 2)),
            'charges_by_brand_id' => $byBrand->map(fn ($v) => round((float) $v, 2)),
            'influencer_spend' => round((float) ($byType['influencer'] ?? 0), 2),
            'ad_spend' => round((float) ($byType['ads'] ?? 0), 2),
            'delivery_spend' => round((float) ($byType['delivery'] ?? 0), 2),
            'supplier_spend' => round((float) ($byType['supplier'] ?? 0), 2),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function chargesByType(?int $brandId, ?string $dateFrom, ?string $dateTo): array
    {
        return $this->summary($brandId, $dateFrom, $dateTo)['charges_by_type']->toArray();
    }

    /**
     * Monthly totals for charts.
     *
     * @return array<int, array<string, mixed>>
     */
    public function monthly(?int $brandId, ?string $dateFrom, ?string $dateTo): array
    {
        $from = $dateFrom ? Carbon::parse($dateFrom)->startOfMonth() : now()->subMonths(11)->startOfMonth();
        $to = $dateTo ? Carbon::parse($dateTo)->endOfMonth() : now()->endOfMonth();

        $charges = Charge::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('charge_date', [$from->toDateString(), $to->toDateString()])
            ->get(['charge_date', 'amount']);

        return $charges
            ->groupBy(fn ($c) => Carbon::parse($c->charge_date)->format('Y-m'))
            ->map(fn ($group, $ym) => [
                'month' => $ym,
                'total' => round((float) $group->sum('amount'), 2),
            ])
            ->sortKeys()
            ->values()
            ->all();
    }
}
