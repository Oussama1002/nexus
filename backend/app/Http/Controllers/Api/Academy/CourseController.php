<?php

namespace App\Http\Controllers\Api\Academy;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAcademyCourseRequest;
use App\Http\Requests\Api\UpdateAcademyCourseRequest;
use App\Http\Resources\Api\CourseResource;
use App\Models\Course;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CourseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Course::class);

        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $categoryId = $request->query('course_category_id');

        $query = Course::query()
            ->where('brand_id', $brandId)
            ->with(['category:id,name,slug', 'certificateTemplate:id,name'])
            ->withCount(['sections', 'lessons', 'enrollments'])
            ->orderByDesc('id');

        if ($status !== '') {
            $query->where('status', $status);
        }

        if ($categoryId !== null && $categoryId !== '') {
            $query->where('course_category_id', (int) $categoryId);
        }

        if ($search !== '') {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $query->where(function ($nested) use ($s) {
                $nested->where('title', 'like', $s)
                    ->orWhere('short_description', 'like', $s)
                    ->orWhere('description', 'like', $s);
            });
        }

        return ApiResponse::success(CourseResource::collection($query->paginate($perPage)), 'Courses retrieved successfully.');
    }

    public function store(StoreAcademyCourseRequest $request): JsonResponse
    {
        $this->authorize('create', Course::class);

        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        $request->validate([
            'slug' => [
                'required',
                Rule::unique('courses', 'slug')->where(fn ($q) => $q->where('brand_id', $brandId)),
            ],
        ]);

        $data['brand_id'] = $brandId;
        $data['created_by'] = $request->user()?->id;
        $data['updated_by'] = $request->user()?->id;
        $data['status'] = $data['status'] ?? 'draft';
        $data['enrollment_type'] = $data['enrollment_type'] ?? 'free';
        $data['currency'] = $data['currency'] ?? 'USD';
        $data['price'] = $data['price'] ?? 0;

        $course = Course::query()->create($data);

        return ApiResponse::success(
            new CourseResource($course->load(['category:id,name,slug', 'certificateTemplate:id,name'])),
            'Course created successfully.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $course = Course::query()
            ->where('brand_id', $brandId)
            ->with([
                'category:id,name,slug',
                'certificateTemplate:id,name',
                'sections' => fn ($q) => $q->orderBy('sort_order'),
                'lessons' => fn ($q) => $q->orderBy('sort_order'),
            ])
            ->withCount(['sections', 'lessons', 'enrollments'])
            ->findOrFail($id);

        $this->authorize('view', $course);

        return ApiResponse::success(new CourseResource($course), 'Course retrieved successfully.');
    }

    public function update(UpdateAcademyCourseRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->authorize('update', $course);

        $data = $request->validated();

        if (array_key_exists('slug', $data) && $data['slug'] !== $course->slug) {
            $request->validate([
                'slug' => [
                    Rule::unique('courses', 'slug')->where(fn ($q) => $q->where('brand_id', $brandId)),
                ],
            ]);
        }

        $data['updated_by'] = $request->user()?->id;
        $course->fill($data);
        $course->save();

        return ApiResponse::success(
            new CourseResource($course->fresh(['category:id,name,slug', 'certificateTemplate:id,name'])),
            'Course updated successfully.'
        );
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->authorize('publish', $course);

        $course->status = 'published';
        $course->published_at = now();
        $course->updated_by = $request->user()?->id;
        $course->save();

        return ApiResponse::success(new CourseResource($course), 'Course published successfully.');
    }

    public function archive(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->authorize('archive', $course);

        $course->status = 'archived';
        $course->updated_by = $request->user()?->id;
        $course->save();

        return ApiResponse::success(new CourseResource($course), 'Course archived successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->authorize('delete', $course);

        $course->updated_by = $request->user()?->id;
        $course->save();
        $course->delete();

        return ApiResponse::success(null, 'Course deleted successfully.');
    }
}
