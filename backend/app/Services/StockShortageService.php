<?php

namespace App\Services;

use App\Models\InternalMessage;
use App\Models\Order;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Commande passée sur un produit sans stock : crée une commande fournisseur
 * (brouillon) et prévient l'équipe par message interne.
 */
class StockShortageService
{
    public function handleOrder(Order $order, ?User $actor = null): void
    {
        try {
            $order->loadMissing('lines');

            $shortages = [];
            foreach ($order->lines as $line) {
                if (! $line->product_id) {
                    continue;
                }
                $product = Product::query()->find($line->product_id);
                if (! $product) {
                    continue;
                }

                $available = max(0, (int) $product->stock_quantity - (int) $product->reserved_quantity);
                $missing = (int) $line->quantity - $available;
                if ($missing > 0) {
                    $shortages[] = ['product' => $product, 'missing' => $missing, 'ordered' => (int) $line->quantity];
                }
            }

            if ($shortages === []) {
                return;
            }

            $created = $this->createPurchaseOrders($order, $shortages, $actor);
            $this->notify($order, $shortages, $created, $actor);
        } catch (\Throwable $e) {
            // Ne jamais faire échouer la commande à cause du réapprovisionnement.
            Log::warning('stock.shortage_handling_failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Une commande fournisseur par fournisseur concerné.
     *
     * @param  list<array{product: Product, missing: int, ordered: int}>  $shortages
     * @return list<string>  références créées
     */
    private function createPurchaseOrders(Order $order, array $shortages, ?User $actor): array
    {
        $references = [];

        foreach (collect($shortages)->groupBy(fn ($s) => (string) ($s['product']->supplier_id ?? '')) as $supplierId => $group) {
            if ($supplierId === '') {
                // Sans fournisseur rattaché au produit, on ne peut pas créer la
                // commande fournisseur : le message interne le signalera.
                continue;
            }

            DB::transaction(function () use ($order, $group, $supplierId, $actor, &$references) {
                $po = PurchaseOrder::query()->create([
                    'brand_id' => $order->brand_id,
                    'supplier_id' => (int) $supplierId,
                    'created_by' => $actor?->id,
                    'reference' => PurchaseOrderService::generateReference(),
                    'status' => 'draft',
                    'currency' => $order->currency ?? 'MAD',
                    'internal_notes' => 'Créée automatiquement : stock insuffisant pour la commande '.$order->order_number.'.',
                ]);

                $subtotal = 0.0;
                foreach ($group as $shortage) {
                    /** @var Product $product */
                    $product = $shortage['product'];
                    $unit = (float) ($product->price ?? 0);
                    $lineTotal = $unit * $shortage['missing'];
                    $subtotal += $lineTotal;

                    PurchaseOrderLine::query()->create([
                        'purchase_order_id' => $po->id,
                        'product_id' => $product->id,
                        'sku_snapshot' => $product->sku,
                        'product_name_snapshot' => $product->name,
                        'quantity_ordered' => $shortage['missing'],
                        'quantity_received' => 0,
                        'unit_price' => $unit,
                        'line_total' => $lineTotal,
                    ]);
                }

                $po->update([
                    'subtotal' => $subtotal,
                    'total_amount' => $subtotal,
                    'remaining_amount' => $subtotal,
                ]);

                $references[] = $po->reference;
            });
        }

        return $references;
    }

    /**
     * @param  list<array{product: Product, missing: int, ordered: int}>  $shortages
     * @param  list<string>  $references
     */
    private function notify(Order $order, array $shortages, array $references, ?User $actor): void
    {
        $lines = collect($shortages)
            ->map(fn ($s) => '• '.$s['product']->name.' : '.$s['ordered'].' commandé(s), '.$s['missing'].' manquant(s)'
                .($s['product']->supplier_id ? '' : ' — aucun fournisseur rattaché au produit'))
            ->join("\n");

        $body = "Stock insuffisant pour la commande {$order->order_number} :\n{$lines}\n\n"
            .($references !== []
                ? 'Commande(s) fournisseur créée(s) en brouillon : '.implode(', ', $references).'.'
                : 'Aucune commande fournisseur créée : rattachez un fournisseur aux produits concernés.');

        $sender = $actor?->id ?? User::query()->whereHas('roles', fn ($q) => $q->where('slug', 'admin'))->value('id');
        if (! $sender) {
            return;
        }

        // Destinataires : ceux qui gèrent le stock / les achats.
        $recipients = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('slug', ['admin', 'stock_manager', 'manager_operationnel']))
            ->where('id', '!=', $sender)
            ->pluck('id');

        foreach ($recipients as $recipientId) {
            InternalMessage::query()->create([
                'sender_id' => $sender,
                'receiver_id' => $recipientId,
                'body' => $body,
            ]);
        }
    }
}
