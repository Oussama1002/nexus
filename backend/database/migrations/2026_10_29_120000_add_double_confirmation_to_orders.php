<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            // Double confirmation (spec Confirmatrice §6.1/6.2/6.8) :
            // NULL = non applicable, 'pending' = à faire, 'done' = faite.
            if (! Schema::hasColumn('orders', 'double_confirmation_status')) {
                $table->string('double_confirmation_status', 20)->nullable()->after('confirmed_at');
            }
            if (! Schema::hasColumn('orders', 'double_confirmed_at')) {
                $table->timestamp('double_confirmed_at')->nullable()->after('double_confirmation_status');
            }
            if (! Schema::hasColumn('orders', 'double_confirmed_by')) {
                $table->unsignedBigInteger('double_confirmed_by')->nullable()->after('double_confirmed_at');
            }
        });

        // Les commandes actuellement confirmées (pas encore expédiées) entrent
        // en double confirmation « À faire ». On ne touche pas aux commandes
        // déjà expédiées/livrées pour ne pas inonder la liste du superviseur.
        DB::table('orders')
            ->where('status', 'confirmed')
            ->whereNull('double_confirmation_status')
            ->update(['double_confirmation_status' => 'pending']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('orders')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            foreach (['double_confirmation_status', 'double_confirmed_at', 'double_confirmed_by'] as $col) {
                if (Schema::hasColumn('orders', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
