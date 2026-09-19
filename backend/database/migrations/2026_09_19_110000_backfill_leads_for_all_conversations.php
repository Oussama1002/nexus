<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Every client with a conversation (any channel, inbound or started from the
// CRM) should appear in Leads. Earlier backfill only covered WhatsApp.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leads') || ! Schema::hasTable('conversations')) {
            return;
        }

        $rows = DB::table('conversations')
            ->whereNotNull('conversations.customer_id')
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('leads')
                ->whereColumn('leads.customer_id', 'conversations.customer_id')
                ->whereColumn('leads.brand_id', 'conversations.brand_id'))
            ->selectRaw('conversations.brand_id, conversations.customer_id, MIN(conversations.channel) AS channel, MAX(conversations.assigned_user_id) AS assigned_user_id')
            ->groupBy('conversations.brand_id', 'conversations.customer_id')
            ->get();

        $now = now();
        foreach ($rows->chunk(500) as $chunk) {
            DB::table('leads')->insert($chunk->map(fn ($r) => [
                'brand_id' => $r->brand_id,
                'customer_id' => $r->customer_id,
                'source' => $r->channel === 'whatsapp' ? 'WhatsApp' : ucfirst((string) $r->channel),
                'status' => 'new',
                'assigned_user_id' => $r->assigned_user_id,
                'notes' => 'Lead auto-créé (backfill) depuis une conversation.',
                'first_contact_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])->values()->all());
        }
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
