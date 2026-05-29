<?php

namespace App\Services;

use App\Models\CmDailyTracking;
use App\Models\ContentCalendar;
use App\Models\ContentProduction;
use App\Models\SocialPublication;
use App\Models\User;
use Carbon\Carbon;

class SocialDashboardService
{
    /**
     * Synthèse dashboard Social & contenu (filtres marque / période / plateforme / CM).
     *
     * @return array<string, mixed>
     */
    public function summary(
        ?int $brandId,
        ?string $dateFrom,
        ?string $dateTo,
        ?string $platform = null,
        ?int $assignedUserId = null,
    ): array {
        $from = $dateFrom ? Carbon::parse($dateFrom)->startOfDay() : now()->startOfMonth();
        $to = $dateTo ? Carbon::parse($dateTo)->endOfDay() : now()->endOfDay();

        $calScoped = ContentCalendar::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($assignedUserId, fn ($q) => $q->where('assigned_to', $assignedUserId))
            ->when($platform, function ($q) use ($platform) {
                $q->whereHas('socialAccount', fn ($s) => $s->where('platform', $platform));
            });

        $calBase = (clone $calScoped)->whereBetween('planned_at', [$from, $to]);

        $plannedTotal = (clone $calBase)->whereIn('status', ['draft', 'planned', 'in_production'])->count();
        $publishedTotal = (clone $calBase)->where('status', 'published')->count();
        $pendingValidation = (clone $calScoped)->where('status', 'review')->count();

        $byStatus = (clone $calScoped)
            ->whereBetween('planned_at', [$from, $to])
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        $prodScoped = ContentProduction::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($assignedUserId, fn ($q) => $q->where('owner_user_id', $assignedUserId));

        $productionInProgress = (clone $prodScoped)
            ->whereBetween('created_at', [$from, $to])
            ->whereIn('status', ['todo', 'in_progress', 'submitted'])
            ->count();

        $postsDone = (clone $calBase)->where('content_type', 'post')->where('status', 'published')->count();
        $storiesDone = (clone $calBase)->where('content_type', 'story')->where('status', 'published')->count();
        $livesDone = (clone $calBase)->where('content_type', 'live')->where('status', 'published')->count();

        $cmScoped = CmDailyTracking::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($assignedUserId, fn ($q) => $q->where('cm_user_id', $assignedUserId));

        $avgCompletion = (float) (clone $cmScoped)
            ->whereBetween('work_date', [$from->toDateString(), $to->toDateString()])
            ->avg('completion_percentage') ?: 0;

        $weeklyPerformance = [];
        for ($i = 6; $i >= 0; $i--) {
            $dayStart = $to->copy()->subDays($i)->startOfDay();
            $dayEnd = $to->copy()->subDays($i)->endOfDay();
            $weeklyPerformance[] = [
                'date' => $dayStart->toDateString(),
                'published' => (int) (clone $calScoped)
                    ->where('status', 'published')
                    ->whereBetween('planned_at', [$dayStart, $dayEnd])
                    ->count(),
            ];
        }

        $publicationsByPlatform = ContentCalendar::query()
            ->when($brandId, fn ($q) => $q->where('content_calendar.brand_id', $brandId))
            ->when($assignedUserId, fn ($q) => $q->where('content_calendar.assigned_to', $assignedUserId))
            ->where('content_calendar.status', 'published')
            ->whereBetween('content_calendar.planned_at', [$from, $to])
            ->whereNotNull('content_calendar.social_account_id')
            ->join('social_accounts', 'content_calendar.social_account_id', '=', 'social_accounts.id')
            ->when($platform, fn ($q) => $q->where('social_accounts.platform', $platform))
            ->groupBy('social_accounts.platform')
            ->selectRaw('social_accounts.platform as platform, COUNT(*) as c')
            ->pluck('c', 'platform');

        $cmRows = CmDailyTracking::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($assignedUserId, fn ($q) => $q->where('cm_user_id', $assignedUserId))
            ->whereBetween('work_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('
                cm_user_id,
                AVG(completion_percentage) as avg_completion,
                SUM(posts_done) as posts_sum,
                SUM(stories_done) as stories_sum,
                SUM(lives_done) as lives_sum
            ')
            ->groupBy('cm_user_id')
            ->get();

        $cmActivity = $cmRows->map(function ($r) {
            $u = User::query()->find($r->cm_user_id);

            return [
                'cm_user_id' => $r->cm_user_id,
                'cm_name' => $u?->name,
                'avg_completion' => round((float) $r->avg_completion, 2),
                'posts' => (int) $r->posts_sum,
                'stories' => (int) $r->stories_sum,
                'lives' => (int) $r->lives_sum,
            ];
        });

        $pubBase = SocialPublication::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($platform, fn ($q) => $q->where('platform', $platform))
            ->whereBetween('published_at', [$from, $to]);

        $reachTotal = (int) (clone $pubBase)->sum('reach');
        $likes = (int) (clone $pubBase)->sum('likes');
        $comments = (int) (clone $pubBase)->sum('comments');
        $shares = (int) (clone $pubBase)->sum('shares');

        $approvedCount = (clone $calScoped)->whereBetween('planned_at', [$from, $to])->where('status', 'approved')->count();
        $publishedCountAll = (clone $calScoped)->whereBetween('planned_at', [$from, $to])->where('status', 'published')->count();
        $validationRate = ($approvedCount + $publishedCountAll) > 0
            ? round(100 * $publishedCountAll / max(1, $approvedCount + $publishedCountAll), 1)
            : 0.0;

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'filters' => [
                'platform' => $platform,
                'assigned_user_id' => $assignedUserId,
            ],
            'kpis' => [
                'contenus_planifies' => $plannedTotal,
                'contenus_publies' => $publishedTotal,
                'contenus_attente_validation' => $pendingValidation,
                'stories_publiees' => $storiesDone,
                'posts_publies' => $postsDone,
                'lives_realises' => $livesDone,
                'tournages_en_cours' => $productionInProgress,
                'taux_completion_cm_pct' => round($avgCompletion, 2),
                'performance_contenu_score' => round(min(100, $avgCompletion + ($publishedTotal > 0 ? 20 : 0)), 1),
                'reach_total' => $reachTotal,
                'engagement_total' => $likes + $comments + $shares,
                'taux_validation_pct' => $validationRate,
            ],
            'charts' => [
                'contenus_par_statut' => $byStatus,
                'publications_par_plateforme' => $publicationsByPlatform,
                'performance_hebdomadaire' => $weeklyPerformance,
                'activite_cm' => $cmActivity,
            ],
            'planned_content' => $plannedTotal,
            'published_content' => $publishedTotal,
            'pending_approvals' => $pendingValidation,
            'content_by_status' => $byStatus,
            'production_tasks_open' => $productionInProgress,
            'posts_published' => $postsDone,
            'stories_published' => $storiesDone,
            'lives_published' => $livesDone,
            'cm_completion_rate_avg' => round($avgCompletion, 2),
        ];
    }
}
