<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * orders.status et order_events.from_status/to_status étaient des ENUM créés
 * avant les statuts « prepared » et « shipped » : l'envoi au transporteur
 * échouait sur « Data truncated for column 'to_status' ». Passage en VARCHAR,
 * conformément à la convention du projet.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        $targets = [
            'orders' => ['status'],
            'order_events' => ['from_status', 'to_status'],
        ];

        foreach ($targets as $table => $columns) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            foreach ($columns as $column) {
                if (! Schema::hasColumn($table, $column)) {
                    continue;
                }

                $definition = DB::selectOne(
                    'SELECT COLUMN_TYPE AS column_type, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default
                     FROM INFORMATION_SCHEMA.COLUMNS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
                    [$table, $column]
                );

                if (! $definition || ! str_starts_with(strtolower((string) $definition->column_type), 'enum')) {
                    continue;
                }

                $null = strtoupper((string) $definition->is_nullable) === 'YES' ? 'NULL' : 'NOT NULL';
                $default = $definition->column_default !== null
                    ? ' DEFAULT '.DB::getPdo()->quote((string) $definition->column_default)
                    : '';

                DB::statement("ALTER TABLE `{$table}` MODIFY `{$column}` VARCHAR(40) {$null}{$default}");
            }
        }
    }

    public function down(): void
    {
        // Pas de retour à l'ENUM : il rejetterait les lignes « shipped ».
    }
};
