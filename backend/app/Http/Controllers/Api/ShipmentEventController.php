<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreShipmentEventRequest;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShipmentEventController extends Controller
{
    public function indexForShipment(Request $request, string $id): JsonResponse
    {
        $request->query->set('shipment_id', $id);

        return $this->index($request);
    }

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $shipmentId = (int) ($request->query('shipment_id') ?: $request->route('id', 0));
        if (! $shipmentId) {
            return ApiResponse::error('shipment_id query parameter is required.', null, 422);
        }

        $sq = Shipment::query()->where('brand_id', $brandId)->whereKey($shipmentId);
        if ($request->user()->shouldRestrictShipmentsToAssignedOrders()) {
            $sq->whereHas('order', fn ($w) => $w->where('assigned_user_id', $request->user()->id));
        }
        $sq->firstOrFail();

        $events = ShipmentEvent::query()
            ->with('actor')
            ->where('shipment_id', $shipmentId)
            ->orderByDesc('event_at')
            ->get();

        return ApiResponse::success($events, 'Shipment events retrieved successfully.');
    }

    public function store(StoreShipmentEventRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        $shipment = Shipment::query()->where('brand_id', $brandId)->whereKey($data['shipment_id'])->firstOrFail();

        $event = ShipmentEvent::query()->create([
            'shipment_id' => $shipment->id,
            'actor_user_id' => $request->user()->id,
            'event_type' => $data['event_type'],
            'status' => $data['status'] ?? null,
            'note' => $data['note'] ?? null,
            'location' => $data['location'] ?? null,
            'description' => $data['description'] ?? null,
            'raw_payload_json' => $data['raw_payload_json'] ?? null,
            'event_at' => $data['event_at'] ?? now(),
        ]);

        AuditLogger::log($request, 'shipment_events.create', $event, null, $event->toArray());

        return ApiResponse::success($event->load('actor'), 'Shipment event created successfully.', 201);
    }

    public function storeForShipment(Request $request, string $id): JsonResponse
    {
        $request->merge(['shipment_id' => (int) $id]);
        $formRequest = StoreShipmentEventRequest::createFrom($request);
        $formRequest->setContainer(app())->setRedirector(app('redirect'));
        $formRequest->validateResolved();

        return $this->store($formRequest);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $event = ShipmentEvent::query()
            ->whereKey($id)
            ->whereHas('shipment', fn ($q) => $q->where('brand_id', $brandId))
            ->with('actor', 'shipment')
            ->firstOrFail();

        return ApiResponse::success($event, 'Shipment event retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return ApiResponse::error('Shipment events are immutable.', null, 405);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $event = ShipmentEvent::query()
            ->whereKey($id)
            ->whereHas('shipment', fn ($q) => $q->where('brand_id', $brandId))
            ->firstOrFail();

        $before = $event->toArray();
        $event->delete();

        AuditLogger::log($request, 'shipment_events.delete', null, $before, null);

        return ApiResponse::success(null, 'Shipment event deleted successfully.');
    }
}
