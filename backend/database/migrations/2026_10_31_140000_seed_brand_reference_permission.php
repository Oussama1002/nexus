<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Permission de consultation de la fiche de référence marque (spec Droits CM §6).
        $perm = Permission::query()->firstOrCreate(
            ['slug' => 'brand_reference.view'],
            ['name' => 'Consulter la fiche de référence marque', 'module' => 'brand_reference'],
        );

        // Accordée aux rôles sociaux : CM (lecture seule), SMM et manager opérationnel.
        foreach (['community_manager', 'smm', 'manager_operationnel'] as $slug) {
            $role = Role::query()->where('slug', $slug)->first();
            $role?->permissions()->syncWithoutDetaching([$perm->id]);
        }
    }

    public function down(): void
    {
        // Non destructif : on ne retire ni la permission ni ses attributions.
    }
};
