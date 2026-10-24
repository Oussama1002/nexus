<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Crée deux règles d'automatisation prêtes à l'emploi, que l'admin peut ensuite
 * modifier (seuils, message, activation) dans l'écran Automatisations :
 *   1. Retards répétés  → ouvre un dossier disciplinaire.
 *   2. Absences injustifiées répétées → ouvre un dossier disciplinaire.
 * Idempotent : on n'insère que si une règle du même nom n'existe pas déjà.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('automation_rules')) {
            return;
        }

        $now = now();

        $rules = [
            [
                'name' => 'Retards répétés → dossier disciplinaire',
                'description' => "Ouvre automatiquement un dossier disciplinaire quand un employé cumule au moins 3 retards sur 30 jours glissants. Seuil modifiable ci-dessous.",
                'trigger_key' => 'attendance.marked',
                'condition_json' => json_encode([
                    'all' => [
                        ['field' => 'event.status', 'op' => 'eq', 'value' => 'late'],
                        ['field' => 'metrics.late_count_30d', 'op' => 'gte', 'value' => 3],
                    ],
                ]),
                'action_json' => json_encode([
                    'type' => 'open_discipline',
                    'target' => 'employee',
                    'incident_type' => 'retards_repetes',
                    'message' => 'Retards répétés constatés sur les 30 derniers jours (seuil atteint). Dossier ouvert pour instruction.',
                ]),
            ],
            [
                'name' => 'Absences injustifiées → dossier disciplinaire',
                'description' => "Ouvre automatiquement un dossier disciplinaire quand un employé cumule au moins 2 absences injustifiées sur 30 jours glissants. Seuil modifiable ci-dessous.",
                'trigger_key' => 'attendance.marked',
                'condition_json' => json_encode([
                    'all' => [
                        ['field' => 'event.status', 'op' => 'eq', 'value' => 'absent'],
                        ['field' => 'metrics.unjustified_absent_count_30d', 'op' => 'gte', 'value' => 2],
                    ],
                ]),
                'action_json' => json_encode([
                    'type' => 'open_discipline',
                    'target' => 'employee',
                    'incident_type' => 'absences_repetees',
                    'message' => 'Absences injustifiées répétées sur les 30 derniers jours (seuil atteint). Dossier ouvert pour instruction.',
                ]),
            ],
        ];

        foreach ($rules as $rule) {
            $exists = DB::table('automation_rules')->where('name', $rule['name'])->exists();
            if ($exists) {
                continue;
            }

            DB::table('automation_rules')->insert(array_merge($rule, [
                'brand_id' => null,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]));
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('automation_rules')) {
            return;
        }

        DB::table('automation_rules')->whereIn('name', [
            'Retards répétés → dossier disciplinaire',
            'Absences injustifiées → dossier disciplinaire',
        ])->delete();
    }
};
