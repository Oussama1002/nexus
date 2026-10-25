<?php

use App\Models\ClientInvoice;
use App\Models\Order;
use App\Services\ClientInvoiceService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Backfill : certaines commandes confirmées/livrées (notamment importées par
 * la synchro transporteur) n'avaient pas de facture. On génère la facture
 * manquante (brouillon), et on la passe « Validée » si la commande est livrée.
 * Idempotent : createFromOrder ne crée rien s'il existe déjà une facture.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasTable('client_invoices')) {
            return;
        }

        $service = app(ClientInvoiceService::class);
        $confirmedOrBeyond = ['confirmed', 'scheduled', 'postponed', 'prepared', 'shipped', 'delivered'];

        Order::query()
            ->whereIn('status', $confirmedOrBeyond)
            ->orderBy('id')
            ->chunkById(500, function ($orders) use ($service) {
                foreach ($orders as $order) {
                    $invoice = $service->createFromOrder($order);
                    if (! $invoice) {
                        continue;
                    }
                    if ($order->status === 'delivered'
                        && ! in_array($invoice->status, ['approved', 'sent', 'paid', 'cancelled'], true)) {
                        $invoice->status = 'approved';
                        $invoice->approved_at = $invoice->approved_at ?? ($order->delivered_at ?? now());
                        $invoice->save();
                    }
                }
            });
    }

    public function down(): void
    {
        // Pas de rollback : on ne supprime pas de factures.
    }
};
