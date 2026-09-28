<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Réapprovisionnement automatique : un produit sans fournisseur rattaché doit
 * quand même produire une commande fournisseur en brouillon, à compléter.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql' || ! Schema::hasTable('purchase_orders')) {
            return;
        }

        $column = DB::selectOne(
            'SELECT IS_NULLABLE AS is_nullable, COLUMN_TYPE AS column_type
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            ['purchase_orders', 'supplier_id']
        );

        if (! $column || strtoupper((string) $column->is_nullable) === 'YES') {
            return;
        }

        DB::statement('ALTER TABLE `purchase_orders` MODIFY `supplier_id` '.$column->column_type.' NULL');
    }

    public function down(): void
    {
        // On ne remet pas NOT NULL : des brouillons sans fournisseur peuvent exister.
    }
};
