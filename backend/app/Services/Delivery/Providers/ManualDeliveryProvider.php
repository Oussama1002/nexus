<?php

namespace App\Services\Delivery\Providers;

use App\Models\Shipment;
use App\Services\Delivery\Contracts\DeliveryProviderInterface;

class ManualDeliveryProvider implements DeliveryProviderInterface
{
    public function createShipment(array $payload): array
    {
        return [
            'ok' => true,
            'code' => 'manual_created',
            'message' => 'Shipment recorded locally (manual carrier).',
            'data' => [
                'tracking' => $payload['tracking_number'] ?? null,
            ],
        ];
    }

    public function trackShipment(string $trackingNumber): array
    {
        $shipment = Shipment::query()->where('tracking_number', $trackingNumber)->first();

        return [
            'ok' => true,
            'code' => 'manual_track',
            'message' => 'Local tracking snapshot.',
            'data' => [
                'tracking_number' => $trackingNumber,
                'internal_status' => $shipment?->status,
                'carrier_status' => $shipment?->carrier_status ?? $shipment?->status,
            ],
        ];
    }

    public function cancelShipment(string $trackingNumber): array
    {
        return [
            'ok' => true,
            'code' => 'manual_cancel',
            'message' => 'Cancellation is handled locally; update shipment status to cancelled.',
            'data' => ['tracking_number' => $trackingNumber],
        ];
    }

    public function printLabel(string $trackingNumber): array
    {
        $shipment = Shipment::query()->where('tracking_number', $trackingNumber)->first();

        return [
            'ok' => (bool) ($shipment?->carrier_label_url),
            'code' => $shipment?->carrier_label_url ? 'label_available' : 'no_label',
            'message' => $shipment?->carrier_label_url ? 'Label URL on file.' : 'No label uploaded for this shipment.',
            'data' => [
                'label_url' => $shipment?->carrier_label_url,
            ],
        ];
    }
}
