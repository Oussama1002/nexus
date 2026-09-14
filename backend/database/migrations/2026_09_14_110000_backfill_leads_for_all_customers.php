<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// The sales pipeline should include every real client, whichever channel
// brought them in — WhatsApp, carrier imports (Ameex, Sendit, Cathedis),
// manual entry. This backfills a lead for any customer that doesn't have
// one yet, sourced from client_source (or "Import" as a fallback).
return new class extends Migration
{
    public function up(): void
    {
        $schema = DB::getSchemaBuilder();
        if (! $schema->hasTable('leads') || ! $schema->hasTable('customers')) {
            return;
        }

        $rows = DB::table('customers')
            ->leftJoin('leads', function ($join) {
                $join->on('leads.customer_id', '=', 'customers.id')
                    ->on('leads.brand_id', '=', 'customers.brand_id');
            })
            ->whereNull('leads.id')
            ->whereNotNull('customers.brand_id')
            ->select('customers.id', 'customers.brand_id', 'customers.client_source', 'customers.created_at')
            ->get();

        $now = now();
        $inserts = [];
        foreach ($rows as $row) {
            $source = match (strtolower((string) ($row->client_source ?? ''))) {
                'whatsapp' => 'WhatsApp',
                'carrier_import' => 'Livraison',
                'manual', '' => 'Manuel',
                default => (string) $row->client_source,
            };
            $inserts[] = [
                'brand_id' => $row->brand_id,
                'customer_id' => $row->id,
                'source' => $source,
                'status' => 'new',
                'notes' => 'Lead auto-créé (backfill) depuis un client existant (source : ' . $source . ').',
                'first_contact_at' => $row->created_at ?? $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        if (! empty($inserts)) {
            foreach (array_chunk($inserts, 500) as $chunk) {
                DB::table('leads')->insert($chunk);
            }
        }
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
