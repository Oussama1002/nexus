<?php

namespace App\Services;

use App\Models\DeliveryPayment;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DeliveryPaymentService
{
    /**
     * Link shipments into a settlement and compute total COD amount.
     *
     * @param  array<int>  $shipmentIds
     */
    public function attachShipments(DeliveryPayment $payment, array $shipmentIds, User $actor): DeliveryPayment
    {
        return DB::transaction(function () use ($payment, $shipmentIds, $actor) {
            $locked = DeliveryPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();

            $total = 0;
            foreach ($shipmentIds as $sid) {
                /** @var Shipment|null $shipment */
                $shipment = Shipment::query()->with('order')->whereKey($sid)->first();
                if (! $shipment || ! $shipment->order) {
                    throw new RuntimeException('Invalid shipment for settlement.');
                }
                $order = $shipment->order;
                if ((int) $order->brand_id !== (int) $locked->brand_id) {
                    throw new RuntimeException('Shipment brand mismatch.');
                }
                if ($order->payment_method !== 'cod' || $order->payment_state !== 'cod_pending') {
                    throw new RuntimeException('Shipment order is not COD pending.');
                }
                if ((int) $shipment->delivery_company_id !== (int) $locked->delivery_company_id) {
                    throw new RuntimeException('Shipment carrier mismatch.');
                }
                $amt = (float) ($shipment->cod_amount ?? $order->total);
                if (! $locked->shipments()->whereKey($shipment->id)->exists()) {
                    $locked->shipments()->attach($shipment->id, ['cod_amount' => $amt]);
                }
                $total += $amt;
                $shipment->delivery_payment_id = $locked->id;
                $shipment->save();
            }

            $locked->amount = round($total, 2);
            $locked->save();

            return $locked->fresh(['shipments', 'deliveryCompany']);
        });
    }

    public function markReconciled(DeliveryPayment $payment, User $actor): DeliveryPayment
    {
        return DB::transaction(function () use ($payment, $actor) {
            $locked = DeliveryPayment::query()->whereKey($payment->id)->lockForUpdate()->with('shipments.order')->firstOrFail();

            if ($locked->state === 'reconciled') {
                return $locked;
            }

            if ($locked->state === 'disputed') {
                throw new RuntimeException('Cannot reconcile a disputed settlement.');
            }

            foreach ($locked->shipments as $shipment) {
                $order = $shipment->order;
                if (! $order) {
                    continue;
                }
                if ($order->payment_state === 'cod_pending' && $order->payment_method === 'cod') {
                    $order->payment_state = 'paid';
                    $order->save();
                }
                if ((float) ($shipment->cod_amount ?? 0) > 0) {
                    $shipment->payment_status = 'reconciled';
                    $shipment->save();
                }
            }

            $locked->state = 'reconciled';
            $locked->reconciled_at = now();
            $locked->save();

            return $locked->fresh(['shipments', 'deliveryCompany']);
        });
    }
}
