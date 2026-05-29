<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::updateOrCreate(
            ['email' => 'admin@nexus.local'],
            [
                'name' => 'Admin',
                'phone' => null,
                'password' => Hash::make('password'),
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        $adminRole = Role::where('slug', 'admin')->first();
        if ($adminRole) {
            $admin->roles()->syncWithoutDetaching([$adminRole->id]);
            $adminRole->permissions()->sync(Permission::pluck('id')->all());
        }

        $admin->brands()->sync(Brand::query()->pluck('id')->all());
    }
}
