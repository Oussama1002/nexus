<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\LeadEvent;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class LeadService
{
    public function recordEvent(Lead $lead, string $eventType, ?User $actor, ?string $description = null, ?array $payload = null): LeadEvent
    {
        return LeadEvent::query()->create([
            'lead_id' => $lead->id,
            'actor_user_id' => $actor?->id,
            'event_type' => $eventType,
            'description' => $description,
            'payload' => $payload,
            'event_at' => now(),
        ]);
    }

    /**
     * @param  array{lines: array<int, array{product_id?: int|null, product_name: string, quantity: int, unit_price: float|int|string}>, shipping_fee?: float|int|string, discount?: float|int|string, source?: string|null, notes?: string|null, assigned_user_id?: int|null}  $data
     */
    public function convertToOrder(Lead $lead, array $data, User $user): Order
    {
        if (! $lead->customer_id) {
            throw new RuntimeException('Lead must have a customer before conversion.');
        }

        return DB::transaction(function () use ($lead, $data, $user) {
            $lines = $data['lines'] ?? [];
            if ($lines === []) {
                throw new RuntimeException('At least one order line is required.');
            }

            $order = Order::query()->create([
                'brand_id' => $lead->brand_id,
                'customer_id' => $lead->customer_id,
                'lead_id' => $lead->id,
                'assigned_user_id' => $data['assigned_user_id'] ?? $user->id,
                'order_number' => Order::generateUniqueOrderNumber(),
                'source' => $data['source'] ?? $lead->source,
                'status' => 'pending',
                'payment_state' => 'unpaid',
                'subtotal' => 0,
                'shipping_fee' => (float) ($data['shipping_fee'] ?? 0),
                'discount' => (float) ($data['discount'] ?? 0),
                'total' => 0,
                'notes' => $data['notes'] ?? null,
            ]);

            $subtotal = 0;
            foreach ($lines as $line) {
                $qty = (int) ($line['quantity'] ?? 0);
                $unit = (float) ($line['unit_price'] ?? 0);
                if ($qty < 1 || $unit < 0) {
                    throw new RuntimeException('Invalid order line.');
                }
                if (! empty($line['product_id'])) {
                    $pid = (int) $line['product_id'];
                    if (! Product::query()->whereKey($pid)->where('brand_id', $lead->brand_id)->exists()) {
                        throw new RuntimeException('Product '.$pid.' does not belong to this brand.');
                    }
                }
                $lineTotal = round($qty * $unit, 2);
                $subtotal += $lineTotal;
                OrderLine::query()->create([
                    'order_id' => $order->id,
                    'product_id' => isset($line['product_id']) ? (int) $line['product_id'] : null,
                    'product_name' => (string) $line['product_name'],
                    'quantity' => $qty,
                    'unit_price' => $unit,
                    'line_total' => $lineTotal,
                ]);
            }

            $order->subtotal = round($subtotal, 2);
            $order->total = round($order->subtotal - $order->discount + $order->shipping_fee, 2);
            $order->save();

            $lead->update([
                'status' => 'confirmed',
                'closed_at' => now(),
            ]);

            $this->recordEvent($lead, 'converted_to_order', $user, 'Lead converted to order.', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ]);

            return $order->fresh(['lines']);
        });
    }
}
