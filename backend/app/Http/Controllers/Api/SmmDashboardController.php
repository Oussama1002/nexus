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
