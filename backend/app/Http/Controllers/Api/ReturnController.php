<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ReturnRecord;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReturnController extends Controller
{
    /**
     * List returns from two sources:
     *  - Manually created ReturnRecord rows (prefixed id "R123")
     *  - Orders with status = 'returned' (prefixed id "O456")
     * Merged into one chronological page so the Retours module surfaces
     * every physically-returned parcel, not only the ones somebody typed in.
     */
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $page = max((int) $request->query('page', 1), 1);
        $statusFilter = $request->query('status');
        $search = trim((string) $request->query('search', ''));

        // ─── 1. Manual ReturnRecord rows ───
        $rq = ReturnRecord::query()->orderByDesc('id');
        if ($brandId !== null) $rq->where('brand_id', $brandId);
        if ($statusFilter) $rq->where('status', $statusFilter);
        if ($search !== '') {
            $rq->where(function ($q) use ($search) {
                $q->where('customer_name', 'like', "%{$search}%")
                    ->orWhere('order_ref', 'like', "%{$search}%")
                    ->orWhere('product_name', 'like', "%{$search}%");
            });
        }
        $manual = $rq->get()->map(fn (ReturnRecord $r) => [
            'id' => 'R' . $r->id,
            'order_ref' => $r->order_ref ?? '',
            'customer_name' => $r->customer_name,
            'product_name' => $r->product_name,
            'reason' => $r->reason,
            'status' => $r->status,
            'amount' => (float) $r->amount,
            'source' => 'return',
            'created_at' => $r->created_at?->toIso8601String(),
        ]);

        // ─── 2. Orders whose status is 'returned' ───
        // Include only when the filter allows it. Map to the same shape
        // with source='order' so the frontend can badge/distinguish.
        $fromOrders = collect();
        $showReturnedOrders = !$statusFilter
            || in_array($statusFilter, ['received', 'refunded'], true);
        if ($showReturnedOrders) {
            $oq = Order::query()
                ->with(['customer:id,full_name', 'lines:id,order_id,product_name'])
                ->where('status', 'returned')
                ->orderByDesc('updated_at');
            if ($brandId !== null) $oq->where('brand_id', $brandId);
            if ($search !== '') {
                $oq->where(function ($q) use ($search) {
                    $q->where('order_number', 'like', "%{$search}%")
                        ->orWhereHas('customer', fn ($qq) => $qq->where('full_name', 'like', "%{$search}%"));
                });
            }
            $fromOrders = $oq->get()->map(fn (Order $o) => [
                'id' => 'O' . $o->id,
                'order_ref' => $o->order_number,
                'customer_name' => $o->customer?->full_name ?? '—',
                'product_name' => $o->lines->pluck('product_name')->filter()->take(3)->join(', ') ?: '—',
                'reason' => $o->cancellation_reason ?: 'Commande retournée',
                'status' => 'received',
                'amount' => (float) $o->total,
                'source' => 'order',
                'created_at' => ($o->updated_at ?? $o->created_at)?->toIso8601String(),
            ]);
        }

        // ─── Merge + manual paginate ───
        $all = $manual->concat($fromOrders)
            ->sortByDesc('created_at')
            ->values();

        $total = $all->count();
        $items = $all->slice(($page - 1) * $perPage, $perPage)->values();

        return ApiResponse::success([
            'data' => $items,
            'current_page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'last_page' => max((int) ceil($total / $perPage), 1),
        ]);
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
        // Only manual returns_records rows are updatable via this endpoint.
        // Order-sourced entries (id starting with "O") are read-only mirrors —
        // update the underlying Order to change them.
        $numericId = ltrim($id, 'R');
        $row = ReturnRecord::query()->findOrFail($numericId);
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
