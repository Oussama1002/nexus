<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Une formation a une heure de début et de fin : les colonnes DATE les
 * perdaient, et la durée devait être saisie à la main.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql' || ! Schema::hasTable('hr_training_records')) {
            return;
        }

        foreach (['start_date', 'end_date'] as $column) {
            if (! Schema::hasColumn('hr_training_records', $column)) {
                continue;
            }

            $type = DB::selectOne(
                'SELECT DATA_TYPE AS data_type FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
                ['hr_training_records', $column]
            );

            if ($type && strtolower((string) $type->data_type) === 'date') {
                DB::statement("ALTER TABLE `hr_training_records` MODIFY `{$column}` DATETIME NULL");
            }
        }
    }

    public function down(): void
    {
        // On ne revient pas à DATE : l'heure serait perdue.
    }
};
