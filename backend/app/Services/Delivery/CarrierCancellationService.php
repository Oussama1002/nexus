<?php

namespace App\Services\Delivery;

use App\Models\Order;
use App\Models\Shipment;
use App\Services\Delivery\Providers\AmeexDeliveryProvider;
use App\Services\Delivery\Providers\SenditDeliveryProvider;
use Illuminate\Support\Facades\Log;

/**
 * Annule le colis chez le transporteur quand la commande disparaît du CRM
 * (archivage, suppression) : sans ça le livreur continue sa tournée.
 */
class CarrierCancellationService
{
    public function __construct(protected DeliveryCarrierResolver $resolver) {}

    /**
     * @return array{ok: bool, message: string}|null  null = rien à annuler
     */
    public function cancelForOrder(Order $order): ?array
    {
        /** @var Shipment|null $shipment */
        $shipment = $order->shipment()->with('deliveryCompany')->first();

        if (! $shipment || ! $shipment->external_tracking_id) {
            return null;
        }

        if (in_array($shipment->status, ['cancelled', 'returned', 'delivered'], true)) {
            return null;
        }

        $code = (string) ($shipment->deliveryCompany?->code ?? '');
        $resolved = $code !== '' ? $this->resolver->resolve($code, (int) $order->brand_id) : null;

        $provider = match ($code) {
            'sendit' => $resolved ? new SenditDeliveryProvider($resolved) : null,
            'ameex' => $resolved ? new AmeexDeliveryProvider($resolved) : null,
            default => null,
        };

        if (! $provider) {
            return ['ok' => false, 'message' => "Aucune intégration API pour annuler le colis chez {$code}."];
        }

        try {
            $result = $provider->cancelShipment((string) $shipment->external_tracking_id);
        } catch (\Throwable $e) {
            $result = ['ok' => false, 'message' => "Le transporteur n'a pas répondu : ".$e->getMessage()];
        }

        if ($result['ok'] ?? false) {
            $shipment->forceFill([
                'status' => 'cancelled',
                'carrier_status' => 'cancelled',
                'sync_error' => null,
            ])->save();
        } else {
            $shipment->forceFill(['sync_error' => $result['message'] ?? 'Échec annulation'])->save();
        }

        Log::info('shipment.carrier_cancel', [
            'order_id' => $order->id,
            'shipment_id' => $shipment->id,
            'carrier' => $code,
            'tracking' => $shipment->external_tracking_id,
            'ok' => $result['ok'] ?? false,
            'message' => $result['message'] ?? null,
        ]);

        return [
            'ok' => (bool) ($result['ok'] ?? false),
            'message' => (string) ($result['message'] ?? ''),
        ];
    }
}
