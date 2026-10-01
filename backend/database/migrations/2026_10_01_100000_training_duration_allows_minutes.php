<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * La durée d'une formation était un entier d'heures : une session d'une
 * demi-heure était enregistrée comme « 1 h ».
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hr_training_records') || ! Schema::hasColumn('hr_training_records', 'duration_hours')) {
            return;
        }
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement('ALTER TABLE hr_training_records MODIFY duration_hours DECIMAL(6,2) NULL');
    }

    public function down(): void
    {
        if (! Schema::hasTable('hr_training_records') || ! Schema::hasColumn('hr_training_records', 'duration_hours')) {
            return;
        }
        if (DB::getDriverName() !== 'mysql') {
            return;
        }
        DB::statement('ALTER TABLE hr_training_records MODIFY duration_hours SMALLINT UNSIGNED NULL');
    }
};
