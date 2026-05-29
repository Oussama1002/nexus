<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ClientPortalRolePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $bySlug = fn (array $slugs) => Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();

        $role = Role::query()->where('slug', 'client_brand_owner')->first();
        if ($role) {
            $role->permissions()->syncWithoutDetaching($bySlug([
                'client_portal.view',
                'dashboard.view',
                'reports.view',
            ]));
        }

        $manager = Role::query()->where('slug', 'manager_operationnel')->first();
        if ($manager) {
            $manager->permissions()->syncWithoutDetaching($bySlug([
                'client_portal.manage',
            ]));
        }

        $admin = Role::query()->where('slug', 'admin')->first();
        if ($admin) {
            $admin->permissions()->syncWithoutDetaching($bySlug([
                'client_portal.manage',
            ]));
        }
    }
}
