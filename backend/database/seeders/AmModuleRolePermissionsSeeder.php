<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Wires the new `account_manager` role and grants AM module permissions
 * to it, the Manager OPS, and the Direction (admin). Idempotent.
 */
class AmModuleRolePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $accountManager = Role::query()->updateOrCreate(
            ['slug' => 'account_manager'],
            [
                'name' => 'Account Manager',
                'description' => 'Pilote une marque de bout en bout (feuille de route, comité, rapports).',
            ],
        );

        $bySlug = fn (array $slugs) => Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();

        // Full-power AM permissions except validations reserved to Direction/OPS.
        $amBase = [
            'am_roadmap.view', 'am_roadmap.create', 'am_roadmap.update',
            'am_chantier.view', 'am_chantier.update',
            'am_gate.view', 'am_gate.update', 'am_gate.request_transit',
            'am_derogation.view', 'am_derogation.request',
            'am_deliverable.view', 'am_deliverable.create', 'am_deliverable.update', 'am_deliverable.validate',
            'am_compliance.view', 'am_compliance.update',
            'am_decision.view', 'am_decision.create',
            'am_test.view', 'am_test.create', 'am_test.verdict',
            'am_alert.view', 'am_alert.take', 'am_alert.resolve',
            'am_report_client.view', 'am_report_client.create',
            'am_client_meeting.view', 'am_client_meeting.create',
        ];
        $accountManager->permissions()->syncWithoutDetaching($bySlug($amBase));

        // Manager OPS gets full AM control except the report publish & Direction-only gates.
        $ops = Role::query()->where('slug', 'manager_operationnel')->first();
        if ($ops) {
            $opsSlugs = array_merge($amBase, [
                'am_roadmap.close', 'am_roadmap.suspend',
                'am_gate.validate',           // for OPS gates (G0, G3, G4, G5, G6, G7)
                'am_derogation.decide',
                'am_compliance.suspend_lift',
                'am_alert.escalate',
                'am_report_client.validate',
                'am_config.view',
            ]);
            $ops->permissions()->syncWithoutDetaching($bySlug($opsSlugs));
        }

        // Direction (admin) already gets everything via hasPermissionSlug()'s isAdmin() shortcut.
        // We still explicitly grant am_config.update so Direction users can edit templates.
        $admin = Role::query()->where('slug', 'admin')->first();
        if ($admin) {
            $admin->permissions()->syncWithoutDetaching($bySlug([
                'am_config.view', 'am_config.update',
                'am_report_client.publish',
            ]));
        }

        // Client (brand owner) gets read-only surface on their own reports.
        $client = Role::query()->where('slug', 'client_brand_owner')->first();
        if ($client) {
            $client->permissions()->syncWithoutDetaching($bySlug([
                'am_roadmap.view', 'am_report_client.view',
            ]));
        }
    }
}
