<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\BulkAcademyEnrollmentRequest;
use App\Http\Requests\Api\StoreAcademyEnrollmentRequest;
use App\Http\Resources\Api\EnrollmentResource;
use App\Models\Enrollment;
use App\Models\Student;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EnrollmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Enrollment::class);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $rows = Enrollment::query()
            ->where('brand_id', $brandId)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['course:id,title', 'student:id,full_name,email'])
            ->orderByDesc('id')
            ->paginate($perPage);

        return ApiResponse::success(EnrollmentResource::collection($rows), 'Academy enrollments retrieved successfully.');
    }

    public function store(StoreAcademyEnrollmentRequest $request): JsonResponse
    {
        $this->authorize('create', Enrollment::class);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        $this->validateStudentBrand($data['student_id'], $brandId);

        $request->validate([
            'student_id' => [
                Rule::unique('enrollments', 'student_id')->where(fn ($q) => $q->where('course_id', $data['course_id'])),
            ],
        ]);

        $data['brand_id'] = $brandId;
        $data['sales_agent_id'] = $request->user()?->id;
        $data['enrolled_at'] = now();
        $data['created_by'] = $request->user()?->id;
        $data['updated_by'] = $request->user()?->id;
        $enrollment = Enrollment::query()->create($data);

        return ApiResponse::success(new EnrollmentResource($enrollment->load(['course:id,title', 'student:id,full_name,email'])), 'Academy enrollment created successfully.', 201);
    }

    public function bulkStore(BulkAcademyEnrollmentRequest $request): JsonResponse
    {
        $this->authorize('bulkEnroll', Enrollment::class);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $courseId = (int) $request->validated('course_id');
        $studentIds = collect($request->validated('student_ids'))
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $created = 0;
        foreach ($studentIds as $studentId) {
            $this->validateStudentBrand($studentId, $brandId);

            $exists = Enrollment::query()
                ->where('course_id', $courseId)
                ->where('student_id', $studentId)
                ->exists();

            if ($exists) {
                continue;
            }

            Enrollment::query()->create([
                'brand_id' => $brandId,
                'course_id' => $courseId,
                'student_id' => $studentId,
                'status' => 'active',
                'enrollment_type' => 'bulk',
                'price_paid' => 0,
                'currency' => 'USD',
                'progress_percent' => 0,
                'enrolled_at' => now(),
                'sales_agent_id' => $request->user()?->id,
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
            $created++;
        }

        return ApiResponse::success(['created' => $created], 'Bulk enrollment completed successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $enrollment = Enrollment::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->authorize('update', $enrollment);

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['pending', 'active', 'completed', 'expired', 'cancelled'])],
            'progress_percent' => ['sometimes', 'integer', 'between:0,100'],
            'completed_at' => ['sometimes', 'nullable', 'date'],
            'expires_at' => ['sometimes', 'nullable', 'date'],
        ]);
        $data['updated_by'] = $request->user()?->id;

        $enrollment->fill($data);
        $enrollment->save();

        return ApiResponse::success(new EnrollmentResource($enrollment->fresh(['course:id,title', 'student:id,full_name,email'])), 'Academy enrollment updated successfully.');
    }

    private function validateStudentBrand(int $studentId, int $brandId): void
    {
        Student::query()->where('brand_id', $brandId)->findOrFail($studentId);
    }
}
