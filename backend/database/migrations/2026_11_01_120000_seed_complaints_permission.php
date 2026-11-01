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

        // Permission dédiée au module Réclamations (call center). Avant, ces routes
        // étaient rattachées à cm_tracking.* (Community Manager) : le menu côté front
        // exigeait complaints.view (inexistante) et la confirmatrice voyait le menu
        // sans pouvoir charger les données. On crée la vraie permission affichée.
        $perms = [
            'complaints.view' => 'Réclamations — Consulter',
            'complaints.create' => 'Réclamations — Créer',
            'complaints.update' => 'Réclamations — Modifier',
            'complaints.delete' => 'Réclamations — Supprimer',
        ];

        $idBySlug = [];
        foreach ($perms as $slug => $name) {
            $p = Permission::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'module' => 'complaints'],
            );
            $idBySlug[$slug] = $p->id;
        }

        // Rôles qui gèrent les réclamations call center (l'admin passe déjà partout).
        $grant = ['complaints.view', 'complaints.create', 'complaints.update'];
        $ids = array_map(fn ($s) => $idBySlug[$s], $grant);
        foreach (['confirmatrice', 'manager_operationnel'] as $slug) {
            $role = Role::query()->where('slug', $slug)->first();
            $role?->permissions()->syncWithoutDetaching($ids);
        }
    }

    public function down(): void
    {
        // Non destructif : on ne retire ni les permissions ni les attributions.
    }
};
