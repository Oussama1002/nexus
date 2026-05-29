<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OrderFulfillmentService
{
    public function __construct(
        protected StockService $stockService
    ) {}

    /**
     * Remove reserved units and deduct physical stock when an order is delivered (idempotent).
     */
    public function dispatchStockForDeliveredOrder(Order $order, ?User $actor): void
    {
        $order->loadMissing(['lines.product']);
        if ($order->stock_dispatched_at) {
            return;
        }

        DB::transaction(function () use ($order, $actor) {
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($locked->stock_dispatched_at) {
                return;
            }

            foreach ($locked->lines as $line) {
                if (! $line->product_id || ! $line->product) {
                    continue;
                }
                $q = (int) $line->quantity;
                $this->stockService->releaseForOrderLine($line->product, $q, $locked, $actor);
                $this->stockService->recordMovement($line->product->fresh(), 'out', $q, $actor, [
                    'reference_type' => 'order',
                    'reference_id' => $locked->id,
                    'reason' => 'order_delivered',
                ]);
            }

            $locked->stock_dispatched_at = now();
            $locked->save();
        });
    }

    /**
     * Return physical stock to inventory when a delivered order is returned.
     */
    public function returnStockAfterDeliveredOrder(Order $order, ?User $actor): void
    {
        $order->loadMissing(['lines.product']);
        if (! $order->stock_dispatched_at) {
            return;
        }

        DB::transaction(function () use ($order, $actor) {
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if (! $locked->stock_dispatched_at) {
                return;
            }

            foreach ($locked->lines as $line) {
                if (! $line->product_id || ! $line->product) {
                    continue;
                }
                $q = (int) $line->quantity;
                $this->stockService->recordMovement($line->product->fresh(), 'returned', $q, $actor, [
                    'reference_type' => 'order',
                    'reference_id' => $locked->id,
                    'reason' => 'order_returned',
                ]);
            }

            $locked->stock_dispatched_at = null;
            $locked->save();
        });
    }

    /**
     * Release reservations when an order is returned before physical dispatch (shipment not completed).
     */
    public function releaseReservationsForCancelledOrReturnedOrder(Order $order, ?User $actor): void
    {
        $order->loadMissing(['lines.product']);
        DB::transaction(function () use ($order, $actor) {
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            foreach ($locked->lines as $line) {
                if (! $line->product_id || ! $line->product) {
                    continue;
                }
                $q = (int) $line->quantity;
                try {
                    $this->stockService->releaseForOrderLine($line->product, $q, $locked, $actor);
                } catch (RuntimeException) {
                    // already released
                }
            }
        });
    }
}
