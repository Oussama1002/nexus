<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Student;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnrollmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.view')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $courseId = $request->query('course_id');
        $studentId = $request->query('student_id');

        $query = Enrollment::query()
            ->where('brand_id', $brandId)
            ->with([
                'course:id,title,slug,status',
                'student:id,full_name,email,phone',
                'salesAgent:id,name,email',
            ])
            ->orderByDesc('id');

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($courseId !== null && $courseId !== '') {
            $query->where('course_id', (int) $courseId);
        }

        if ($studentId !== null && $studentId !== '') {
            $query->where('student_id', (int) $studentId);
        }

        if ($search !== '') {
            $s = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
            $query->whereHas('student', function ($nested) use ($s) {
                $nested->where('full_name', 'like', $s)
                    ->orWhere('email', 'like', $s);
            });
        }

        $paginator = $query->paginate($perPage);

        return ApiResponse::success([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ], 'Enrollments retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.create')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $validated = $request->validate([
            'course_id' => 'required|integer|exists:courses,id',
            'student_id' => 'required|integer|exists:students,id',
            'sales_agent_id' => 'nullable|integer|exists:users,id',
            'enrollment_type' => 'nullable|string|in:free,paid,manual,bulk',
            'status' => 'nullable|string|in:pending,active,completed,expired,cancelled',
            'price_paid' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'expires_at' => 'nullable|date',
        ]);

        // Verify course and student belong to the brand
        Course::query()->where('brand_id', $brandId)->findOrFail($validated['course_id']);
        Student::query()->where('brand_id', $brandId)->findOrFail($validated['student_id']);

        $enrollment = Enrollment::query()->create([
            'brand_id' => $brandId,
            'course_id' => $validated['course_id'],
            'student_id' => $validated['student_id'],
            'sales_agent_id' => $validated['sales_agent_id'] ?? null,
            'enrollment_type' => $validated['enrollment_type'] ?? 'manual',
            'status' => $validated['status'] ?? 'active',
            'price_paid' => $validated['price_paid'] ?? 0,
            'currency' => $validated['currency'] ?? 'USD',
            'progress_percent' => 0,
            'enrolled_at' => now(),
            'expires_at' => $validated['expires_at'] ?? null,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        return ApiResponse::success(
            $enrollment->load(['course:id,title,slug', 'student:id,full_name,email'])->toArray(),
            'Enrollment created successfully.',
            201
        );
    }

    public function bulkStore(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.create')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $validated = $request->validate([
            'course_id' => 'required|integer|exists:courses,id',
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'integer|exists:students,id',
            'enrollment_type' => 'nullable|string|in:free,paid,manual,bulk',
            'price_paid' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'expires_at' => 'nullable|date',
        ]);

        // Verify course belongs to the brand
        Course::query()->where('brand_id', $brandId)->findOrFail($validated['course_id']);

        // Verify all students belong to the brand
        $validStudentCount = Student::query()
            ->where('brand_id', $brandId)
            ->whereIn('id', $validated['student_ids'])
            ->count();

        if ($validStudentCount !== count($validated['student_ids'])) {
            return ApiResponse::error('Some students do not belong to this brand.', [], 422);
        }

        $enrollments = [];
        foreach ($validated['student_ids'] as $studentId) {
            // Skip if already enrolled
            $exists = Enrollment::query()
                ->where('course_id', $validated['course_id'])
                ->where('student_id', $studentId)
                ->whereNotIn('status', ['cancelled', 'expired'])
                ->exists();

            if ($exists) {
                continue;
            }

            $enrollments[] = Enrollment::query()->create([
                'brand_id' => $brandId,
                'course_id' => $validated['course_id'],
                'student_id' => $studentId,
                'enrollment_type' => $validated['enrollment_type'] ?? 'bulk',
                'status' => 'active',
                'price_paid' => $validated['price_paid'] ?? 0,
                'currency' => $validated['currency'] ?? 'USD',
                'progress_percent' => 0,
                'enrolled_at' => now(),
                'expires_at' => $validated['expires_at'] ?? null,
                'created_by' => $user->id,
                'updated_by' => $user->id,
            ]);
        }

        return ApiResponse::success([
            'data' => collect($enrollments)->map(fn ($e) => $e->toArray())->all(),
            'enrolled_count' => count($enrollments),
        ], 'Bulk enrollment completed successfully.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $enrollment = Enrollment::query()
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $validated = $request->validate([
            'status' => 'sometimes|required|string|in:pending,active,completed,expired,cancelled',
            'progress_percent' => 'nullable|numeric|min:0|max:100',
            'price_paid' => 'nullable|numeric|min:0',
            'expires_at' => 'nullable|date',
        ]);

        if (isset($validated['status']) && $validated['status'] === 'completed' && !$enrollment->completed_at) {
            $validated['completed_at'] = now();
        }

        $validated['updated_by'] = $user->id;
        $enrollment->fill($validated);
        $enrollment->save();

        return ApiResponse::success(
            $enrollment->load(['course:id,title,slug', 'student:id,full_name,email'])->toArray(),
            'Enrollment updated successfully.'
        );
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.delete')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $enrollment = Enrollment::query()
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $enrollment->status = 'cancelled';
        $enrollment->updated_by = $user->id;
        $enrollment->save();
        $enrollment->delete();

        return ApiResponse::success(null, 'Enrollment cancelled successfully.');
    }
}
