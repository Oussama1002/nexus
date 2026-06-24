<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Student;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        if (! $request->user()?->hasPermissionSlug('academy_reports.view')) {
            abort(403, 'Forbidden');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $totalStudents = Student::query()->where('brand_id', $brandId)->count();
        $activeStudents = Student::query()->where('brand_id', $brandId)->where('status', 'active')->count();
        $courses = Course::query()->where('brand_id', $brandId)->count();
        $revenue = (float) Payment::query()->where('brand_id', $brandId)->where('payment_status', 'paid')->sum('amount');
        $completionRate = Enrollment::query()
            ->where('brand_id', $brandId)
            ->whereNotNull('completed_at')
            ->count();
        $enrollmentCount = Enrollment::query()->where('brand_id', $brandId)->count();
        $completionPercent = $enrollmentCount > 0 ? round(($completionRate / $enrollmentCount) * 100, 2) : 0;
        $certificatesIssued = Certificate::query()
            ->whereHas('enrollment', fn ($q) => $q->where('brand_id', $brandId))
            ->count();

        $monthlyEnrollments = Enrollment::query()
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as total")
            ->where('brand_id', $brandId)
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $monthlyRevenue = Payment::query()
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month, SUM(amount) as total")
            ->where('brand_id', $brandId)
            ->where('payment_status', 'paid')
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $coursePerformance = Enrollment::query()
            ->join('courses', 'courses.id', '=', 'enrollments.course_id')
            ->where('enrollments.brand_id', $brandId)
            ->select(
                'courses.id',
                'courses.title',
                DB::raw('COUNT(enrollments.id) as enrollments'),
                DB::raw('AVG(enrollments.progress_percent) as avg_progress')
            )
            ->groupBy('courses.id', 'courses.title')
            ->orderByDesc('enrollments')
            ->limit(10)
            ->get();

        return ApiResponse::success([
            'cards' => [
                'total_students' => $totalStudents,
                'active_students' => $activeStudents,
                'courses' => $courses,
                'revenue' => $revenue,
                'completion_rate' => $completionPercent,
                'certificates_issued' => $certificatesIssued,
            ],
            'charts' => [
                'monthly_enrollments' => $monthlyEnrollments,
                'monthly_revenue' => $monthlyRevenue,
                'course_performance' => $coursePerformance,
            ],
        ], 'Academy dashboard report generated successfully.');
    }
}
