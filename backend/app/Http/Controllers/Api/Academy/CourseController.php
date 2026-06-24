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

        $rows = Course::query()
            ->where('brand_id', $brandId)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim((string) $request->query('search'))).'%';
                $q->where(function ($nested) use ($search) {
                    $nested->where('title', 'like', $search)->orWhere('description', 'like', $search);
                });
            })
            ->with('category')
            ->withCount(['sections', 'lessons', 'enrollments'])
            ->orderByDesc('id')
            ->paginate($perPage);

        return ApiResponse::success(CourseResource::collection($rows), 'Academy courses retrieved successfully.');
    }

    public function store(StoreAcademyCourseRequest $request): JsonResponse
    {
        $this->authorize('create', Course::class);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['created_by'] = $request->user()?->id;
        $data['updated_by'] = $request->user()?->id;

        $request->validate([
            'slug' => [
                'required',
                Rule::unique('courses', 'slug')->where(fn ($query) => $query->where('brand_id', $brandId)),
            ],
        ]);

        $course = Course::query()->create($data);

        return ApiResponse::success(new CourseResource($course->load('category')), 'Academy course created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()
            ->where('brand_id', $brandId)
            ->with(['category', 'sections.lessons.resources'])
            ->withCount(['sections', 'lessons', 'enrollments'])
            ->findOrFail($id);
        $this->authorize('view', $course);

        return ApiResponse::success(new CourseResource($course), 'Academy course retrieved successfully.');
    }

    public function update(UpdateAcademyCourseRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->authorize('update', $course);

        $data = $request->validated();
        if (isset($data['slug']) && $data['slug'] !== $course->slug) {
            $request->validate([
                'slug' => [
                    Rule::unique('courses', 'slug')->where(fn ($query) => $query->where('brand_id', $brandId)),
                ],
            ]);
        }
        $data['updated_by'] = $request->user()?->id;
        $course->fill($data);
        $course->save();

        return ApiResponse::success(new CourseResource($course->fresh('category')), 'Academy course updated successfully.');
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

        return ApiResponse::success(new CourseResource($course->fresh('category')), 'Academy course published successfully.');
    }

    public function archive(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->authorize('archive', $course);

        $course->status = 'archived';
        $course->updated_by = $request->user()?->id;
        $course->save();

        return ApiResponse::success(new CourseResource($course->fresh('category')), 'Academy course archived successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $course = Course::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->authorize('delete', $course);
        $course->updated_by = $request->user()?->id;
        $course->save();
        $course->delete();

        return ApiResponse::success(null, 'Academy course deleted successfully.');
    }
}
