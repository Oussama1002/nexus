<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryFailure;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryFailureController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = DeliveryFailure::query()->orderByDesc('failed_at');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($carrier = $request->query('carrier')) $q->where('carrier', $carrier);
        if ($search = $request->query('search')) {
            $q->where(function ($qq) use ($search) {
                $qq->where('tracking_number', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('order_ref', 'like', "%{$search}%");
            });
        }

        $paginator = $q->paginate($perPage);
        $mapped = $paginator->getCollection()->map(fn ($r) => [
            'id' => $r->id,
            'tracking_number' => $r->tracking_number,
            'order_ref' => $r->order_ref ?? '',
            'customer_name' => $r->customer_name,
            'carrier' => $r->carrier,
            'reason' => $r->reason,
            'attempts' => (int) $r->attempts,
            'status' => $r->status,
            'failed_at' => $r->failed_at?->toIso8601String(),
        ]);
        $paginator->setCollection($mapped);
        return ApiResponse::success($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
            'tracking_number' => ['required', 'string', 'max:100'],
            'order_ref' => ['nullable', 'string', 'max:100'],
            'customer_name' => ['required', 'string', 'max:255'],
            'carrier' => ['required', 'string', 'max:60'],
            'reason' => ['required', 'string'],
            'attempts' => ['nullable', 'integer', 'min:1'],
            'failed_at' => ['required', 'date'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()->id;
        $data['status'] = 'pending';
        $row = DeliveryFailure::query()->create($data);
        AuditLogger::log($request, 'delivery_failure.create', $row);
        return ApiResponse::success($row->fresh(), 'Échec enregistré.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = DeliveryFailure::query()->findOrFail($id);
        $data = $request->validate([
            'status' => ['nullable', 'string', 'in:pending,rescheduled,cancelled'],
            'attempts' => ['nullable', 'integer'],
            'reason' => ['nullable', 'string'],
        ]);
        $row->fill($data)->save();
        AuditLogger::log($request, 'delivery_failure.update', $row);
        return ApiResponse::success($row->fresh());
    }
}
