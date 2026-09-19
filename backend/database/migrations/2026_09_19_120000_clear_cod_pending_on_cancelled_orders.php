<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasColumn('orders', 'payment_state')) {
            return;
        }

        DB::table('orders')
            ->whereIn('status', ['cancelled', 'returned'])
            ->where('payment_state', 'cod_pending')
            ->update(['payment_state' => 'unpaid', 'updated_at' => now()]);
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
