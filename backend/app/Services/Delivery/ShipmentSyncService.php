<?php

namespace App\Services\Delivery;

use App\Models\DeliveryCompany;
use App\Models\Shipment;
use App\Models\User;
use App\Services\ShipmentOperationsService;
use Illuminate\Support\Facades\DB;

class ShipmentSyncService
{
    public function __construct(
        protected DeliveryProviderFactory $factory,
        protected ShipmentStatusMapper $mapper,
        protected ShipmentOperationsService $shipmentOperations
    ) {}

    /**
     * @return array{shipment: Shipment, provider: array<string, mixed>, mapped_status: ?string}
     */
    public function syncShipment(Shipment $shipment, User $actor): array
    {
        $company = $shipment->deliveryCompany ?? DeliveryCompany::query()->find($shipment->delivery_company_id);
        $provider = $this->factory->forCompany($company);

        $tracking = $shipment->tracking_number ?? $shipment->external_tracking_id ?? '';
        $result = $provider->trackShipment((string) $tracking);

        return DB::transaction(function () use ($shipment, $actor, $result, $company) {
            /** @var Shipment $locked */
            $locked = Shipment::query()->whereKey($shipment->id)->lockForUpdate()->firstOrFail();

            $locked->carrier_last_sync_at = now();
            $locked->carrier_response_json = $result;
            $locked->sync_error = ($result['ok'] ?? false) ? null : ($result['message'] ?? 'Sync failed');
            $locked->carrier_status = is_array($result['data'] ?? null)
                ? (string) (($result['data']['carrier_status'] ?? $result['data']['internal_status'] ?? '') ?: '')
                : null;

            $locked->save();

            $mapped = $this->mapper->toInternal($result['data'] ?? $locked->carrier_status);
            $out = $locked->fresh();
            if ($mapped !== null && $out && $mapped !== $out->status) {
                $out = $this->shipmentOperations->transitionStatus($out, $mapped, $actor, 'Carrier sync', [
                    'from_sync' => true,
                ]);
            }

            return [
                'shipment' => $out->fresh(['deliveryCompany', 'order']),
                'provider' => $result,
                'mapped_status' => $mapped,
            ];
        });
    }
}
