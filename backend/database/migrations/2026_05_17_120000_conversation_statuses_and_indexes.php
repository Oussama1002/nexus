<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            try {
                DB::statement("ALTER TABLE conversations MODIFY status VARCHAR(64) NOT NULL DEFAULT 'open'");
            } catch (\Throwable) {
                //
            }
        }

        Schema::table('messages', function (Blueprint $table) {
            $table->index(['conversation_id', 'direction', 'sent_at'], 'messages_conversation_direction_sent_idx');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex('messages_conversation_direction_sent_idx');
        });
    }
};
