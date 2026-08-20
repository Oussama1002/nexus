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
