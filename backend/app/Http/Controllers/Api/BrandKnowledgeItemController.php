<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreBrandKnowledgeItemRequest;
use App\Http\Requests\Api\UpdateBrandKnowledgeItemRequest;
use App\Models\BrandKnowledgeItem;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandKnowledgeItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);
        $search = trim((string) $request->query('search', ''));
        $category = trim((string) $request->query('category', ''));
        $active = $request->query('active');

        $q = BrandKnowledgeItem::query();
        ApiBrandContext::scopeBrand($q, $brandId);
        $q
            ->with(['createdBy:id,name', 'updatedBy:id,name'])
            ->orderByDesc('sort_order')
            ->orderByDesc('id');

        if ($category !== '') {
            $q->where('category', $category);
        }

        if ($active !== null && $active !== '') {
            $q->where('is_active', filter_var($active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($search !== '') {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('title', 'like', $s)
                    ->orWhere('content', 'like', $s)
                    ->orWhere('product_name', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Knowledge base items retrieved successfully.');
    }

    public function store(StoreBrandKnowledgeItemRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()?->id;
        $data['updated_by_user_id'] = $request->user()?->id;

        $item = BrandKnowledgeItem::query()->create($data);
        AuditLogger::log($request, 'knowledge_base.create', $item, null, $item->toArray());

        return ApiResponse::success($item->fresh(['createdBy:id,name', 'updatedBy:id,name']), 'Knowledge base item created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $item = BrandKnowledgeItem::query()
            ->where('brand_id', $brandId)
            ->with(['createdBy:id,name', 'updatedBy:id,name'])
            ->findOrFail($id);

        return ApiResponse::success($item, 'Knowledge base item retrieved successfully.');
    }

    public function update(UpdateBrandKnowledgeItemRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $item = BrandKnowledgeItem::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $item->toArray();
        $item->fill($request->validated());
        $item->updated_by_user_id = $request->user()?->id;
        $item->save();

        AuditLogger::log($request, 'knowledge_base.update', $item, $before, $item->fresh()->toArray());

        return ApiResponse::success($item->fresh(['createdBy:id,name', 'updatedBy:id,name']), 'Knowledge base item updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $item = BrandKnowledgeItem::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $item->toArray();
        $item->delete();

        AuditLogger::log($request, 'knowledge_base.delete', null, $before, null);

        return ApiResponse::success(null, 'Knowledge base item deleted successfully.');
    }
}
