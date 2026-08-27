<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmAutomation;
use App\Models\SmmContent;
use App\Models\SmmContentPerformance;
use App\Models\SmmEvent;
use App\Models\SmmExecutionCheck;
use App\Models\SmmMonthlyPlan;
use App\Models\SmmMonthlyReport;
use App\Models\SmmStrategy;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmDashboardController extends Controller
{
    /**
     * Manager OPS dashboard (spec §12.2).
     * Six blocks: Stratégie, Validations en attente, Retards, Charge,
     * Événements, Réclamations, Rapports.
     */
    public function managerOps(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $scoped = fn ($q) => $brandId !== null ? $q->where('brand_id', $brandId) : $q;

        $currentQuarter = (int) ceil((int) now()->format('n') / 3);
        $currentYear = (int) now()->format('Y');
        $nextQuarter = $currentQuarter === 4 ? 1 : $currentQuarter + 1;
        $nextYear = $currentQuarter === 4 ? $currentYear + 1 : $currentYear;

        // ─── Stratégie ───
        $strategyCurrent = $scoped(\App\Models\SmmStrategy::query())
            ->where('year', $currentYear)->where('quarter', $currentQuarter)->first();
        $strategyNext = $scoped(\App\Models\SmmStrategy::query())
            ->where('year', $nextYear)->where('quarter', $nextQuarter)->first();
        $contributionsPending = $scoped(\App\Models\SmmStrategy::query())
            ->where('status', 'brouillon')
            ->withCount(['contributions as pending_count' => fn ($q) => $q->whereNull('received_at')])
            ->get()
            ->sum('pending_count');

        // ─── Validations en attente ───
        $pendingPlans = $scoped(\App\Models\SmmMonthlyPlan::query())->where('status', 'soumis')->count();
        $pendingEvents = $scoped(\App\Models\SmmEvent::query())->where('status', 'retroplanning_a_valider')->count();
        $pendingStrategies = $scoped(\App\Models\SmmStrategy::query())->where('status', 'soumise')->count();

        // ─── Retards ───
        $lateContents = $scoped(\App\Models\SmmContent::query())
            ->whereNotIn('status', ['publie', 'annule', 'non_publie'])
            ->whereNotNull('production_due_at')
            ->where('production_due_at', '<', now())
            ->count();
        $unsubmittedPlans = $scoped(\App\Models\SmmMonthlyPlan::query())
            ->where('status', 'brouillon')
            ->where('year', (int) now()->addMonth()->format('Y'))
            ->where('month', (int) now()->addMonth()->format('m'))
            ->count();

        // ─── Charge : planned vs declared capacity for the current month ───
        $currentPlan = $scoped(\App\Models\SmmMonthlyPlan::query())
            ->where('year', $currentYear)->where('month', (int) now()->format('m'))->first();
        $plannedVolume = 0;
        if ($currentPlan && is_array($currentPlan->volume_by_platform_json)) {
            $plannedVolume = array_sum(array_map('intval', $currentPlan->volume_by_platform_json));
        }
        $declaredCapacity = (int) ($currentPlan->declared_capacity ?? 0);

        // ─── Événements — rétroplannings à valider, jalons non tenus ───
        $eventsToValidate = $scoped(\App\Models\SmmEvent::query())
            ->where('status', 'retroplanning_a_valider')->count();
        $eventsRunningLate = $scoped(\App\Models\SmmEvent::query())
            ->whereIn('status', ['en_preparation', 'en_cours'])
            ->whereBetween('start_date', [now()->toDateString(), now()->addDays(14)->toDateString()])
            ->get()
            ->filter(function ($e) {
                if (! is_array($e->milestones_json)) return false;
                foreach ($e->milestones_json as $m) {
                    if (empty($m['done']) && !empty($m['date']) && strtotime((string) $m['date']) < time()) {
                        return true;
                    }
                }
                return false;
            })
            ->count();

        // ─── Réclamations (via Complaint table if present, else influencer complaints) ───
        $complaintsFromSocial = 0;
        $complaintsMotives = [];
        if (class_exists(\App\Models\Complaint::class) && \Illuminate\Support\Facades\Schema::hasTable('complaints')) {
            $q = \App\Models\Complaint::query()
                ->where('created_at', '>=', now()->subDays(30))
                ->whereIn('channel', ['instagram', 'facebook', 'tiktok']);
            if ($brandId !== null) $q->where('brand_id', $brandId);
            $complaintsFromSocial = (clone $q)->count();
            $complaintsMotives = (clone $q)
                ->selectRaw('category, COUNT(*) as c')
                ->groupBy('category')
                ->pluck('c', 'category');
        }

        // ─── Rapports mensuels diffusés (12 derniers mois) ───
        $reportsDiffusedLast12 = $scoped(\App\Models\SmmMonthlyReport::query())
            ->where('status', 'diffuse')
            ->where('diffused_at', '>=', now()->subMonths(12))
            ->count();

        return ApiResponse::success([
            'strategy' => [
                'current' => $strategyCurrent ? [
                    'id' => $strategyCurrent->id,
                    'year' => $strategyCurrent->year,
                    'quarter' => $strategyCurrent->quarter,
                    'status' => $strategyCurrent->status,
                ] : null,
                'next' => $strategyNext ? [
                    'id' => $strategyNext->id,
                    'year' => $strategyNext->year,
                    'quarter' => $strategyNext->quarter,
                    'status' => $strategyNext->status,
                ] : ['needs_preparation' => true],
                'contributions_pending' => (int) $contributionsPending,
            ],
            'pending_validations' => [
                'strategies' => $pendingStrategies,
                'plans' => $pendingPlans,
                'events_retroplanning' => $pendingEvents,
            ],
            'delays' => [
                'late_contents' => $lateContents,
                'unsubmitted_next_month_plan' => $unsubmittedPlans,
            ],
            'load' => [
                'planned_volume' => $plannedVolume,
                'declared_capacity' => $declaredCapacity,
                'overload' => $declaredCapacity > 0 && $plannedVolume > $declaredCapacity,
            ],
            'events' => [
                'to_validate' => $eventsToValidate,
                'milestones_missed' => $eventsRunningLate,
            ],
            'complaints_from_social' => [
                'total_30d' => $complaintsFromSocial,
                'by_category' => $complaintsMotives,
            ],
            'reports' => [
                'diffused_last_12_months' => $reportsDiffusedLast12,
            ],
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $scoped = fn ($q) => $brandId !== null ? $q->where('brand_id', $brandId) : $q;

        $today = now()->toDateString();
        $tomorrow = now()->addDay()->toDateString();

        $todayContents = $scoped(SmmContent::query())
            ->whereBetween('scheduled_publish_at', [$today . ' 00:00:00', $today . ' 23:59:59'])
            ->count();

        $inProduction = $scoped(SmmContent::query())
            ->whereIn('status', ['a_briefer', 'briefe', 'en_production', 'en_revision'])
            ->count();

        $lateContents = $scoped(SmmContent::query())
            ->whereNotIn('status', ['publie', 'annule', 'non_publie'])
            ->whereNotNull('scheduled_publish_at')
            ->where('scheduled_publish_at', '<', now())
            ->count();

        $pendingValidationDirection = $scoped(SmmContent::query())
            ->where('status', 'a_valider_direction')
            ->count();

        $pendingPlans = $scoped(SmmMonthlyPlan::query())
            ->where('status', 'soumis')
            ->count();

        $pendingStrategies = $scoped(SmmStrategy::query())
            ->where('status', 'soumise')
            ->count();

        $todayDeviations = $scoped(SmmExecutionCheck::query())
            ->where('check_date', $today)
            ->where('status', 'ecart_constate')
            ->count();

        $upcomingEvents = $scoped(SmmEvent::query())
            ->whereBetween('start_date', [$today, now()->addDays(30)->toDateString()])
            ->whereNotIn('status', ['termine', 'annule'])
            ->count();

        $activeAutomations = $scoped(SmmAutomation::query())
            ->where('status', 'active')
            ->count();

        $syncFailures = $scoped(SmmContentPerformance::query())
            ->where('sync_failed', true)
            ->count();

        // Contents by status for pipeline chart
        $byStatus = $scoped(SmmContent::query())
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // Next monthly report status
        $currentReport = $scoped(SmmMonthlyReport::query())
            ->where('year', (int) now()->format('Y'))
            ->where('month', (int) now()->format('m'))
            ->first();

        return ApiResponse::success([
            'today_contents' => $todayContents,
            'in_production' => $inProduction,
            'late_contents' => $lateContents,
            'pending_validation_direction' => $pendingValidationDirection,
            'pending_plans' => $pendingPlans,
            'pending_strategies' => $pendingStrategies,
            'today_deviations' => $todayDeviations,
            'upcoming_events' => $upcomingEvents,
            'active_automations' => $activeAutomations,
            'sync_failures' => $syncFailures,
            'by_status' => $byStatus,
            'current_report' => $currentReport,
        ]);
    }
}
