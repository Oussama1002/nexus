<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Une réservation ne touche pas stock_quantity mais reserved_quantity : sans
 * ces colonnes, « Stock avant → après » affichait 10 → 10 pour un mouvement
 * qui avait pourtant bien eu lieu.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('stock_movements')) {
            return;
        }

        Schema::table('stock_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('stock_movements', 'previous_reserved')) {
                $table->integer('previous_reserved')->nullable()->after('new_stock');
            }
            if (! Schema::hasColumn('stock_movements', 'new_reserved')) {
                $table->integer('new_reserved')->nullable()->after('previous_reserved');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('stock_movements')) {
            return;
        }

        Schema::table('stock_movements', function (Blueprint $table) {
            foreach (['previous_reserved', 'new_reserved'] as $column) {
                if (Schema::hasColumn('stock_movements', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
