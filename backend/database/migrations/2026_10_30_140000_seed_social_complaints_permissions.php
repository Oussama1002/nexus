<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('permissions') || ! Schema::hasTable('roles')) {
            return;
        }

        // Permissions de l'espace Réclamations réseaux sociaux (spec Droits CM §3).
        $perms = [
            'social_complaints.view' => 'Voir les réclamations réseaux sociaux',
            'social_complaints.create' => 'Créer une réclamation réseaux sociaux',
            'social_complaints.update' => 'Modifier une réclamation réseaux sociaux',
            'social_complaints.delete' => 'Supprimer une réclamation réseaux sociaux',
        ];

        $ids = [];
        foreach ($perms as $slug => $name) {
            $p = Permission::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'module' => 'social_complaints'],
            );
            $ids[] = $p->id;
        }

        // Accordées au Community Manager et au Social Media Manager.
        foreach (['community_manager', 'smm'] as $slug) {
            $role = Role::query()->where('slug', $slug)->first();
            $role?->permissions()->syncWithoutDetaching($ids);
        }
    }

    public function down(): void
    {
        // Non destructif : on ne retire ni les permissions ni les attributions.
    }
};
