<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Leads created automatically (conversation, backfills) were assigned to the
// agent or the creator. They must start "non assigné" so anyone can take them.
// Leads assigned by hand are left untouched.
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leads')) {
            return;
        }

        DB::table('leads')
            ->whereNotNull('assigned_user_id')
            ->where('notes', 'like', 'Lead auto-créé%')
            ->update(['assigned_user_id' => null, 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
