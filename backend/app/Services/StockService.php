<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class StockService
{
    public const MOVEMENT_TYPES = [
        'in',
        'out',
        'reservation',
        'release',
        'adjustment',
        'damaged',
        'returned',
    ];

    /**
     * Record a stock movement (positive quantity). Never updates product stock silently outside this path.
     *
     * @param  array{reference_type?: string|null, reference_id?: int|null, reason?: string|null}  $meta
     */
    public function recordMovement(
        Product $product,
        string $movementType,
        int $quantity,
        ?User $actor,
        array $meta = []
    ): StockMovement {
        if ($quantity <= 0) {
            throw new RuntimeException('Quantity must be positive.');
        }
        if (! in_array($movementType, self::MOVEMENT_TYPES, true)) {
            throw new RuntimeException('Invalid movement type.');
        }
        if ($movementType === 'adjustment') {
            throw new RuntimeException('Use adjustStock() for adjustments.');
        }

        return DB::transaction(function () use ($product, $movementType, $quantity, $actor, $meta) {
            /** @var Product $locked */
            $locked = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();

            $prevStock = (int) $locked->stock_quantity;
            $prevReserved = (int) $locked->reserved_quantity;
            $newStock = $prevStock;
            $newReserved = $prevReserved;

            match ($movementType) {
                'in', 'returned' => $newStock = $prevStock + $quantity,
                'out', 'damaged' => $newStock = $prevStock - $quantity,
                'reservation' => $newReserved = $prevReserved + $quantity,
                'release' => $newReserved = $prevReserved - $quantity,
                default => throw new RuntimeException('Unhandled movement.'),
            };

            if (in_array($movementType, ['out', 'damaged'], true) && $newStock < 0) {
                throw new RuntimeException('Insufficient stock for this movement.');
            }
            if ($movementType === 'release' && $newReserved < 0) {
                throw new RuntimeException('Cannot release more than reserved quantity.');
            }
            if ($movementType === 'reservation') {
                $available = $prevStock - $prevReserved;
                if ($available < $quantity) {
                    throw new RuntimeException('Insufficient available stock for reservation.');
                }
            }

            $locked->stock_quantity = $newStock;
            $locked->reserved_quantity = max(0, $newReserved);
            $locked->save();

            return StockMovement::query()->create([
                'product_id' => $locked->id,
                'brand_id' => $locked->brand_id,
                'actor_user_id' => $actor?->id,
                'movement_type' => $movementType,
                'quantity' => $quantity,
                'previous_stock' => $prevStock,
                'new_stock' => $locked->stock_quantity,
                'reason' => $meta['reason'] ?? null,
                'reference_type' => $meta['reference_type'] ?? null,
                'reference_id' => $meta['reference_id'] ?? null,
                'moved_at' => now(),
            ]);
        });
    }

    /**
     * Signed delta applied to stock_quantity (not reserved).
     */
    public function adjustStock(Product $product, int $signedDelta, ?User $actor, ?string $reason = null): StockMovement
    {
        if ($signedDelta === 0) {
            throw new RuntimeException('Adjustment quantity cannot be zero.');
        }

        return DB::transaction(function () use ($product, $signedDelta, $actor, $reason) {
            /** @var Product $locked */
            $locked = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $prevStock = (int) $locked->stock_quantity;
            $newStock = $prevStock + $signedDelta;
            if ($newStock < 0) {
                throw new RuntimeException('Adjustment would result in negative stock.');
            }
            $locked->stock_quantity = $newStock;
            $locked->save();

            return StockMovement::query()->create([
                'product_id' => $locked->id,
                'brand_id' => $locked->brand_id,
                'actor_user_id' => $actor?->id,
                'movement_type' => 'adjustment',
                'quantity' => abs($signedDelta),
                'previous_stock' => $prevStock,
                'new_stock' => $newStock,
                'reason' => $reason,
                'reference_type' => null,
                'reference_id' => null,
                'moved_at' => now(),
            ]);
        });
    }

    public function reserveForOrderLine(Product $product, int $qty, Order $order, ?User $actor): StockMovement
    {
        return $this->recordMovement($product, 'reservation', $qty, $actor, [
            'reference_type' => 'order',
            'reference_id' => $order->id,
            'reason' => 'order_confirmed',
        ]);
    }

    public function releaseForOrderLine(Product $product, int $qty, Order $order, ?User $actor): StockMovement
    {
        return $this->recordMovement($product, 'release', $qty, $actor, [
            'reference_type' => 'order',
            'reference_id' => $order->id,
            'reason' => 'order_cancelled',
        ]);
    }
}
