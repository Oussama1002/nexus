<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PatchShipmentStatusRequest;
use App\Http\Requests\Api\StoreShipmentRequest;
use App\Http\Requests\Api\UpdateShipmentRequest;
use App\Models\Order;
use App\Models\Shipment;
use App\Services\AuditLogger;
use App\Services\Delivery\ShipmentSyncService;
use App\Services\ShipmentOperationsService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ShipmentController extends Controller
{
    public function __construct(
        protected ShipmentOperationsService $shipmentOperationsService,
        protected ShipmentSyncService $shipmentSyncService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');
        $status = $request->query('status');
        $paymentStatus = $request->query('payment_status');
        $deliveryCompanyId = $request->query('delivery_company_id');
        $recipientCity = $request->query('recipient_city');
        $orderId = $request->query('order_id');
        $from = $request->query('from');
        $to = $request->query('to');

        $q = Shipment::query()
            ->with(['order.customer', 'deliveryCompany'])
            ->where('brand_id', $brandId)
            ->orderByDesc('id');

        if ($request->user()->shouldRestrictShipmentsToAssignedOrders()) {
            $q->whereHas('order', fn ($w) => $w->where('assigned_user_id', $request->user()->id));
        }

        if ($status) {
            $q->where('status', $status);
        }
        if ($paymentStatus) {
            $q->where('payment_status', $paymentStatus);
        }
        if ($deliveryCompanyId) {
            $q->where('delivery_company_id', (int) $deliveryCompanyId);
        }
        if ($recipientCity) {
            $city = (string) $recipientCity;
            $q->where(function ($w) use ($city) {
                $w->where('recipient_city', $city)->orWhere('city', $city);
            });
        }
        if ($orderId) {
            $q->where('order_id', (int) $orderId);
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('tracking_number', 'like', $s)
                    ->orWhere('recipient_name', 'like', $s)
                    ->orWhere('recipient_phone', 'like', $s)
                    ->orWhereHas('order', fn ($o) => $o->where('order_number', 'like', $s));
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Shipments retrieved successfully.');
    }

    public function store(StoreShipmentRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        $order = Order::query()->where('brand_id', $brandId)->whereKey($data['order_id'])->firstOrFail();

        try {
            $shipment = $this->shipmentOperationsService->createFromOrder(
                $order,
                $request->user(),
                collect($data)->except(['order_id'])->all()
            );
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'shipments.create', $shipment, null, $shipment->toArray());

        return ApiResponse::success($shipment, 'Shipment created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $q = Shipment::query()
            ->with(['order.lines.product', 'order.customer', 'deliveryCompany', 'events.actor'])
            ->where('brand_id', $brandId);

        if ($request->user()->shouldRestrictShipmentsToAssignedOrders()) {
            $q->whereHas('order', fn ($w) => $w->where('assigned_user_id', $request->user()->id));
        }

        $shipment = $q->findOrFail($id);

        return ApiResponse::success($shipment, 'Shipment retrieved successfully.');
    }

    public function update(UpdateShipmentRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $shipment = Shipment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $shipment->toArray();

        $data = $request->validated();
        if (isset($data['status'])) {
            try {
                $ctx = array_filter([
                    'failure_reason' => $data['failure_reason'] ?? null,
                    'return_reason' => $data['return_reason'] ?? null,
                ]);
                $shipment = $this->shipmentOperationsService->transitionStatus(
                    $shipment,
                    $data['status'],
                    $request->user(),
                    $data['notes'] ?? $data['note'] ?? null,
                    $ctx
                );
            } catch (RuntimeException $e) {
                return ApiResponse::error($e->getMessage(), null, 422);
            }
            unset($data['status'], $data['failure_reason'], $data['return_reason']);
        }

        $shipment->fill($data);
        $shipment->save();

        AuditLogger::log($request, 'shipments.update', $shipment, $before, $shipment->fresh()->toArray());

        return ApiResponse::success($shipment->fresh(['order', 'events']), 'Shipment updated successfully.');
    }

    public function patchStatus(PatchShipmentStatusRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $shipment = Shipment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $shipment->toArray();
        $v = $request->validated();
        $status = $v['status'];
        $note = $v['note'] ?? $v['description'] ?? null;
        $ctx = array_filter([
            'failure_reason' => $v['failure_reason'] ?? null,
            'return_reason' => $v['return_reason'] ?? null,
            'location' => $v['location'] ?? null,
            'description' => $v['description'] ?? null,
            'event_at' => $v['event_at'] ?? null,
        ]);

        try {
            $shipment = $this->shipmentOperationsService->transitionStatus($shipment, $status, $request->user(), $note, $ctx);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'shipments.status', $shipment, $before, ['status' => $status]);

        return ApiResponse::success($shipment, 'Shipment status updated.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $shipment = Shipment::query()->where('brand_id', $brandId)->findOrFail($id);

        if (! in_array($shipment->status, ['pending', 'created', 'cancelled'], true)) {
            return ApiResponse::error('Only pending, created or cancelled shipments can be deleted.', null, 422);
        }

        $before = $shipment->toArray();
        $shipment->events()->delete();
        $shipment->delete();

        AuditLogger::log($request, 'shipments.delete', null, $before, null);

        return ApiResponse::success(null, 'Shipment deleted successfully.');
    }

    public function sync(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $shipment = Shipment::query()->where('brand_id', $brandId)->findOrFail($id);

        if ($request->user()->shouldRestrictShipmentsToAssignedOrders()) {
            $shipment->loadMissing('order');
            if ((int) $shipment->order?->assigned_user_id !== (int) $request->user()->id) {
                return ApiResponse::error('Forbidden.', null, 403);
            }
        }

        $result = $this->shipmentSyncService->syncShipment($shipment, $request->user());
        AuditLogger::log($request, 'shipments.sync', $result['shipment'], null, null);

        return ApiResponse::success($result, 'Shipment sync completed.');
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $shipment = Shipment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $shipment->toArray();

        try {
            $shipment = $this->shipmentOperationsService->transitionStatus(
                $shipment,
                'cancelled',
                $request->user(),
                $request->input('note')
            );
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'shipments.cancel', $shipment, $before, $shipment->toArray());

        return ApiResponse::success($shipment, 'Shipment cancelled.');
    }

    public function label(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $shipment = Shipment::query()->where('brand_id', $brandId)->with('deliveryCompany')->findOrFail($id);

        return ApiResponse::success([
            'label_url' => $shipment->carrier_label_url,
            'tracking_number' => $shipment->tracking_number,
            'provider' => $shipment->deliveryCompany?->code ?? 'manual',
        ], 'Label metadata.');
    }
}
