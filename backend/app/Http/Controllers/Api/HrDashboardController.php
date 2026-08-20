<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\HrCandidate;
use App\Models\HrDisciplineRecord;
use App\Models\HrDocument;
use App\Models\HrEvaluation;
use App\Models\HrJobOpening;
use App\Models\HrLeaveRequest;
use App\Models\HrPayrollPeriod;
use App\Models\HrTrainingRecord;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrDashboardController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        $scoped = fn ($q) => $brandId !== null ? $q->where('brand_id', $brandId) : $q;

        $activeEmployees = $scoped(Employee::query())->where('status', 'active')->count();
        $onboardingInProgress = $scoped(Employee::query())->where('onboarding_status', 'en_cours')->count();
        $pendingLeaves = $scoped(HrLeaveRequest::query())->where('status', 'en_attente')->count();
        $openJobs = $scoped(HrJobOpening::query())->whereIn('status', ['ouvert', 'publie'])->count();
        $activeCandidates = $scoped(HrCandidate::query())
            ->whereNotIn('status', ['accepte', 'refuse', 'archive'])->count();
        $ongoingTrainings = $scoped(HrTrainingRecord::query())
            ->whereIn('status', ['planifiee', 'en_cours'])->count();
        $ongoingEvaluations = $scoped(HrEvaluation::query())
            ->whereNotIn('status', ['finalise'])->count();
        $activeDisciplineCases = $scoped(HrDisciplineRecord::query())
            ->where('is_cancelled', false)
            ->whereNotIn('status', ['accuse'])->count();
        $currentPayroll = $scoped(HrPayrollPeriod::query())
            ->where('status', 'ouvert')
            ->orderByDesc('year')->orderByDesc('month')
            ->first();

        // Documents expiring in next 60 days
        $expiringDocs = $scoped(HrDocument::query())
            ->whereNotNull('expiry_date')
            ->whereBetween('expiry_date', [now()->toDateString(), now()->addDays(60)->toDateString()])
            ->count();

        // Contract endings in next 60 days
        $endingContracts = $scoped(Employee::query())
            ->where('status', 'active')
            ->whereNotNull('contract_end_date')
            ->whereBetween('contract_end_date', [now()->toDateString(), now()->addDays(60)->toDateString()])
            ->count();

        // Employees by department
        $byDepartment = $scoped(Employee::query())
            ->where('status', 'active')
            ->selectRaw('department, COUNT(*) as count')
            ->groupBy('department')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        return ApiResponse::success([
            'active_employees' => $activeEmployees,
            'onboarding_in_progress' => $onboardingInProgress,
            'pending_leaves' => $pendingLeaves,
            'open_jobs' => $openJobs,
            'active_candidates' => $activeCandidates,
            'ongoing_trainings' => $ongoingTrainings,
            'ongoing_evaluations' => $ongoingEvaluations,
            'active_discipline_cases' => $activeDisciplineCases,
            'current_payroll' => $currentPayroll,
            'expiring_documents' => $expiringDocs,
            'ending_contracts' => $endingContracts,
            'by_department' => $byDepartment,
        ]);
    }
}
