<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OrderStateService
{
    public function __construct(
        protected StockService $stockService,
        protected OrderFulfillmentService $orderFulfillmentService
    ) {}

    public function updateStatus(Order $order, string $toStatus, User $user, ?string $note = null): Order
    {
        $allowed = ['draft', 'pending', 'confirmed', 'prepared', 'shipped', 'cancelled', 'returned', 'delivered', 'other'];
        if (! in_array($toStatus, $allowed, true)) {
            throw new RuntimeException('Invalid order status.');
        }

        return DB::transaction(function () use ($order, $toStatus, $user, $note) {
            /** @var Order $locked */
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $from = $locked->status;

            if ($from === $toStatus) {
                return $locked;
            }

            if ($toStatus === 'shipped' && $from === 'confirmed') {
                // reservation already held at confirm; no extra stock move
            }

            if ($toStatus === 'confirmed' && in_array($from, ['pending', 'draft'], true)) {
                $locked->load(['lines.product']);
                foreach ($locked->lines as $line) {
                    if ($line->product_id && $line->product) {
                        $this->stockService->reserveForOrderLine($line->product, $line->quantity, $locked, $user);
                    }
                }
                $locked->confirmed_at = now();
            }

            if ($toStatus === 'cancelled' && in_array($from, ['confirmed', 'prepared', 'shipped'], true)) {
                $locked->load(['lines.product']);
                foreach ($locked->lines as $line) {
                    if ($line->product_id && $line->product) {
                        $this->stockService->releaseForOrderLine($line->product, $line->quantity, $locked, $user);
                    }
                }
            }

            if ($toStatus === 'delivered' && $from !== 'delivered') {
                $locked->delivered_at = $locked->delivered_at ?? now();
                $this->orderFulfillmentService->dispatchStockForDeliveredOrder($locked, $user);
            }

            if ($toStatus === 'returned') {
                if ($from === 'delivered') {
                    $this->orderFulfillmentService->returnStockAfterDeliveredOrder($locked, $user);
                } elseif ($from === 'confirmed') {
                    $this->orderFulfillmentService->releaseReservationsForCancelledOrReturnedOrder($locked, $user);
                }
            }

            $locked->status = $toStatus;
            $locked->save();

            OrderEvent::query()->create([
                'order_id' => $locked->id,
                'actor_user_id' => $user->id,
                'event_type' => 'status_changed',
                'from_status' => $from,
                'to_status' => $toStatus,
                'note' => $note,
                'event_at' => now(),
            ]);

            return $locked->fresh(['lines', 'events']);
        });
    }

    public function recalculateTotals(Order $order): Order
    {
        $order->loadMissing('lines');
        $subtotal = round($order->lines->sum('line_total'), 2);
        $order->subtotal = $subtotal;
        $order->total = round($subtotal - (float) $order->discount + (float) $order->shipping_fee, 2);
        $order->save();

        return $order;
    }
}
