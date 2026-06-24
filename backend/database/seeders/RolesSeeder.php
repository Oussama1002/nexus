<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Administrateur', 'slug' => 'admin'],
            ['name' => 'Manager opérationnel', 'slug' => 'manager_operationnel'],
            ['name' => 'Confirmatrice', 'slug' => 'confirmatrice'],
            ['name' => 'Responsable media buying', 'slug' => 'media_buyer'],
            ['name' => 'Responsable stock', 'slug' => 'stock_manager'],
            ['name' => 'Community manager', 'slug' => 'community_manager'],
            ['name' => 'Social media manager', 'slug' => 'smm'],
            ['name' => 'Responsable influence', 'slug' => 'influence_manager'],
            ['name' => 'Propriétaire de marque (client)', 'slug' => 'client_brand_owner'],
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
