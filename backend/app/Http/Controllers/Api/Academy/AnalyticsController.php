<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\QuizAttempt;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * GET /api/academy/analytics
     * Global KPIs + per-course breakdown for the active brand.
     */
    public function overview(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        $courses = Course::query()
            ->when($brandId !== null, fn ($q) => $q->where('brand_id', $brandId))
            ->orderByDesc('id')
            ->get(['id', 'title', 'status', 'difficulty_level']);

        $courseIds = $courses->pluck('id');

        $enrollAgg = Enrollment::query()
            ->whereIn('course_id', $courseIds)
            ->selectRaw('course_id, COUNT(*) as total, '
                .'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed, '
                .'AVG(progress_percent) as avg_progress, '
                .'SUM(CASE WHEN status NOT IN (?, ?, ?) AND due_at IS NOT NULL AND due_at < NOW() THEN 1 ELSE 0 END) as overdue', ['completed', 'completed', 'cancelled', 'expired'])
            ->groupBy('course_id')
            ->get()
            ->keyBy('course_id');

        $quizAgg = QuizAttempt::query()
            ->join('enrollments', 'enrollments.id', '=', 'quiz_attempts.enrollment_id')
            ->whereIn('enrollments.course_id', $courseIds)
            ->whereIn('quiz_attempts.status', ['submitted', 'graded'])
            ->selectRaw('enrollments.course_id as course_id, AVG(quiz_attempts.score) as avg_score, '
                .'SUM(CASE WHEN quiz_attempts.passed = 1 THEN 1 ELSE 0 END) as passed, COUNT(*) as attempts')
            ->groupBy('enrollments.course_id')
            ->get()
            ->keyBy('course_id');

        $perCourse = $courses->map(function ($c) use ($enrollAgg, $quizAgg) {
            $e = $enrollAgg->get($c->id);
            $q = $quizAgg->get($c->id);
            $total = (int) ($e->total ?? 0);
            $completed = (int) ($e->completed ?? 0);

            return [
                'course_id' => $c->id,
                'title' => $c->title,
                'status' => $c->status,
                'difficulty_level' => $c->difficulty_level,
                'enrolled' => $total,
                'completed' => $completed,
                'completion_rate' => $total > 0 ? (int) round(($completed / $total) * 100) : 0,
                'avg_progress' => (int) round((float) ($e->avg_progress ?? 0)),
                'overdue' => (int) ($e->overdue ?? 0),
                'avg_quiz_score' => $q ? (int) round((float) $q->avg_score) : null,
                'quiz_attempts' => (int) ($q->attempts ?? 0),
                'quiz_pass_rate' => ($q && (int) $q->attempts > 0) ? (int) round(((int) $q->passed / (int) $q->attempts) * 100) : null,
            ];
        });

        $totals = [
            'courses' => $courses->count(),
            'published_courses' => $courses->where('status', 'published')->count(),
            'enrollments' => (int) $enrollAgg->sum('total'),
            'completed' => (int) $enrollAgg->sum('completed'),
            'overall_completion_rate' => $enrollAgg->sum('total') > 0
                ? (int) round(($enrollAgg->sum('completed') / $enrollAgg->sum('total')) * 100)
                : 0,
        ];

        return ApiResponse::success([
            'totals' => $totals,
            'courses' => $perCourse,
        ], 'Analytics retrieved.');
    }

    /**
     * GET /api/academy/analytics/courses/{id}/export
     * CSV of every enrollment (learner, progress, status, quiz score) for a course.
     */
    public function exportCourse(Request $request, int $id): Response
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        $course = Course::query()
            ->when($brandId !== null, fn ($q) => $q->where('brand_id', $brandId))
            ->findOrFail($id);

        $enrollments = Enrollment::query()
            ->where('course_id', $course->id)
            ->with('student:id,full_name,email')
            ->orderByDesc('progress_percent')
            ->get();

        $bestScores = QuizAttempt::query()
            ->whereIn('enrollment_id', $enrollments->pluck('id'))
            ->whereIn('status', ['submitted', 'graded'])
            ->select('enrollment_id', DB::raw('MAX(score) as best_score'), DB::raw('MAX(passed) as passed'))
            ->groupBy('enrollment_id')
            ->get()
            ->keyBy('enrollment_id');

        $rows = [];
        $rows[] = ['Apprenant', 'Email', 'Statut', 'Progression (%)', 'Meilleur score quiz', 'Quiz réussi', 'Inscrit le', 'Échéance', 'Terminé le'];

        foreach ($enrollments as $e) {
            $qa = $bestScores->get($e->id);
            $rows[] = [
                $e->student?->full_name ?? '—',
                $e->student?->email ?? '—',
                $e->status,
                (string) $e->progress_percent,
                $qa ? (string) $qa->best_score : '',
                $qa ? ((int) $qa->passed === 1 ? 'Oui' : 'Non') : '',
                optional($e->enrolled_at)->format('Y-m-d') ?? '',
                optional($e->due_at)->format('Y-m-d') ?? '',
                optional($e->completed_at)->format('Y-m-d') ?? '',
            ];
        }

        $handle = fopen('php://temp', 'r+');
        // BOM so Excel reads UTF-8 accents correctly.
        fwrite($handle, "\xEF\xBB\xBF");
        foreach ($rows as $row) {
            fputcsv($handle, $row, ';');
        }
        rewind($handle);
        $csv = stream_get_contents($handle);
        fclose($handle);

        $filename = 'formation-'.$course->id.'-apprenants.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }
}
