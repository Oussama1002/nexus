<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        // On passe de ENUM a VARCHAR (convention projet) : ajouter un statut
        // ne demande plus de migrer l'ENUM. Couvre programmé/reporté et la suite.
        DB::statement("ALTER TABLE orders MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        // Les commandes 'scheduled'/'postponed' redeviennent 'pending' pour
        // rentrer dans l'ancien ENUM.
        DB::statement("UPDATE orders SET status = 'pending' WHERE status IN ('scheduled', 'postponed')");
        DB::statement("ALTER TABLE orders MODIFY COLUMN status ENUM(
            'draft',
            'pending',
            'confirmed',
            'prepared',
            'shipped',
            'cancelled',
            'returned',
            'delivered',
            'other'
        ) NOT NULL DEFAULT 'pending'");
    }
};
