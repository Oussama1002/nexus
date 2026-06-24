<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\StudentResource;
use App\Models\Student;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Student::class);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $rows = Student::query()
            ->where('brand_id', $brandId)
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim((string) $request->query('search'))).'%';
                $query->where(function ($nested) use ($search) {
                    $nested->where('full_name', 'like', $search)
                        ->orWhere('email', 'like', $search)
                        ->orWhere('company', 'like', $search);
                });
            })
            ->withCount(['enrollments', 'certificates'])
            ->orderBy('full_name')
            ->paginate($perPage);

        return ApiResponse::success(StudentResource::collection($rows), 'Academy students retrieved successfully.');
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $student = Student::query()
            ->where('brand_id', $brandId)
            ->with([
                'enrollments.course:id,title',
                'certificates:id,student_id,certificate_number,issued_at',
                'quizAttempts:id,student_id,score,passed,submitted_at',
            ])
            ->withCount(['enrollments', 'certificates'])
            ->findOrFail($id);
        $this->authorize('view', $student);

        return ApiResponse::success(new StudentResource($student), 'Academy student retrieved successfully.');
    }
}
