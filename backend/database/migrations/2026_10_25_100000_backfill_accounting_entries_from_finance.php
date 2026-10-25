<?php

use App\Models\Charge;
use App\Models\ClientInvoice;
use App\Services\AccountingAutoPostService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Backfill « mirror Finance » : génère les écritures comptables manquantes
 * pour les charges existantes et les factures déjà validées. Idempotent
 * (le service déduplique par référence), donc rejouable sans risque.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('accounting_entries') || ! Schema::hasTable('accounting_accounts')) {
            return;
        }

        $service = app(AccountingAutoPostService::class);

        if (Schema::hasTable('charges')) {
            Charge::query()->where('amount', '>', 0)->orderBy('id')->chunkById(500, function ($charges) use ($service) {
                foreach ($charges as $charge) {
                    $service->postCharge($charge);
                }
            });
        }

        if (Schema::hasTable('client_invoices')) {
            ClientInvoice::query()
                ->whereIn('status', ['approved', 'sent', 'paid'])
                ->orderBy('id')
                ->chunkById(500, function ($invoices) use ($service) {
                    foreach ($invoices as $invoice) {
                        $service->postInvoice($invoice);
                    }
                });
        }
    }

    public function down(): void
    {
        // Pas de rollback : on ne supprime pas d'écritures comptables.
    }
};
