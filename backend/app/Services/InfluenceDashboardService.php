<?php

namespace App\Services;

use App\Models\Influencer;
use App\Models\InfluencerCollaboration;
use App\Models\InfluencerComplaint;
use App\Models\InfluencerPerformance;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class InfluenceDashboardService
{
    /**
     * Collaborations en cours. Les statuts du module sont en francais : la
     * version anglaise cherchee jusqu'ici n'existait dans aucune ligne, d'ou
     * un compteur toujours a zero.
     */
    private const ACTIVE_STATUSES = [
        'en_preparation', 'en_cours', 'en_revue', 'en_pause',
        'contractualisation_en_attente', 'contractualisee',
    ];

    /** Collaborations dont le montant est engage, donc comptabilisable. */
    private const COMMITTED_STATUSES = [
        'en_cours', 'en_revue', 'en_pause', 'contractualisee', 'terminee',
    ];

    /**
     * @return array<string, mixed>
     */
    public function summary(?int $brandId, ?string $dateFrom, ?string $dateTo): array
    {
        $from = $dateFrom ? Carbon::parse($dateFrom)->startOfDay() : now()->startOfMonth();
        $to = $dateTo ? Carbon::parse($dateTo)->endOfDay() : now()->endOfDay();

        $influencerCount = Influencer::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))->count();

        $activeCollabs = InfluencerCollaboration::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereIn('status', self::ACTIVE_STATUSES)->count();

        // Rattache au debut de la collaboration, pas a sa derniere
        // modification : corriger une vieille fiche la faisait basculer dans
        // la periode courante.
        $spend = (float) InfluencerCollaboration::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereIn('status', self::COMMITTED_STATUSES)
            ->where(function ($q) use ($from, $to) {
                $q->whereBetween('start_date', [$from->toDateString(), $to->toDateString()])
                    ->orWhere(fn ($w) => $w->whereNull('start_date')->whereBetween('created_at', [$from, $to]));
            })
            ->sum('agreed_amount');

        $rev = (float) InfluencerPerformance::query()
            ->when($brandId, function ($q) use ($brandId) {
                $q->whereHas('influencer', fn ($iq) => $iq->where('brand_id', $brandId)->orWhereNull('brand_id'));
            })
            ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])
            ->sum('revenue');

        $roiAgg = InfluencerPerformance::query()
            ->when($brandId, function ($q) use ($brandId) {
                $q->whereHas('influencer', fn ($iq) => $iq->where('brand_id', $brandId)->orWhereNull('brand_id'));
            })
            ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])
            ->avg('roi_percent');

        $topInfluencers = InfluencerPerformance::query()
            ->select('influencer_id', DB::raw('SUM(revenue) as total_rev'))
            ->when($brandId, function ($q) use ($brandId) {
                $q->whereHas('influencer', fn ($iq) => $iq->where('brand_id', $brandId)->orWhereNull('brand_id'));
            })
            ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])
            ->groupBy('influencer_id')
            ->orderByDesc('total_rev')
            ->limit(5)
            ->with('influencer')
            ->get();

        $openComplaints = InfluencerComplaint::query()
            ->when($brandId, function ($q) use ($brandId) {
                $q->whereHas('influencer', fn ($iq) => $iq->where('brand_id', $brandId)->orWhereNull('brand_id'));
            })
            ->whereIn('status', ['open', 'in_review', 'reopened'])->count();

        $byPlatform = Influencer::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->selectRaw('platform, COUNT(*) as c')->whereNotNull('platform')->groupBy('platform')->pluck('c', 'platform');

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'total_influencers' => $influencerCount,
            'active_collaborations' => $activeCollabs,
            'influencer_spend_period' => round($spend, 2),
            'revenue_attributed' => round($rev, 2),
            'avg_roi_percent' => $roiAgg !== null ? round((float) $roiAgg, 4) : null,
            'top_influencers' => $topInfluencers,
            'open_complaints' => $openComplaints,
            'influencers_by_platform' => $byPlatform,
        ];
    }
}
