<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseSection;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SectionController extends Controller
{
    public function index(Request $request, string $courseId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.view')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $sections = $course->sections()
            ->withCount('lessons')
            ->orderBy('sort_order')
            ->get();

        return ApiResponse::success([
            'data' => $sections->toArray(),
        ], 'Sections retrieved successfully.');
    }

    public function store(Request $request, string $courseId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
            'is_published' => 'nullable|boolean',
        ]);

        $maxOrder = $course->sections()->max('sort_order') ?? 0;

        $section = CourseSection::query()->create([
            'course_id' => $course->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'sort_order' => $validated['sort_order'] ?? ($maxOrder + 1),
            'is_published' => $validated['is_published'] ?? true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        return ApiResponse::success($section->toArray(), 'Section created successfully.', 201);
    }

    public function update(Request $request, string $courseId, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $section = CourseSection::query()
            ->where('course_id', $course->id)
            ->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
            'is_published' => 'nullable|boolean',
        ]);

        $validated['updated_by'] = $user->id;
        $section->fill($validated);
        $section->save();

        return ApiResponse::success($section->toArray(), 'Section updated successfully.');
    }

    public function destroy(Request $request, string $courseId, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $section = CourseSection::query()
            ->where('course_id', $course->id)
            ->findOrFail($id);

        $section->updated_by = $user->id;
        $section->save();
        $section->delete();

        return ApiResponse::success(null, 'Section deleted successfully.');
    }
}
