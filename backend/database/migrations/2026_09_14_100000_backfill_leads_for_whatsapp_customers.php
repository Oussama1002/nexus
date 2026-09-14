<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Every WhatsApp conversation should have an associated lead so the sales
// pipeline reflects reality. This backfills leads for customers who have
// a WhatsApp conversation but no lead yet (i.e. imported customers, or
// customers created before the auto-lead code shipped).
return new class extends Migration
{
    public function up(): void
    {
        if (! DB::getSchemaBuilder()->hasTable('leads')
            || ! DB::getSchemaBuilder()->hasTable('conversations')
            || ! DB::getSchemaBuilder()->hasTable('customers')) {
            return;
        }

        $rows = DB::table('conversations')
            ->join('customers', 'customers.id', '=', 'conversations.customer_id')
            ->leftJoin('leads', function ($join) {
                $join->on('leads.customer_id', '=', 'conversations.customer_id')
                    ->on('leads.brand_id', '=', 'conversations.brand_id');
            })
            ->whereNull('leads.id')
            ->where('conversations.channel', 'whatsapp')
            ->whereNotNull('conversations.customer_id')
            ->select('conversations.brand_id', 'conversations.customer_id')
            ->distinct()
            ->get();

        $now = now();
        $inserts = [];
        foreach ($rows as $row) {
            $inserts[] = [
                'brand_id' => $row->brand_id,
                'customer_id' => $row->customer_id,
                'source' => 'WhatsApp',
                'status' => 'new',
                'notes' => 'Lead auto-créé (backfill) depuis une conversation WhatsApp.',
                'first_contact_at' => $now,
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
