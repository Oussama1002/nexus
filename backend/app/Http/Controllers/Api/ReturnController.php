<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReturnRecord;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReturnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = ReturnRecord::query()->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($search = $request->query('search')) {
            $q->where(function ($qq) use ($search) {
                $qq->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('order_ref', 'like', "%{$search}%")
                    ->orWhere('product_name', 'like', "%{$search}%");
            });
        }

        $paginator = $q->paginate($perPage);
        $mapped = $paginator->getCollection()->map(fn ($r) => [
            'id' => $r->id,
            'order_ref' => $r->order_ref ?? '',
            'customer_name' => $r->customer_name,
            'product_name' => $r->product_name,
            'reason' => $r->reason,
            'status' => $r->status,
            'amount' => (float) $r->amount,
            'created_at' => $r->created_at?->toIso8601String(),
        ]);
        $paginator->setCollection($mapped);
        return ApiResponse::success($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
            'order_ref' => ['nullable', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'product_name' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string'],
            'amount' => ['nullable', 'numeric', 'min:0'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()->id;
        $data['status'] = 'requested';
        $row = ReturnRecord::query()->create($data);
        AuditLogger::log($request, 'return.create', $row);
        return ApiResponse::success($row->fresh(), 'Retour créé.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = ReturnRecord::query()->findOrFail($id);
        $data = $request->validate([
            'status' => ['nullable', 'string', 'in:requested,in_transit,received,refunded,refused'],
            'reason' => ['nullable', 'string'],
            'amount' => ['nullable', 'numeric', 'min:0'],
        ]);
        $row->fill($data)->save();
        AuditLogger::log($request, 'return.update', $row);
        return ApiResponse::success($row->fresh());
    }
}
