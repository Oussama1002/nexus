<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademyLesson;
use App\Services\AuditService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class AcademyLessonController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);
        $search = trim((string) $request->query('search', ''));
        $category = trim((string) $request->query('category', ''));

        $q = AcademyLesson::query()
            ->where('brand_id', $brandId)
            ->where('is_active', true)
            ->with('createdBy:id,name')
            ->orderByDesc('sort_order')
            ->orderByDesc('id');

        if ($category !== '') {
            $q->where('category', $category);
        }

        if ($search !== '') {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('title', 'like', $s)
                    ->orWhere('content', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Academy lessons retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireEditPermission($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category' => ['required', Rule::in(['sales', 'product', 'process', 'faq', 'general'])],
            'content' => ['required', 'string'],
            'media_url' => ['nullable', 'url', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()?->id;

        $lesson = AcademyLesson::query()->create($data);
        AuditService::log($request, 'academy_lessons.create', $lesson, null, $lesson->toArray());

        return ApiResponse::success($lesson->fresh('createdBy:id,name'), 'Academy lesson created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lesson = AcademyLesson::query()->where('brand_id', $brandId)->with('createdBy:id,name')->findOrFail($id);

        return ApiResponse::success($lesson, 'Academy lesson retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $this->requireEditPermission($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lesson = AcademyLesson::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $lesson->toArray();
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', Rule::in(['sales', 'product', 'process', 'faq', 'general'])],
            'content' => ['sometimes', 'string'],
            'media_url' => ['nullable', 'url', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $lesson->fill($data);
        $lesson->save();
        AuditService::log($request, 'academy_lessons.update', $lesson, $before, $lesson->fresh()->toArray());

        return ApiResponse::success($lesson->fresh('createdBy:id,name'), 'Academy lesson updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->requireEditPermission($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lesson = AcademyLesson::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $lesson->toArray();
        $lesson->delete();
        AuditService::log($request, 'academy_lessons.delete', null, $before, null);

        return ApiResponse::success(null, 'Academy lesson deleted successfully.');
    }

    private function requireEditPermission(Request $request): void
    {
        if (! $request->user()?->hasPermissionSlug('hr.update')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
