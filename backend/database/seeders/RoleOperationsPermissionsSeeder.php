<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleOperationsPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $bySlug = fn (array $slugs) => Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();

        $manager = Role::query()->where('slug', 'manager_operationnel')->first();
        if ($manager) {
            $slugs = [
                'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
                'purchase_orders.view', 'purchase_orders.create', 'purchase_orders.update', 'purchase_orders.delete', 'purchase_orders.receive',
                'shipments.view', 'shipments.create', 'shipments.update', 'shipments.delete', 'shipments.sync',
                'delivery.dashboard',
                'delivery_companies.view', 'delivery_companies.create', 'delivery_companies.update', 'delivery_companies.delete',
                'delivery_payments.view', 'delivery_payments.create', 'delivery_payments.update', 'delivery_payments.delete',
                'orders.view', 'products.view', 'stock.view',
                'knowledge_base.view', 'knowledge_base.create', 'knowledge_base.update',
                'automations.view', 'automations.create', 'automations.update', 'automations.run',
                'collab_projects.view', 'collab_projects.create', 'collab_projects.update',
            ];
            $manager->permissions()->syncWithoutDetaching($bySlug($slugs));
        }

        $stock = Role::query()->where('slug', 'stock_manager')->first();
        if ($stock) {
            $slugs = [
                'suppliers.view', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
                'purchase_orders.view', 'purchase_orders.create', 'purchase_orders.update', 'purchase_orders.delete', 'purchase_orders.receive',
                'shipments.view', 'shipments.create', 'shipments.update', 'shipments.delete', 'shipments.sync',
                'delivery.dashboard',
                'delivery_companies.view', 'delivery_companies.create', 'delivery_companies.update', 'delivery_companies.delete',
                'delivery_payments.view', 'delivery_payments.create', 'delivery_payments.update', 'delivery_payments.delete',
                'orders.view', 'products.view', 'stock.view', 'stock.create', 'stock.update',
                'knowledge_base.view',
                'automations.view', 'automations.run',
                'collab_projects.view',
            ];
            $stock->permissions()->syncWithoutDetaching($bySlug($slugs));
        }

        $conf = Role::query()->where('slug', 'confirmatrice')->first();
        if ($conf) {
            $slugs = [
                'orders.view',
                'shipments.view',
                'conversations.view',
                'conversations.create',
                'customers.view',
                'knowledge_base.view', 'knowledge_base.create', 'knowledge_base.update',
                'automations.view', 'automations.run',
                'collab_projects.view', 'collab_projects.create', 'collab_projects.update',
            ];
            $conf->permissions()->syncWithoutDetaching($bySlug($slugs));
        }

        $admin = Role::query()->where('slug', 'admin')->first();
        if ($admin) {
            $admin->permissions()->syncWithoutDetaching($bySlug(['purchase_orders.receive']));
        }
    }
}
