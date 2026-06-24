<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseLesson;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LessonController extends Controller
{
    public function index(Request $request, string $courseId): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.view')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $lessons = $course->lessons()
            ->with('section:id,title,sort_order')
            ->orderByRaw('COALESCE((SELECT sort_order FROM course_sections WHERE course_sections.id = course_lessons.course_section_id), 0)')
            ->orderBy('sort_order')
            ->get();

        return ApiResponse::success([
            'data' => $lessons->toArray(),
        ], 'Lessons retrieved successfully.');
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
            'course_section_id' => 'required|integer|exists:course_sections,id',
            'lesson_type' => 'required|string|in:video,pdf,text,external_link',
            'content' => 'nullable|string',
            'video_url' => 'nullable|string|max:2048',
            'pdf_url' => 'nullable|string|max:2048',
            'external_url' => 'nullable|string|max:2048',
            'duration_minutes' => 'nullable|integer|min:0',
            'sort_order' => 'nullable|integer|min:0',
            'is_preview' => 'nullable|boolean',
            'is_published' => 'nullable|boolean',
        ]);

        $maxOrder = $course->lessons()
            ->where('course_section_id', $validated['course_section_id'])
            ->max('sort_order') ?? 0;

        $lesson = CourseLesson::query()->create([
            'course_id' => $course->id,
            'course_section_id' => $validated['course_section_id'],
            'title' => $validated['title'],
            'lesson_type' => $validated['lesson_type'],
            'content' => $validated['content'] ?? null,
            'video_url' => $validated['video_url'] ?? null,
            'pdf_url' => $validated['pdf_url'] ?? null,
            'external_url' => $validated['external_url'] ?? null,
            'duration_minutes' => $validated['duration_minutes'] ?? null,
            'sort_order' => $validated['sort_order'] ?? ($maxOrder + 1),
            'is_preview' => $validated['is_preview'] ?? false,
            'is_published' => $validated['is_published'] ?? true,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        return ApiResponse::success(
            $lesson->load('section:id,title,sort_order')->toArray(),
            'Lesson created successfully.',
            201
        );
    }

    public function update(Request $request, string $courseId, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $lesson = CourseLesson::query()
            ->where('course_id', $course->id)
            ->findOrFail($id);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'course_section_id' => 'sometimes|required|integer|exists:course_sections,id',
            'lesson_type' => 'sometimes|required|string|in:video,pdf,text,external_link',
            'content' => 'nullable|string',
            'video_url' => 'nullable|string|max:2048',
            'pdf_url' => 'nullable|string|max:2048',
            'external_url' => 'nullable|string|max:2048',
            'duration_minutes' => 'nullable|integer|min:0',
            'sort_order' => 'nullable|integer|min:0',
            'is_preview' => 'nullable|boolean',
            'is_published' => 'nullable|boolean',
        ]);

        $validated['updated_by'] = $user->id;
        $lesson->fill($validated);
        $lesson->save();

        return ApiResponse::success(
            $lesson->load('section:id,title,sort_order')->toArray(),
            'Lesson updated successfully.'
        );
    }

    public function destroy(Request $request, string $courseId, string $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermissionSlug('academy_courses.update')) {
            abort(403);
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($courseId);

        $lesson = CourseLesson::query()
            ->where('course_id', $course->id)
            ->findOrFail($id);

        $lesson->updated_by = $user->id;
        $lesson->save();
        $lesson->delete();

        return ApiResponse::success(null, 'Lesson deleted successfully.');
    }
}
