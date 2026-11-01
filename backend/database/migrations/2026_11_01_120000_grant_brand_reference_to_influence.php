<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // La fiche de référence marque est aussi consultée par le responsable
        // influence (et les cumuls SMM + influence) — spec Revue SMM §5.
        $perm = Permission::query()->where('slug', 'brand_reference.view')->first();
        if (! $perm) {
            return;
        }

        $role = Role::query()->where('slug', 'influence_manager')->first();
        $role?->permissions()->syncWithoutDetaching([$perm->id]);
    }

    public function down(): void
    {
        // Non destructif : on ne retire ni la permission ni ses attributions.
    }
};
