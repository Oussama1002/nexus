<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders') && ! Schema::hasColumn('orders', 'follow_up_note')) {
            Schema::table('orders', function (Blueprint $table) {
                // Note de suivi courte, visible dans la liste (spec §6.1).
                $table->string('follow_up_note', 255)->nullable()->after('notes');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('orders') && Schema::hasColumn('orders', 'follow_up_note')) {
            Schema::table('orders', function (Blueprint $table) {
                $table->dropColumn('follow_up_note');
            });
        }
    }
};
