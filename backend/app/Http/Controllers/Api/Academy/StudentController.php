<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
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

        $query = Student::query()
            ->where('brand_id', $brandId)
            ->withCount('enrollments')
            ->orderByDesc('id');

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($search !== '') {
            $s = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $search) . '%';
            $query->where(function ($nested) use ($s) {
                $nested->where('full_name', 'like', $s)
                    ->orWhere('email', 'like', $s)
                    ->orWhere('phone', 'like', $s)
                    ->orWhere('company', 'like', $s);
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
        ], 'Students retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.create')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $validated = $request->validate([
            'full_name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'phone' => 'nullable|string|max:50',
            'company' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'user_id' => 'nullable|integer|exists:users,id',
            'status' => 'nullable|string|in:active,inactive,suspended',
        ]);

        $student = Student::query()->create([
            'brand_id' => $brandId,
            'full_name' => $validated['full_name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'company' => $validated['company'] ?? null,
            'position' => $validated['position'] ?? null,
            'user_id' => $validated['user_id'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        return ApiResponse::success($student->toArray(), 'Student created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.view')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $student = Student::query()
            ->where('brand_id', $brandId)
            ->with([
                'enrollments' => fn ($q) => $q->with('course:id,title,slug,status'),
                'quizAttempts' => fn ($q) => $q->with('quiz:id,title')->latest()->limit(20),
                'certificates' => fn ($q) => $q->with('course:id,title')->latest(),
            ])
            ->withCount('enrollments')
            ->findOrFail($id);

        return ApiResponse::success($student->toArray(), 'Student retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $student = Student::query()
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $validated = $request->validate([
            'full_name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|max:255',
            'phone' => 'nullable|string|max:50',
            'company' => 'nullable|string|max:255',
            'position' => 'nullable|string|max:255',
            'user_id' => 'nullable|integer|exists:users,id',
            'status' => 'nullable|string|in:active,inactive,suspended',
        ]);

        $validated['updated_by'] = $user->id;
        $student->fill($validated);
        $student->save();

        return ApiResponse::success($student->toArray(), 'Student updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.delete')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        $student = Student::query()
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $student->updated_by = $user->id;
        $student->save();
        $student->delete();

        return ApiResponse::success(null, 'Student deleted successfully.');
    }
}
