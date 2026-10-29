<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            // Échéance de rappel (spec §6.2/6.3) : date de livraison prévue pour
            // « Programmé », date de relance pour « Reporté ».
            if (! Schema::hasColumn('orders', 'follow_up_date')) {
                $table->date('follow_up_date')->nullable()->after('follow_up_note');
            }
            // Rappel traité (sort de la liste « À faire aujourd'hui »).
            if (! Schema::hasColumn('orders', 'follow_up_handled_at')) {
                $table->timestamp('follow_up_handled_at')->nullable()->after('follow_up_date');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            foreach (['follow_up_date', 'follow_up_handled_at'] as $col) {
                if (Schema::hasColumn('orders', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
