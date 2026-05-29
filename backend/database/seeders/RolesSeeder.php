<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Admin', 'slug' => 'admin'],
            ['name' => 'Manager Opérationnel', 'slug' => 'manager_operationnel'],
            ['name' => 'Confirmatrice', 'slug' => 'confirmatrice'],
            ['name' => 'Media Buyer', 'slug' => 'media_buyer'],
            ['name' => 'Stock Manager', 'slug' => 'stock_manager'],
            ['name' => 'Community Manager', 'slug' => 'community_manager'],
            ['name' => 'SMM', 'slug' => 'smm'],
            ['name' => 'Influence Manager', 'slug' => 'influence_manager'],
            ['name' => 'Client Brand Owner', 'slug' => 'client_brand_owner'],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['slug' => $role['slug']],
                [
                    'name' => $role['name'],
                    'description' => $role['name'],
                ]
            );
        }
    }
}
