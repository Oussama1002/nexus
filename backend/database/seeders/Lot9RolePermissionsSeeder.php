<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Grants the granular permissions added by the HR full spec, SMM full spec,
 * Finance extensions (treasury/budgets), Operations extensions (returns,
 * delivery failures, bugs, team performance), and Academy extensions
 * (learning paths, contents) to the roles that actually use them.
 *
 * Without this, only admins bypass the middleware and non-admin managers
 * see empty screens or 403s on modules like Postes ouverts, Candidatures,
 * Intégration, Trésorerie, etc.
 */
class Lot9RolePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $bySlug = fn (array $slugs) => Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();

        // ─── HR granular (for manager_operationnel + admins) ───
        $hrFull = [
            'hr.view', 'hr.create', 'hr.update', 'hr.delete', 'hr.view_salary',
            'hr_leaves.view', 'hr_leaves.create', 'hr_leaves.update', 'hr_leaves.approve',
            'hr_recruitment.view', 'hr_recruitment.create', 'hr_recruitment.update', 'hr_recruitment.delete',
            'hr_onboarding.view', 'hr_onboarding.create', 'hr_onboarding.update',
            'hr_payroll.view', 'hr_payroll.create', 'hr_payroll.update', 'hr_payroll.validate',
            'hr_training.view', 'hr_training.create', 'hr_training.update', 'hr_training.delete',
            'hr_evaluations.view', 'hr_evaluations.create', 'hr_evaluations.update', 'hr_evaluations.finalize',
            'hr_career.view', 'hr_career.create', 'hr_career.update',
            'hr_discipline.view', 'hr_discipline.create', 'hr_discipline.update', 'hr_discipline.cancel',
            'hr_documents.view', 'hr_documents.create', 'hr_documents.update', 'hr_documents.delete',
            'hr_communications.view', 'hr_communications.create', 'hr_communications.update', 'hr_communications.publish',
        ];

        // ─── SMM granular (for smm + manager_operationnel view) ───
        $smmFull = [
            'smm_strategy.view', 'smm_strategy.create', 'smm_strategy.update', 'smm_strategy.submit', 'smm_strategy.validate',
            'smm_plans.view', 'smm_plans.create', 'smm_plans.update', 'smm_plans.submit', 'smm_plans.validate',
            'smm_contents.view', 'smm_contents.create', 'smm_contents.update', 'smm_contents.delete', 'smm_contents.validate', 'smm_contents.transmit',
            'smm_briefs.view', 'smm_briefs.create', 'smm_briefs.update',
            'smm_qc.view', 'smm_qc.run',
            'smm_publication.view', 'smm_publication.update',
            'smm_execution.view', 'smm_execution.create', 'smm_execution.escalate',
            'smm_events.view', 'smm_events.create', 'smm_events.update', 'smm_events.validate',
            'smm_automations.view', 'smm_automations.create', 'smm_automations.update', 'smm_automations.activate', 'smm_automations.suspend',
            'smm_veille.view', 'smm_veille.create', 'smm_veille.update',
            'smm_reports.view', 'smm_reports.create', 'smm_reports.update', 'smm_reports.diffuse',
            'smm_learnings.view', 'smm_learnings.create', 'smm_learnings.update',
            'smm_insights.view', 'smm_insights.create', 'smm_insights.update', 'smm_insights.qualify',
        ];

        $smmViewOnly = array_values(array_filter($smmFull, fn ($p) => str_ends_with($p, '.view')));

        // ─── Finance extensions ───
        $financeExt = [
            'treasury.view', 'treasury.create', 'treasury.update', 'treasury.delete',
            'budgets.view', 'budgets.create', 'budgets.update', 'budgets.delete',
            'budget_requests.view', 'budget_requests.create', 'budget_requests.update', 'budget_requests.approve',
        ];

        // ─── Operations extensions ───
        $opsExt = [
            'returns.view', 'returns.create', 'returns.update',
            'delivery_failures.view', 'delivery_failures.create', 'delivery_failures.update',
            'bugs_incidents.view', 'bugs_incidents.create', 'bugs_incidents.update',
            'team_performance.view',
        ];

        // ─── Academy extensions ───
        $academyExt = [
            'learning_paths.view', 'learning_paths.create', 'learning_paths.update', 'learning_paths.delete',
            'academy_contents.view', 'academy_contents.create', 'academy_contents.update', 'academy_contents.delete',
        ];

        // Bugs signalment: give everyone the ability to signal a bug + view their own module
        $bugSignaller = ['bugs_incidents.view', 'bugs_incidents.create'];

        $grants = [
            // manager_operationnel oversees everything except finance validation
            ['slug' => 'manager_operationnel', 'perms' => array_merge(
                $hrFull, $smmViewOnly, $opsExt, $academyExt,
                ['treasury.view', 'budgets.view', 'budget_requests.view', 'budget_requests.approve'],
            )],
            // SMM role gets the full SMM stack
            ['slug' => 'smm', 'perms' => $smmFull],
            // Community manager can execute, veille, contribute to library
            ['slug' => 'community_manager', 'perms' => array_merge(
                [
                    'smm_contents.view', 'smm_execution.view', 'smm_execution.create',
                    'smm_veille.view', 'smm_veille.create',
                    'smm_insights.view', 'smm_insights.create',
                ],
                $bugSignaller,
            )],
            // Comptable owns treasury + budgets full stack
            ['slug' => 'comptable', 'perms' => array_merge($financeExt, $bugSignaller)],
            // Stock manager owns returns + delivery failures
            ['slug' => 'stock_manager', 'perms' => array_merge(
                ['returns.view', 'returns.create', 'returns.update',
                 'delivery_failures.view', 'delivery_failures.create', 'delivery_failures.update'],
                $bugSignaller,
            )],
            // Confirmatrice can signal bugs too
            ['slug' => 'confirmatrice', 'perms' => $bugSignaller],
            // Media buyer + influence manager: bug signalment
            ['slug' => 'media_buyer', 'perms' => $bugSignaller],
            ['slug' => 'influence_manager', 'perms' => $bugSignaller],
        ];

        foreach ($grants as $row) {
            $role = Role::query()->where('slug', $row['slug'])->first();
            if ($role) {
                $ids = $bySlug($row['perms']);
                if ($ids) {
                    $role->permissions()->syncWithoutDetaching($ids);
                }
            }
        }
    }
}
