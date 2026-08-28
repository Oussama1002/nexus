<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $definitions = [
            'dashboard' => ['view'],
            'users' => ['view', 'create', 'update', 'delete'],
            'brands' => ['view', 'create', 'update', 'delete'],
            'customers' => ['view', 'create', 'update', 'delete'],
            'leads' => ['view', 'create', 'update', 'delete'],
            'conversations' => ['view', 'create', 'update', 'delete'],
            'orders' => ['view', 'create', 'update', 'delete'],
            'products' => ['view', 'create', 'update', 'delete'],
            'stock' => ['view', 'create', 'update', 'delete'],
            'suppliers' => ['view', 'create', 'update', 'delete'],
            'knowledge_base' => ['view', 'create', 'update', 'delete'],
            'purchase_orders' => ['view', 'create', 'update', 'delete', 'receive'],
            'shipments' => ['view', 'create', 'update', 'delete', 'sync', 'label', 'status'],
            'delivery' => ['dashboard'],
            'delivery_companies' => ['view', 'create', 'update', 'delete'],
            'delivery_payments' => ['view', 'create', 'update', 'delete', 'reconcile'],
            'campaigns' => ['view', 'create', 'update', 'delete'],
            'ad_accounts' => ['view', 'create', 'update', 'delete'],
            'campaign_metrics' => ['view', 'create', 'update', 'delete'],
            'automations' => ['view', 'create', 'update', 'delete', 'run'],
            'client_portal' => ['view', 'manage'],
            'collab_projects' => ['view', 'create', 'update', 'delete'],
            'social_accounts' => ['view', 'create', 'update', 'delete'],
            'social_publications' => ['view', 'create', 'update', 'delete'],
            'strategies' => ['view', 'create', 'update', 'delete', 'approve'],
            'content_calendar' => ['view', 'create', 'update', 'delete', 'approve'],
            'content_production' => ['view', 'create', 'update', 'delete', 'approve'],
            'cm_tracking' => ['view', 'create', 'update', 'delete', 'approve', 'validate_checklist', 'manage_templates', 'run_automations', 'view_decision_points'],
            'cm_complaints' => ['view', 'create', 'update', 'assign', 'resolve', 'close'],
            'cm_moderation' => ['view', 'create', 'escalate'],
            'cm_notifications' => ['view', 'manage'],
            'influence' => ['view', 'create', 'update', 'delete', 'manage'],
            'influencer_collaborations' => ['view', 'create', 'update', 'delete', 'validate'],
            'influencer_deliverables' => ['view', 'create', 'update', 'delete'],
            'influencer_shipments' => ['view', 'create', 'update', 'delete'],
            'influencer_payments' => ['view', 'create', 'update', 'delete', 'validate'],
            'influencer_documents' => ['view', 'create', 'update', 'delete'],
            'influencer_performance' => ['view', 'create', 'update', 'delete'],
            'influencer_messages' => ['view', 'create', 'update', 'delete'],
            'influencer_complaints' => ['view', 'create', 'update', 'delete'],
            'finance' => ['view', 'create', 'update', 'delete'],
            'accounting' => ['view', 'create', 'update', 'delete'],
            'hr' => ['view', 'create', 'update', 'delete', 'view_salary'],
            'hr_leaves' => ['view', 'create', 'update', 'approve'],
            'hr_recruitment' => ['view', 'create', 'update', 'delete'],
            'hr_onboarding' => ['view', 'create', 'update'],
            'hr_payroll' => ['view', 'create', 'update', 'validate'],
            'hr_training' => ['view', 'create', 'update', 'delete'],
            'hr_evaluations' => ['view', 'create', 'update', 'finalize'],
            'hr_career' => ['view', 'create', 'update'],
            'hr_discipline' => ['view', 'create', 'update', 'cancel'],
            'hr_documents' => ['view', 'create', 'update', 'delete'],
            'hr_communications' => ['view', 'create', 'update', 'publish'],
            // ─── SMM (Marketing → Réseaux sociaux → Stratégie & contenu) ───
            'smm_strategy' => ['view', 'create', 'update', 'submit', 'validate'],
            'smm_plans' => ['view', 'create', 'update', 'submit', 'validate'],
            'smm_contents' => ['view', 'create', 'update', 'delete', 'validate', 'transmit'],
            'smm_briefs' => ['view', 'create', 'update'],
            'smm_qc' => ['view', 'run'],
            'smm_publication' => ['view', 'update'],
            'smm_execution' => ['view', 'create', 'escalate'],
            'smm_events' => ['view', 'create', 'update', 'validate'],
            'smm_automations' => ['view', 'create', 'update', 'activate', 'suspend'],
            'smm_veille' => ['view', 'create', 'update'],
            'smm_reports' => ['view', 'create', 'update', 'diffuse'],
            'smm_learnings' => ['view', 'create', 'update'],
            'smm_insights' => ['view', 'create', 'update', 'qualify'],
            // ─── AM (Pilotage de marque / Account Management) ───
            'am_roadmap' => ['view', 'create', 'update', 'close', 'suspend'],
            'am_chantier' => ['view', 'update'],
            'am_gate' => ['view', 'update', 'request_transit', 'validate'],
            'am_derogation' => ['view', 'request', 'decide'],
            'am_deliverable' => ['view', 'create', 'update', 'validate'],
            'am_compliance' => ['view', 'update', 'suspend_lift'],
            'am_decision' => ['view', 'create'],
            'am_test' => ['view', 'create', 'verdict'],
            'am_alert' => ['view', 'take', 'resolve', 'escalate'],
            'am_report_client' => ['view', 'create', 'validate', 'publish'],
            'am_client_meeting' => ['view', 'create'],
            'am_config' => ['view', 'update'],
            // Finance extensions
            'treasury' => ['view', 'create', 'update', 'delete'],
            'budgets' => ['view', 'create', 'update', 'delete'],
            'budget_requests' => ['view', 'create', 'update', 'approve'],
            // Operations extensions
            'returns' => ['view', 'create', 'update'],
            'delivery_failures' => ['view', 'create', 'update'],
            'bugs_incidents' => ['view', 'create', 'update', 'delete'],
            'team_performance' => ['view'],
            // Academy extensions
            'learning_paths' => ['view', 'create', 'update', 'delete'],
            'academy_contents' => ['view', 'create', 'update', 'delete'],
            'reports' => ['view', 'create', 'update', 'delete'],
            'academy_courses' => ['view', 'create', 'update', 'delete', 'publish', 'archive'],
            'academy_lessons' => ['view', 'create', 'update', 'delete'],
            'audit_logs' => ['view'],
            'settings' => ['view', 'create', 'update', 'delete'],
            'roles' => ['view', 'update'],
            'permissions' => ['view'],
        ];

        foreach ($definitions as $module => $actions) {
            foreach ($actions as $action) {
                $slug = "{$module}.{$action}";
                Permission::updateOrCreate(
                    ['slug' => $slug],
                    [
                        'name' => str_replace('_', ' ', ucfirst($module)).' — '.ucfirst($action),
                        'module' => $module,
                        'description' => "Permission {$slug}",
                    ]
                );
            }
        }
    }
}
