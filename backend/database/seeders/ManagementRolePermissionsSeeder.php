<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * HR / Finance / Settings / Audit / Users visibility for non-admin roles (task §8).
 */
class ManagementRolePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $bySlug = fn (array $slugs) => Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();

        $manager = Role::query()->where('slug', 'manager_operationnel')->first();
        if ($manager) {
            $manager->permissions()->syncWithoutDetaching($bySlug([
                'users.view',
                'roles.view',
                'permissions.view',
            ]));
        }

        $comptable = Role::query()->where('slug', 'comptable')->first();
        if ($comptable) {
            $comptable->permissions()->syncWithoutDetaching($bySlug([
                'accounting.view',
                'accounting.create',
                'accounting.update',
                'accounting.delete',
                'finance.view',
                'dashboard.view',
            ]));
        }
    }
}
