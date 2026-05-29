<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreBrandRequest;
use App\Http\Requests\Api\UpdateBrandRequest;
use App\Models\Brand;
use App\Models\Order;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing(['roles', 'brands']);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');

        $q = Brand::query()->orderBy('name');
        if (! $user->isAdmin()) {
            $q->whereIn('id', $user->brands->pluck('id'));
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)->orWhere('code', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Brands retrieved successfully.');
    }

    public function store(StoreBrandRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['status'] = $data['status'] ?? 'active';

        $brand = Brand::query()->create($data);
        $request->user()->brands()->syncWithoutDetaching([$brand->id]);

        AuditLogger::log($request, 'brands.create', $brand, null, $brand->toArray());

        return ApiResponse::success($brand->fresh(), 'Brand created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brand = Brand::query()->findOrFail($id);
        $this->authorizeBrandAccess($request, $brand->id);

        return ApiResponse::success($brand, 'Brand retrieved successfully.');
    }

    public function update(UpdateBrandRequest $request, string $id): JsonResponse
    {
        $brand = Brand::query()->findOrFail($id);
        $this->authorizeBrandAccess($request, $brand->id);
        $before = $brand->toArray();
        $brand->fill($request->validated());
        $brand->save();

        AuditLogger::log($request, 'brands.update', $brand, $before, $brand->fresh()->toArray());

        return ApiResponse::success($brand->fresh(), 'Brand updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brand = Brand::query()->findOrFail($id);
        $this->authorizeBrandAccess($request, $brand->id);

        if (Order::query()->where('brand_id', $brand->id)->exists()) {
            return ApiResponse::error('Cannot delete brand with existing orders.', null, 422);
        }

        $before = $brand->toArray();
        $brand->delete();

        AuditLogger::log($request, 'brands.delete', null, $before, null);

        return ApiResponse::success(null, 'Brand deleted successfully.');
    }

    protected function authorizeBrandAccess(Request $request, int $brandId): void
    {
        $user = $request->user();
        $user->loadMissing(['roles', 'brands']);
        if ($user->isAdmin()) {
            return;
        }
        if (! $user->brands->contains('id', $brandId)) {
            abort(403, 'Forbidden');
        }
    }
}
