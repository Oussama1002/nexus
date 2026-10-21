<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\CourseLesson;
use App\Models\Enrollment;
use App\Models\LessonProgress;
use App\Models\Student;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class LearnController extends Controller
{
    /**
     * GET /api/academy/learn/courses
     * Lists courses the current user is enrolled in (via Student linked by user_id or email).
     */
    public function myCourses(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $user = $request->user();

        $student = $this->resolveStudent($user, $brandId);
        if (! $student) {
            return ApiResponse::success(['data' => []], 'No enrollments.');
        }

        $enrollments = Enrollment::query()
            ->where('student_id', $student->id)
            ->when($brandId !== null, fn ($q) => $q->where('brand_id', $brandId))
            ->whereIn('status', ['pending', 'active', 'completed'])
            ->with(['course:id,uuid,brand_id,title,slug,short_description,description,status,difficulty_level,duration_minutes'])
            ->orderByDesc('enrolled_at')
            ->orderByDesc('id')
            ->get();

        $enrollmentIds = $enrollments->pluck('id')->all();
        $certByEnrollment = Certificate::query()
            ->whereIn('enrollment_id', $enrollmentIds)
            ->get()
            ->keyBy('enrollment_id');

        $data = $enrollments->map(function (Enrollment $e) use ($certByEnrollment) {
            $course = $e->course;
            if (! $course) {
                return null;
            }

            return [
                'enrollment_id' => $e->id,
                'course' => [
                    'id' => $course->id,
                    'title' => $course->title,
                    'slug' => $course->slug,
                    'short_description' => $course->short_description,
                    'description' => $course->description,
                    'difficulty_level' => $course->difficulty_level,
                    'duration_minutes' => $course->duration_minutes,
                ],
                'status' => $e->status,
                'progress_percent' => (int) $e->progress_percent,
                'enrolled_at' => $e->enrolled_at,
                'due_at' => $e->due_at,
                'completed_at' => $e->completed_at,
                'has_certificate' => $certByEnrollment->has($e->id),
            ];
        })->filter()->values();

        return ApiResponse::success(['data' => $data], 'My courses retrieved.');
    }

    /**
     * GET /api/academy/learn/catalog
     * Published courses in accessible brands the current user is NOT yet enrolled in.
     */
    public function catalog(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $user = $request->user();

        $student = $this->resolveStudent($user, $brandId);
        $enrolledCourseIds = $student
            ? Enrollment::query()->where('student_id', $student->id)->pluck('course_id')->all()
            : [];

        $courses = Course::query()
            ->where('status', 'published')
            ->when($brandId !== null, fn ($q) => $q->where('brand_id', $brandId))
            ->when(! empty($enrolledCourseIds), fn ($q) => $q->whereNotIn('id', $enrolledCourseIds))
            ->withCount(['lessons', 'sections'])
            ->orderByDesc('id')
            ->get(['id', 'title', 'slug', 'short_description', 'description', 'difficulty_level', 'duration_minutes']);

        $data = $courses->map(fn (Course $c) => [
            'course' => [
                'id' => $c->id,
                'title' => $c->title,
                'short_description' => $c->short_description,
                'description' => $c->description,
                'difficulty_level' => $c->difficulty_level,
                'duration_minutes' => $c->duration_minutes,
            ],
            'lessons_count' => (int) $c->lessons_count,
            'sections_count' => (int) $c->sections_count,
        ]);

        return ApiResponse::success(['data' => $data], 'Catalog retrieved.');
    }

    /**
     * POST /api/academy/learn/courses/{id}/enroll
     * Self-enroll the current user into a published course (creates Student if needed).
     */
    public function enroll(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $course = Course::query()->findOrFail($id);

        if ($course->status !== 'published') {
            throw new HttpException(422, 'Formation non disponible.');
        }

        $student = Student::query()
            ->where('brand_id', $course->brand_id)
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)->orWhere('email', $user->email);
            })
            ->first();

        if (! $student) {
            $student = new Student([
                'brand_id' => $course->brand_id,
                'user_id' => $user->id,
                'full_name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => 'active',
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);
            $student->save();
        } elseif (! $student->user_id) {
            $student->user_id = $user->id;
            $student->save();
        }

        $enrollment = Enrollment::query()
            ->where('course_id', $course->id)
            ->where('student_id', $student->id)
            ->first();

        if (! $enrollment) {
            $enrollment = new Enrollment([
                'brand_id' => $course->brand_id,
                'course_id' => $course->id,
                'student_id' => $student->id,
                'status' => 'active',
                'enrollment_type' => 'free',
                'price_paid' => 0,
                'currency' => 'MAD',
                'progress_percent' => 0,
                'enrolled_at' => now(),
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);
            $enrollment->save();
        }

        return ApiResponse::success(['course_id' => $course->id, 'enrollment_id' => $enrollment->id], 'Inscription confirmée.');
    }

    /**
     * GET /api/academy/learn/courses/{id}
     * Full course player payload: sections, lessons, per-lesson progress.
     */
    public function courseDetail(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        $course = Course::query()
            ->when($brandId !== null, fn ($q) => $q->where('brand_id', $brandId))
            ->with([
                'sections' => fn ($q) => $q->orderBy('sort_order'),
                'lessons' => fn ($q) => $q->orderBy('sort_order'),
            ])
            ->findOrFail($id);

        $student = $this->resolveStudent($user, $course->brand_id);
        $enrollment = $student
            ? Enrollment::query()
                ->where('student_id', $student->id)
                ->where('course_id', $course->id)
                ->first()
            : null;

        if (! $enrollment) {
            throw new HttpException(403, 'You are not enrolled in this course.');
        }

        $progressByLesson = LessonProgress::query()
            ->where('enrollment_id', $enrollment->id)
            ->get()
            ->keyBy('course_lesson_id');

        $sections = $course->sections->map(function ($section) use ($course, $progressByLesson) {
            $lessons = $course->lessons
                ->where('course_section_id', $section->id)
                ->sortBy('sort_order')
                ->values()
                ->map(function (CourseLesson $lesson) use ($progressByLesson) {
                    $p = $progressByLesson->get($lesson->id);

                    return [
                        'id' => $lesson->id,
                        'title' => $lesson->title,
                        'lesson_type' => $lesson->lesson_type,
                        'duration_minutes' => $lesson->duration_minutes,
                        'is_preview' => (bool) $lesson->is_preview,
                        'sort_order' => $lesson->sort_order,
                        'progress_status' => $p?->status,
                        'completed_at' => $p?->completed_at,
                    ];
                });

            return [
                'id' => $section->id,
                'title' => $section->title,
                'description' => $section->description,
                'sort_order' => $section->sort_order,
                'lessons' => $lessons,
            ];
        });

        return ApiResponse::success([
            'course' => [
                'id' => $course->id,
                'title' => $course->title,
                'short_description' => $course->short_description,
                'description' => $course->description,
                'difficulty_level' => $course->difficulty_level,
                'duration_minutes' => $course->duration_minutes,
            ],
            'enrollment' => [
                'id' => $enrollment->id,
                'status' => $enrollment->status,
                'progress_percent' => (int) $enrollment->progress_percent,
                'completed_at' => $enrollment->completed_at,
            ],
            'sections' => $sections,
        ], 'Course detail retrieved.');
    }

    /**
     * GET /api/academy/courses/{id}/preview
     * Admin preview of the player payload — no enrollment, gated by permission.
     */
    public function previewCourse(Request $request, int $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        $course = Course::query()
            ->when($brandId !== null, fn ($q) => $q->where('brand_id', $brandId))
            ->with([
                'sections' => fn ($q) => $q->orderBy('sort_order'),
                'lessons' => fn ($q) => $q->orderBy('sort_order'),
            ])
            ->findOrFail($id);

        $sections = $course->sections->map(function ($section) use ($course) {
            $lessons = $course->lessons
                ->where('course_section_id', $section->id)
                ->sortBy('sort_order')
                ->values()
                ->map(fn (CourseLesson $lesson) => [
                    'id' => $lesson->id,
                    'title' => $lesson->title,
                    'lesson_type' => $lesson->lesson_type,
                    'duration_minutes' => $lesson->duration_minutes,
                    'is_preview' => (bool) $lesson->is_preview,
                    'sort_order' => $lesson->sort_order,
                    'progress_status' => null,
                    'completed_at' => null,
                ]);

            return [
                'id' => $section->id,
                'title' => $section->title,
                'description' => $section->description,
                'sort_order' => $section->sort_order,
                'lessons' => $lessons,
            ];
        });

        return ApiResponse::success([
            'course' => [
                'id' => $course->id,
                'title' => $course->title,
                'short_description' => $course->short_description,
                'description' => $course->description,
                'difficulty_level' => $course->difficulty_level,
                'duration_minutes' => $course->duration_minutes,
            ],
            'enrollment' => null,
            'preview' => true,
            'sections' => $sections,
        ], 'Course preview retrieved.');
    }

    /**
     * GET /api/academy/lessons/{id}/preview
     * Admin preview of a single lesson — no enrollment, gated by permission.
     */
    public function previewLesson(Request $request, int $id): JsonResponse
    {
        $lesson = CourseLesson::query()->with('resources')->findOrFail($id);

        return ApiResponse::success([
            'lesson' => [
                'id' => $lesson->id,
                'course_id' => $lesson->course_id,
                'course_section_id' => $lesson->course_section_id,
                'title' => $lesson->title,
                'lesson_type' => $lesson->lesson_type,
                'content' => $lesson->content,
                'video_url' => $lesson->video_url,
                'pdf_url' => $lesson->pdf_url,
                'external_url' => $lesson->external_url,
                'duration_minutes' => $lesson->duration_minutes,
                'resources' => $lesson->resources->map(fn ($r) => [
                    'id' => $r->id,
                    'title' => $r->title,
                    'resource_type' => $r->resource_type,
                    'resource_url' => $r->resource_url,
                    'file_path' => $r->file_path,
                ]),
            ],
            'progress' => null,
        ], 'Lesson preview retrieved.');
    }

    /**
     * GET /api/academy/learn/lessons/{id}
     * Full lesson payload for the player viewer.
     */
    public function lessonDetail(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $lesson = CourseLesson::query()
            ->with(['resources', 'course:id,brand_id'])
            ->findOrFail($id);

        $student = $this->resolveStudent($user, $lesson->course->brand_id);
        $enrollment = $student
            ? Enrollment::query()
                ->where('student_id', $student->id)
                ->where('course_id', $lesson->course_id)
                ->first()
            : null;

        if (! $enrollment) {
            throw new HttpException(403, 'You are not enrolled in this course.');
        }

        $progress = LessonProgress::query()
            ->where('enrollment_id', $enrollment->id)
            ->where('course_lesson_id', $lesson->id)
            ->first();

        return ApiResponse::success([
            'lesson' => [
                'id' => $lesson->id,
                'course_id' => $lesson->course_id,
                'course_section_id' => $lesson->course_section_id,
                'title' => $lesson->title,
                'lesson_type' => $lesson->lesson_type,
                'content' => $lesson->content,
                'video_url' => $lesson->video_url,
                'pdf_url' => $lesson->pdf_url,
                'external_url' => $lesson->external_url,
                'duration_minutes' => $lesson->duration_minutes,
                'resources' => $lesson->resources->map(fn ($r) => [
                    'id' => $r->id,
                    'title' => $r->title,
                    'resource_type' => $r->resource_type,
                    'resource_url' => $r->resource_url,
                    'file_path' => $r->file_path,
                ]),
            ],
            'progress' => $progress ? [
                'status' => $progress->status,
                'last_position_seconds' => $progress->last_position_seconds,
                'completed_at' => $progress->completed_at,
            ] : null,
        ], 'Lesson retrieved.');
    }

    /**
     * POST /api/academy/learn/lessons/{id}/view
     * Mark lesson as viewed (upsert, no-op if already completed).
     */
    public function markViewed(Request $request, int $id): JsonResponse
    {
        return $this->upsertProgress($request, $id, 'viewed');
    }

    /**
     * POST /api/academy/learn/lessons/{id}/complete
     * Mark lesson complete + recompute enrollment progress_percent.
     */
    public function markCompleted(Request $request, int $id): JsonResponse
    {
        return $this->upsertProgress($request, $id, 'completed');
    }

    private function upsertProgress(Request $request, int $lessonId, string $targetStatus): JsonResponse
    {
        $user = $request->user();
        $lesson = CourseLesson::query()->with('course:id,brand_id')->findOrFail($lessonId);

        $student = $this->resolveStudent($user, $lesson->course->brand_id);
        $enrollment = $student
            ? Enrollment::query()
                ->where('student_id', $student->id)
                ->where('course_id', $lesson->course_id)
                ->first()
            : null;

        if (! $enrollment) {
            throw new HttpException(403, 'You are not enrolled in this course.');
        }

        $now = now();
        $progress = LessonProgress::query()
            ->where('enrollment_id', $enrollment->id)
            ->where('course_lesson_id', $lesson->id)
            ->first();

        if (! $progress) {
            $progress = new LessonProgress([
                'enrollment_id' => $enrollment->id,
                'student_id' => $student->id,
                'course_lesson_id' => $lesson->id,
                'status' => $targetStatus,
                'viewed_at' => $now,
                'completed_at' => $targetStatus === 'completed' ? $now : null,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);
            $progress->save();
        } else {
            if ($targetStatus === 'completed' && $progress->status !== 'completed') {
                $progress->status = 'completed';
                $progress->completed_at = $now;
                $progress->updated_by = $user->id;
                $progress->save();
            } elseif ($targetStatus === 'viewed' && ! $progress->viewed_at) {
                $progress->viewed_at = $now;
                $progress->updated_by = $user->id;
                $progress->save();
            }
        }

        $this->recomputeEnrollmentProgress($enrollment);

        return ApiResponse::success([
            'progress_percent' => (int) $enrollment->fresh()->progress_percent,
            'status' => $enrollment->fresh()->status,
        ], 'Progress updated.');
    }

    /**
     * GET /api/academy/learn/enrollments/{id}/certificate
     * Streams the certificate PDF for the current user's enrollment.
     */
    public function downloadCertificate(Request $request, int $id): Response
    {
        $user = $request->user();
        $enrollment = Enrollment::query()
            ->with(['course', 'student', 'brand'])
            ->findOrFail($id);

        $student = $enrollment->student;
        if (! $student || ($student->user_id !== $user->id && $student->email !== $user->email)) {
            throw new HttpException(403, 'This certificate is not yours.');
        }

        if ($enrollment->progress_percent < 100) {
            throw new HttpException(422, 'Formation non terminée.');
        }

        $cert = $this->ensureCertificate($enrollment);
        $brand = $enrollment->brand;

        $pdf = Pdf::loadView('pdf.certificate', [
            'brand_name' => $brand?->name,
            'student_name' => $student->full_name,
            'course_title' => $enrollment->course->title,
            'issued_at' => optional($cert->issued_at)->format('d/m/Y') ?? now()->format('d/m/Y'),
            'certificate_number' => $cert->certificate_number,
            'verification_token' => $cert->verification_token,
        ])->setPaper('a4', 'landscape');

        $filename = 'certificat-'.Str::slug($enrollment->course->title).'.pdf';

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    private function ensureCertificate(Enrollment $enrollment): Certificate
    {
        $existing = Certificate::query()->where('enrollment_id', $enrollment->id)->first();
        if ($existing) {
            return $existing;
        }

        $number = 'CERT-'.now()->format('Y').'-'.str_pad((string) $enrollment->id, 6, '0', STR_PAD_LEFT);
        $cert = new Certificate([
            'course_id' => $enrollment->course_id,
            'enrollment_id' => $enrollment->id,
            'student_id' => $enrollment->student_id,
            'certificate_template_id' => null,
            'certificate_number' => $number,
            'verification_token' => Str::upper(Str::random(12)),
            'issued_at' => now(),
            'created_by' => $enrollment->updated_by,
            'updated_by' => $enrollment->updated_by,
        ]);
        $cert->save();

        return $cert;
    }

    private function recomputeEnrollmentProgress(Enrollment $enrollment): void
    {
        $totalLessons = (int) DB::table('course_lessons')
            ->where('course_id', $enrollment->course_id)
            ->where('is_published', true)
            ->count();

        if ($totalLessons === 0) {
            $totalLessons = (int) DB::table('course_lessons')
                ->where('course_id', $enrollment->course_id)
                ->count();
        }

        $completed = (int) LessonProgress::query()
            ->where('enrollment_id', $enrollment->id)
            ->where('status', 'completed')
            ->count();

        $percent = $totalLessons > 0 ? (int) floor(($completed / $totalLessons) * 100) : 0;
        $percent = max(0, min(100, $percent));

        $enrollment->progress_percent = $percent;
        $justCompleted = false;
        if ($percent >= 100 && $enrollment->status !== 'completed') {
            $enrollment->status = 'completed';
            $enrollment->completed_at = now();
            $justCompleted = true;
        } elseif ($percent > 0 && $enrollment->status === 'pending') {
            $enrollment->status = 'active';
            if (! $enrollment->enrolled_at) {
                $enrollment->enrolled_at = now();
            }
        }
        $enrollment->save();

        if ($justCompleted) {
            $this->ensureCertificate($enrollment);
        }
    }

    private function resolveStudent($user, ?int $brandId): ?Student
    {
        if (! $user) {
            return null;
        }

        $query = Student::query();
        if ($brandId !== null) {
            $query->where('brand_id', $brandId);
        }

        return $query
            ->where(function ($q) use ($user) {
                $q->where('user_id', $user->id)
                    ->orWhere('email', $user->email);
            })
            ->first();
    }
}
