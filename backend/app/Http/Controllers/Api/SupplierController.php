<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreSupplierRequest;
use App\Http\Requests\Api\UpdateSupplierRequest;
use App\Models\Supplier;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');
        $status = $request->query('status');

        $q = Supplier::query()
            ->where('brand_id', $brandId)
            ->withCount('purchaseOrders')
            ->withMax('purchaseOrders', 'created_at')
            ->orderByDesc('id');
        if ($status) {
            $q->where('status', $status);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)
                    ->orWhere('supplier_code', 'like', $s)
                    ->orWhere('contact_name', 'like', $s)
                    ->orWhere('phone', 'like', $s)
                    ->orWhere('email', 'like', $s)
                    ->orWhere('city', 'like', $s)
                    ->orWhere('category', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Suppliers retrieved successfully.');
    }

    public function store(StoreSupplierRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;

        $supplier = Supplier::query()->create($data);

        AuditLogger::log($request, 'suppliers.create', $supplier, null, $supplier->toArray());

        return ApiResponse::success($supplier->fresh(), 'Supplier created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $supplier = Supplier::query()->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($supplier, 'Supplier retrieved successfully.');
    }

    public function update(UpdateSupplierRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $supplier = Supplier::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $supplier->toArray();
        $supplier->fill($request->validated());
        $supplier->save();

        AuditLogger::log($request, 'suppliers.update', $supplier, $before, $supplier->fresh()->toArray());

        return ApiResponse::success($supplier->fresh(), 'Supplier updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $supplier = Supplier::query()->where('brand_id', $brandId)->findOrFail($id);

        if ($supplier->purchaseOrders()->exists()) {
            return ApiResponse::error('Cannot delete supplier with purchase orders.', null, 422);
        }

        $before = $supplier->toArray();
        $supplier->delete();

        AuditLogger::log($request, 'suppliers.delete', null, $before, null);

        return ApiResponse::success(null, 'Supplier deleted successfully.');
    }
}
