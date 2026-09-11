<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Track outbound WhatsApp delivery per message so a bubble that "looks
 * sent" but never reached the customer's phone is caught in the UI.
 * WhatsApp Cloud status webhooks flip 'sent' → 'delivered' → 'read', or
 * 'failed' with the Meta error code stored in delivery_error.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('messages')) return;
        Schema::table('messages', function (Blueprint $table) {
            if (! Schema::hasColumn('messages', 'delivery_status')) {
                // null on inbound, one of sent|delivered|read|failed on outbound.
                $table->string('delivery_status', 20)->nullable()->after('external_message_id');
            }
            if (! Schema::hasColumn('messages', 'delivery_error')) {
                $table->text('delivery_error')->nullable()->after('delivery_status');
            }
            if (! Schema::hasColumn('messages', 'delivered_at')) {
                $table->timestamp('delivered_at')->nullable()->after('delivery_error');
            }
            if (! Schema::hasColumn('messages', 'read_at')) {
                $table->timestamp('read_at')->nullable()->after('delivered_at');
            }
        });

        // Best-effort index for status webhook lookups (idempotent).
        try {
            Schema::table('messages', function (Blueprint $table) {
                $table->index('external_message_id', 'messages_external_id_idx');
            });
        } catch (\Throwable $e) { /* index may already exist */ }
    }

    public function down(): void
    {
        if (! Schema::hasTable('messages')) return;
        Schema::table('messages', function (Blueprint $table) {
            foreach (['delivery_status', 'delivery_error', 'delivered_at', 'read_at'] as $col) {
                if (Schema::hasColumn('messages', $col)) $table->dropColumn($col);
            }
        });
    }
};
