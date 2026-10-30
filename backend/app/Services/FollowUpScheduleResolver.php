<?php

namespace App\Services;

use App\Models\FollowUpSchedule;
use App\Models\Order;
use Illuminate\Support\Carbon;

class FollowUpScheduleResolver
{
    /** Calendrier GO-CENTER par défaut (spec §6.6) : hebdo J+7→J+42, puis J+57, J+72, puis tous les 30 jours. */
    private const DEFAULT_OFFSETS = [7, 14, 21, 28, 35, 42, 57, 72];

    private const DEFAULT_REPEAT = 30;

    /**
     * Résout le calendrier applicable à une commande : override produit, sinon
     * défaut de la marque, sinon défaut GO-CENTER.
     *
     * @return array{offsets: array<int, int>, repeat_every_days: int|null}
     */
    public function resolveForOrder(Order $order): array
    {
        $productId = $order->relationLoaded('lines')
            ? optional($order->lines->first())->product_id
            : $order->lines()->value('product_id');

        $schedule = null;
        if ($productId) {
            $schedule = FollowUpSchedule::query()
                ->where('brand_id', $order->brand_id)
                ->where('product_id', $productId)
                ->where('is_active', true)
                ->first();
        }
        if (! $schedule) {
            $schedule = FollowUpSchedule::query()
                ->where('brand_id', $order->brand_id)
                ->whereNull('product_id')
                ->where('is_active', true)
                ->first();
        }

        if ($schedule && is_array($schedule->offsets) && $schedule->offsets !== []) {
            $offsets = array_values(array_filter(array_map('intval', $schedule->offsets), fn ($o) => $o >= 0));
            sort($offsets);

            return ['offsets' => $offsets, 'repeat_every_days' => $schedule->repeat_every_days];
        }

        return ['offsets' => self::DEFAULT_OFFSETS, 'repeat_every_days' => self::DEFAULT_REPEAT];
    }

    /**
     * Date d'échéance du suivi n° $sequence (1-indexé) à partir de la livraison.
     * Retourne null quand il n'y a plus de suivi programmé.
     */
    public function dueDateForSequence(Order $order, int $sequence): ?Carbon
    {
        $base = $order->delivered_at ? $order->delivered_at->copy() : Carbon::now();
        $plan = $this->resolveForOrder($order);
        $offsets = $plan['offsets'];
        $count = count($offsets);

        if ($sequence <= $count) {
            return $base->copy()->addDays($offsets[$sequence - 1]);
        }

        if ($plan['repeat_every_days']) {
            $extra = $sequence - $count;
            return $base->copy()->addDays($offsets[$count - 1] + $extra * $plan['repeat_every_days']);
        }

        return null;
    }
}
