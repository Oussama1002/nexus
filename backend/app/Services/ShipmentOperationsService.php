<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ShipmentOperationsService
{
    public const STATUSES = [
        'pending',
        'created',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'failed',
        'returned',
        'cancelled',
    ];

    public const PAYMENT_STATUSES = [
        'not_applicable',
        'cod_pending',
        'cod_received',
        'reconciled',
        'disputed',
    ];

    public function __construct(
        protected OrderStateService $orderStateService,
        protected OrderFulfillmentService $orderFulfillmentService
    ) {}

    public static function generateTrackingNumber(int $shipmentId): string
    {
        return sprintf('NX-DEL-%d-%d', (int) now()->format('Y'), $shipmentId);
    }

    /**
     * Create shipment for a confirmed/prepared order; copies recipient fields from order/customer unless overridden.
     *
     * @param  array<string, mixed>  $overrides
     */
    public function createFromOrder(Order $order, User $actor, array $overrides = []): Shipment
    {
        if (! in_array($order->status, ['confirmed', 'prepared'], true)) {
            throw new RuntimeException('Shipment can only be created for a confirmed or prepared order.');
        }

        if ($order->shipment()->exists()) {
            throw new RuntimeException('This order already has a shipment.');
        }

        $order->loadMissing(['customer', 'brand']);

        return DB::transaction(function () use ($order, $actor, $overrides) {
            $customer = $order->customer;
            $codAmount = (float) ($overrides['cod_amount'] ?? (
                $order->payment_method === 'cod' ? $order->total : 0
            ));

            $recipientName = $overrides['recipient_name'] ?? ($customer instanceof Customer ? $customer->full_name : null);
            $recipientPhone = $overrides['recipient_phone'] ?? ($customer instanceof Customer ? $customer->phone : null);
            $recipientCity = $overrides['recipient_city'] ?? $overrides['city'] ?? ($customer instanceof Customer ? $customer->city : null);
            $recipientAddress = $overrides['recipient_address'] ?? $overrides['address'] ?? $order->shipping_address;

            $shipment = Shipment::query()->create([
                'order_id' => $order->id,
                'brand_id' => $order->brand_id,
                'delivery_company_id' => $overrides['delivery_company_id'] ?? null,
                'tracking_number' => $overrides['tracking_number'] ?? null,
                'status' => $overrides['status'] ?? 'created',
                'cod_amount' => $codAmount,
                'delivery_fee' => $overrides['delivery_fee'] ?? 0,
                'insurance_fee' => $overrides['insurance_fee'] ?? 0,
                'payment_status' => $codAmount > 0 ? 'cod_pending' : 'not_applicable',
                'recipient_name' => $recipientName,
                'recipient_phone' => $recipientPhone,
                'city' => $recipientCity,
                'address' => $recipientAddress,
                'recipient_city' => $recipientCity,
                'recipient_address' => $recipientAddress,
                'pickup_date' => $overrides['pickup_date'] ?? null,
                'notes' => $overrides['notes'] ?? null,
                'created_by' => $actor->id,
            ]);

            if (! $shipment->tracking_number) {
                $shipment->tracking_number = self::generateTrackingNumber($shipment->id);
                $shipment->save();
            }

            $this->recordEvent($shipment, $actor, 'created', $shipment->status, 'Shipment created');

            $orderFresh = Order::query()->whereKey($order->id)->lockForUpdate()->first();
            if ($orderFresh && in_array($orderFresh->status, ['confirmed', 'prepared'], true)) {
                $this->orderStateService->updateStatus($orderFresh, 'shipped', $actor, 'Shipment created');
            }

            return $shipment->fresh(['order', 'deliveryCompany']);
        });
    }

    /**
     * @param  array<string, mixed>  $context  failure_reason, return_reason, location, description, event_at, from_sync
     */
    public function transitionStatus(Shipment $shipment, string $toStatus, User $actor, ?string $note = null, array $context = []): Shipment
    {
        if (! in_array($toStatus, self::STATUSES, true)) {
            throw new RuntimeException('Invalid shipment status.');
        }

        if ($toStatus === 'failed' && empty($context['failure_reason'])) {
            throw new RuntimeException('failure_reason is required when status is failed.');
        }

        if ($toStatus === 'returned' && empty($context['return_reason'])) {
            throw new RuntimeException('return_reason is required when status is returned.');
        }

        return DB::transaction(function () use ($shipment, $toStatus, $actor, $note, $context) {
            /** @var Shipment $locked */
            $locked = Shipment::query()->whereKey($shipment->id)->lockForUpdate()->firstOrFail();
            $from = $locked->status;

            if ($from === $toStatus) {
                return $locked->fresh(['order', 'events']);
            }

            if (! empty($context['failure_reason'])) {
                $locked->failure_reason = (string) $context['failure_reason'];
            }
            if (! empty($context['return_reason'])) {
                $locked->return_reason = (string) $context['return_reason'];
            }

            $locked->status = $toStatus;

            if (in_array($toStatus, ['picked_up', 'in_transit', 'out_for_delivery', 'created'], true) && ! $locked->shipped_at) {
                $locked->shipped_at = now();
            }

            if ($toStatus === 'delivered') {
                $locked->delivered_at = now();
                if ((float) $locked->cod_amount > 0) {
                    $locked->payment_status = 'cod_received';
                } else {
                    $locked->payment_status = 'not_applicable';
                }
            }

            if ($toStatus === 'returned') {
                $locked->returned_at = now();
            }

            $locked->save();

            $this->recordEvent($locked, $actor, 'status_changed', $toStatus, $note, $context);

            if ($locked->order_id) {
                $order = Order::query()->whereKey($locked->order_id)->lockForUpdate()->first();
                if ($order) {
                    $this->syncOrderForShipmentStatus($locked->fresh(), $order, $from, $toStatus, $actor, $note);
                }
            }

            return $locked->fresh(['order', 'events.actor', 'deliveryCompany']);
        });
    }

    protected function syncOrderForShipmentStatus(
        Shipment $shipment,
        Order $order,
        string $fromShipmentStatus,
        string $toStatus,
        User $actor,
        ?string $note
    ): void {
        $order->refresh();

        if ($toStatus === 'delivered' && $order->status !== 'delivered') {
            $this->orderStateService->updateStatus($order, 'delivered', $actor, $note);
            $fresh = $order->fresh();
            if ($fresh && $fresh->payment_method === 'cod' && (float) $shipment->cod_amount > 0) {
                $fresh->payment_state = 'cod_pending';
                $fresh->save();
            }
        }

        if ($toStatus === 'returned' && $order->status !== 'returned') {
            $this->orderStateService->updateStatus($order, 'returned', $actor, $note);
        }

        if ($toStatus === 'cancelled' && $order->status === 'shipped') {
            $this->orderStateService->updateStatus($order, 'confirmed', $actor, 'Shipment cancelled');
        }

        if ($toStatus === 'failed' && in_array($order->status, ['shipped'], true)) {
            // keep order shipped; optional business follow-up
        }
    }

    /**
     * @param  array<string, mixed>  $context
     */
    protected function recordEvent(Shipment $shipment, User $actor, string $eventType, ?string $status, ?string $note, array $context = []): void
    {
        ShipmentEvent::query()->create([
            'shipment_id' => $shipment->id,
            'actor_user_id' => $actor->id,
            'event_type' => $eventType,
            'status' => $status,
            'note' => $note,
            'location' => $context['location'] ?? null,
            'description' => $context['description'] ?? null,
            'raw_payload_json' => $context['raw_payload'] ?? null,
            'event_at' => isset($context['event_at']) ? \Carbon\Carbon::parse((string) $context['event_at']) : now(),
        ]);
    }
}
