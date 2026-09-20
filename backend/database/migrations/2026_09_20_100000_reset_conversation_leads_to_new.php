<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// 2026_09_19_100000 confirmed every auto-created lead whose customer had a
// parcel, including leads born from a conversation. Those must stay "new"
// until the agent confirms the conversation itself.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leads') || ! Schema::hasTable('conversations')) {
            return;
        }

        $ids = DB::table('leads')
            ->where('leads.status', 'confirmed')
            ->whereNotIn('leads.source', ['Ameex', 'Sendit', 'Livraison'])
            ->where('leads.notes', 'like', 'Lead auto-créé%')
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('conversations')
                ->whereColumn('conversations.customer_id', 'leads.customer_id')
                ->whereColumn('conversations.brand_id', 'leads.brand_id')
                ->whereNotIn('conversations.status', ['confirme', 'livre']))
            ->pluck('leads.id');

        foreach ($ids->chunk(500) as $chunk) {
            DB::table('leads')->whereIn('id', $chunk)->update(['status' => 'new', 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
