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

            // Un pack n'a pas de stock propre : ce sont ses composants qu'il
            // faut reapprovisionner, et c'est eux que le fournisseur vend.
            $needed = [];
            foreach ($order->lines as $line) {
                if (! $line->product_id) {
                    continue;
                }
                $product = Product::query()->find($line->product_id);
                if (! $product) {
                    continue;
                }

                foreach ($this->explodePack($product, (int) $line->quantity) as $componentId => $qty) {
                    $needed[$componentId] = ($needed[$componentId] ?? 0) + $qty;
                }
            }

            $shortages = [];
            foreach ($needed as $productId => $ordered) {
                $product = Product::query()->find($productId);
                if (! $product) {
                    continue;
                }

                $available = max(0, (int) $product->stock_quantity - (int) $product->reserved_quantity);
                $missing = $ordered - $available;
                if ($missing > 0) {
                    $shortages[] = ['product' => $product, 'missing' => $missing, 'ordered' => $ordered];
                }
            }

            if ($shortages === []) {
                return;
            }

            $created = $this->createPurchaseOrders($order, $shortages, $actor);
            $this->notify($order, $shortages, $created, $actor);

            app(\App\Services\AutomationEngineService::class)->runForEvent(
                (int) $order->brand_id,
                'stock.shortage',
                [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'products_missing' => count($shortages),
                    'purchase_orders' => implode(', ', $created),
                    'products' => collect($shortages)
                        ->map(fn ($s) => $s['product']->name.' ('.$s['missing'].')')
                        ->join(', '),
                ]
            );

            Log::info('stock.shortage_handled', [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'shortages' => count($shortages),
                'purchase_orders' => $created,
            ]);
        } catch (\Throwable $e) {
            // Ne jamais faire échouer la commande à cause du réapprovisionnement.
            Log::warning('stock.shortage_handling_failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Quantites reellement a reapprovisionner pour un produit commande :
     * ses composants s'il s'agit d'un pack, lui-meme sinon. Un pack dont un
     * composant est lui-meme un pack est descendu recursivement.
     *
     * @return array<int, int>  product_id => quantite
     */
    private function explodePack(Product $product, int $quantity, int $depth = 0): array
    {
        $items = $product->pack_items;
        if (is_string($items)) {
            $items = json_decode($items, true);
        }

        // Garde-fou : un pack qui se contiendrait lui-meme boucherait a l'infini.
        if (! is_array($items) || $items === [] || $depth > 3) {
            return [(int) $product->id => $quantity];
        }

        $needed = [];
        foreach ($items as $item) {
            $componentId = (int) (is_array($item) ? ($item['product_id'] ?? 0) : 0);
            $componentQty = (int) (is_array($item) ? ($item['quantity'] ?? 1) : 1);
            if ($componentId <= 0 || $componentQty <= 0) {
                continue;
            }

            $component = Product::query()->find($componentId);
            if (! $component) {
                continue;
            }

            foreach ($this->explodePack($component, $componentQty * $quantity, $depth + 1) as $id => $qty) {
                $needed[$id] = ($needed[$id] ?? 0) + $qty;
            }
        }

        return $needed === [] ? [(int) $product->id => $quantity] : $needed;
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
            // Produit sans fournisseur : la commande fournisseur est quand même
            // créée en brouillon, le fournisseur sera choisi à la validation.
            $note = 'Créée automatiquement : stock insuffisant pour la commande '.$order->order_number.'.'
                .($supplierId === '' ? ' Fournisseur à renseigner (aucun rattaché au produit).' : '');

            DB::transaction(function () use ($order, $group, $supplierId, $actor, $note, &$references) {
                $po = PurchaseOrder::query()->create([
                    'brand_id' => $order->brand_id,
                    'supplier_id' => $supplierId === '' ? null : (int) $supplierId,
                    'created_by' => $actor?->id,
                    'reference' => PurchaseOrderService::generateReference(),
                    'status' => 'draft',
                    'currency' => $order->currency ?? 'MAD',
                    'internal_notes' => $note,
                ]);

                $subtotal = 0.0;
                foreach ($group as $shortage) {
                    /** @var Product $product */
                    $product = $shortage['product'];
                    // Aucun montant devine : ce qu'on doit au fournisseur se
                    // negocie et ne se deduit pas d'une valeur du catalogue.
                    // A 0, la ligne reste vide jusqu'a la saisie du tarif.
                    $unit = 0.0;
                    $lineTotal = 0.0;

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
                : 'Aucune commande fournisseur créée.');

        $sender = $actor?->id ?? User::query()->whereHas('roles', fn ($q) => $q->where('slug', 'admin'))->value('id');
        if (! $sender) {
            return;
        }

        // Destinataires : ceux qui gèrent le stock / les achats.
        $recipients = User::query()
            ->whereHas('roles', fn ($q) => $q->whereIn('slug', ['admin', 'stock_manager', 'manager_operationnel']))
            ->where('id', '!=', $sender)
            ->pluck('id');

        // Personne d'autre à prévenir : l'auteur de la commande reçoit l'alerte,
        // sinon la rupture passe totalement inaperçue.
        if ($recipients->isEmpty()) {
            $recipients = collect([$sender]);
        }

        foreach ($recipients as $recipientId) {
            InternalMessage::query()->create([
                'sender_id' => $sender,
                'receiver_id' => $recipientId,
                'body' => $body,
            ]);
        }
    }
}
