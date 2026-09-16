<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Clients imported from the carrier APIs (Ameex, Sendit) are already
// confirmed: they have a shipment on record. The initial backfill created
// their leads as "new" — promote those to "confirmed".
return new class extends Migration
{
    public function up(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('leads')
            || ! DB::getSchemaBuilder()->hasTable('customers')) {
            return;
        }

        DB::table('leads')
            ->join('customers', 'customers.id', '=', 'leads.customer_id')
            ->where('leads.status', 'new')
            ->whereIn('leads.source', ['Ameex', 'Sendit', 'Livraison'])
            ->orWhere(function ($q) {
                $q->where('leads.status', 'new')
                    ->where('customers.client_source', 'carrier_import');
            })
            ->update(['leads.status' => 'confirmed', 'leads.updated_at' => now()]);
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
