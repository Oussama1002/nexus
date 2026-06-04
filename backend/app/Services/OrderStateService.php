<?php

namespace App\Services;

use App\Models\ClientInvoice;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class OrderStateService
{
    public function __construct(
        protected StockService $stockService,
        protected OrderFulfillmentService $orderFulfillmentService,
        protected WhatsAppCloudService $whatsAppService,
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

            // Auto-send invoice via WhatsApp when order is confirmed
            if ($toStatus === 'confirmed') {
                try {
                    $this->sendInvoiceViaWhatsApp($locked, $user);
                } catch (\Throwable $e) {
                    Log::warning('invoice.whatsapp_send.failed', [
                        'order_id' => $locked->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

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

    /**
     * Build an invoice text and send it to the client's WhatsApp conversation.
     */
    protected function sendInvoiceViaWhatsApp(Order $order, User $actor): void
    {
        $order->loadMissing(['customer', 'lines']);

        $customer = $order->customer;
        if (! $customer) {
            return;
        }

        // Find existing conversation for this customer + brand
        $conversation = Conversation::query()
            ->where('brand_id', $order->brand_id)
            ->where('customer_id', $customer->id)
            ->where('channel', 'whatsapp')
            ->latest('last_message_at')
            ->first();

        if (! $conversation || ! $conversation->external_thread_id) {
            return; // no WhatsApp conversation to send to
        }

        // Build invoice message
        $linesSummary = $order->lines
            ->map(fn ($l) => sprintf('  • %s × %d — %s MAD', $l->product_name, $l->quantity, number_format((float) $l->line_total, 2, ',', ' ')))
            ->implode("\n");

        $invoice = ClientInvoice::query()->where('order_id', $order->id)->first();
        $invoiceNumber = $invoice?->invoice_number ?? '—';

        $message = implode("\n", [
            '📄 *FACTURE — '.$invoiceNumber.'*',
            '',
            '🛒 *Commande :* '.$order->order_number,
            '👤 *Client :* '.$customer->full_name,
            '',
            '*Détail :*',
            $linesSummary,
            '',
            '📦 Livraison : '.number_format((float) $order->shipping_fee, 2, ',', ' ').' MAD',
            '💰 *Total : '.number_format((float) $order->total, 2, ',', ' ').' MAD*',
            '',
            '💳 Paiement : '.($order->payment_method === 'cod' ? 'COD' : ($order->payment_method === 'transfer' ? 'Virement' : 'Prépayé')),
            '',
            'Merci pour votre confiance ! 🙏',
        ]);

        // Send via WhatsApp
        $externalId = $this->whatsAppService->sendText(
            $order->brand_id,
            $conversation->external_thread_id,
            $message
        );

        // Store message in conversation
        Message::query()->create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => $actor->id,
            'direction' => 'outbound',
            'content' => $message,
            'message_type' => 'text',
            'external_message_id' => $externalId ?: null,
            'sent_at' => now(),
        ]);

        $conversation->last_message_at = now();
        $conversation->save();

        // Update invoice status
        if ($invoice) {
            $invoice->status = 'sent';
            $invoice->sent_at = now();
            $invoice->save();
        }
    }
}
