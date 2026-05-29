<?php

namespace App\Services;

use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class PurchaseOrderService
{
    public function __construct(
        protected StockService $stockService
    ) {}

    public static function generateReference(): string
    {
        for ($i = 0; $i < 12; $i++) {
            $candidate = 'PO-'.now()->format('Ymd').'-'.strtoupper(Str::random(4));
            if (! PurchaseOrder::query()->where('reference', $candidate)->exists()) {
                return $candidate;
            }
        }

        throw new RuntimeException('Could not generate unique PO reference.');
    }

    public function recalculateTotal(PurchaseOrder $po): void
    {
        $po->loadMissing('lines');
        $subtotal = 0.0;
        foreach ($po->lines as $line) {
            $qty = (int) $line->quantity_ordered;
            $unit = (float) $line->unit_price;
            $disc = (float) ($line->line_discount ?? 0);
            $tax = (float) ($line->line_tax ?? 0);
            $lt = round(max(0, $qty * $unit - $disc + $tax), 2);
            $line->line_total = $lt;
            $line->save();
            $subtotal += $lt;
        }

        $po->subtotal = round($subtotal, 2);
        $hdrDisc = (float) ($po->discount ?? 0);
        $hdrTax = (float) ($po->tax ?? 0);
        $ship = (float) ($po->shipping_fee ?? 0);
        $po->total_amount = round(max(0, $po->subtotal - $hdrDisc + $hdrTax + $ship), 2);
        $po->syncPaymentAmounts();
        $po->save();
    }

    /**
     * Receive goods (partial or full). Creates stock movements only for quantities received in this batch.
     *
     * @param  array<int, array{line_id: int, quantity: int}|array<string, mixed>|object  $linesPayload  line_id => qty for this reception
     */
    public function receiveShipment(PurchaseOrder $po, User $actor, array $linesPayload): PurchaseOrder
    {
        $incoming = [];
        foreach ($linesPayload as $row) {
            $arr = is_array($row) ? $row : (array) $row;
            $lid = (int) ($arr['line_id'] ?? $arr['id'] ?? 0);
            $qty = (int) ($arr['quantity'] ?? 0);
            if ($lid > 0) {
                $incoming[$lid] = ($incoming[$lid] ?? 0) + $qty;
            }
        }

        return DB::transaction(function () use ($po, $actor, $incoming) {
            /** @var PurchaseOrder $locked */
            $locked = PurchaseOrder::query()->whereKey($po->id)->lockForUpdate()->with(['lines.product'])->firstOrFail();

            if (in_array($locked->status, ['draft', 'cancelled', 'returned'], true)) {
                throw new RuntimeException('This purchase order cannot be received in its current status.');
            }

            if ($locked->status === 'received') {
                throw new RuntimeException('Purchase order is already fully received.');
            }

            $fullReceive = $incoming === [];

            $moved = false;
            foreach ($locked->lines as $line) {
                $remaining = max(0, (int) $line->quantity_ordered - (int) $line->quantity_received);
                $qtyNow = $fullReceive ? $remaining : (int) ($incoming[$line->id] ?? 0);

                if ($qtyNow < 0) {
                    throw new RuntimeException('Invalid reception quantity.');
                }
                if ($qtyNow > $remaining) {
                    throw new RuntimeException("Quantity exceeds remaining for line #{$line->id}.");
                }

                if ($qtyNow === 0) {
                    continue;
                }

                if (! $line->product) {
                    throw new RuntimeException("Product missing for line #{$line->id}.");
                }

                $this->stockService->recordMovement($line->product, 'in', $qtyNow, $actor, [
                    'reference_type' => 'purchase_order',
                    'reference_id' => $locked->id,
                    'reason' => 'po_receipt',
                ]);

                $line->quantity_received = (int) $line->quantity_received + $qtyNow;
                $line->save();
                $moved = true;
            }

            if (! $moved) {
                throw new RuntimeException('Nothing to receive.');
            }

            $locked->refresh()->load('lines');
            $this->applyReceivedStatus($locked);
            $locked->save();

            return $locked->fresh(['lines.product', 'supplier', 'brand', 'responsibleUser', 'creator']);
        });
    }

    public function applyReceivedStatus(PurchaseOrder $po): void
    {
        $po->loadMissing('lines');
        $allDone = true;
        $anyReceived = false;
        foreach ($po->lines as $line) {
            $q = (int) $line->quantity_ordered;
            $r = (int) $line->quantity_received;
            if ($r > 0) {
                $anyReceived = true;
            }
            if ($q > 0 && $r < $q) {
                $allDone = false;
            }
        }

        if ($anyReceived && $allDone) {
            $po->status = 'received';
            $po->received_at = $po->received_at ?? now();
        } elseif ($anyReceived) {
            $po->status = 'partially_received';
        }
    }

    /** @deprecated use receiveShipment with empty lines for full receive */
    public function markReceived(PurchaseOrder $po, User $actor): PurchaseOrder
    {
        return $this->receiveShipment($po, $actor, []);
    }
}
