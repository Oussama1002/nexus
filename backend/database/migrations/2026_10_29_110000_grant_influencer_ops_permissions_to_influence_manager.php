<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

/**
 * Revue CRM — point 3 : les opérations influenceurs (réception produit, envois,
 * paiements, documents, livrables) n'étaient accordées à aucun rôle non-admin.
 * On les attache au rôle « Responsable influence » (influence_manager), que la
 * SMM peut cumuler pour gérer les influenceurs.
 */
return new class extends Migration
{
    private array $slugs = [
        'influencer_deliverables.view', 'influencer_deliverables.create', 'influencer_deliverables.update', 'influencer_deliverables.delete',
        'influencer_shipments.view', 'influencer_shipments.create', 'influencer_shipments.update', 'influencer_shipments.delete',
        'influencer_payments.view', 'influencer_payments.create', 'influencer_payments.update', 'influencer_payments.delete', 'influencer_payments.validate',
        'influencer_documents.view', 'influencer_documents.create', 'influencer_documents.update', 'influencer_documents.delete',
        'influencer_collaborations.validate',
    ];

    public function up(): void
    {
        // Garantir que les permissions existent (no-op si déjà seedées).
        foreach ($this->slugs as $slug) {
            [$module, $action] = explode('.', $slug, 2);
            Permission::firstOrCreate(
                ['slug' => $slug],
                [
                    'name' => str_replace('_', ' ', ucfirst($module)).' — '.ucfirst($action),
                    'module' => $module,
                    'description' => "Permission {$slug}",
                ]
            );
        }

        $role = Role::query()->where('slug', 'influence_manager')->first();
        if ($role) {
            $ids = Permission::query()->whereIn('slug', $this->slugs)->pluck('id')->all();
            $role->permissions()->syncWithoutDetaching($ids);
        }
    }

    public function down(): void
    {
        // Attribution additive : pas de rollback automatique pour ne pas retirer
        // des droits qu'un admin aurait pu accorder volontairement.
    }
};
