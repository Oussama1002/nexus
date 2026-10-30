<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasTable('permissions') || ! Schema::hasTable('role_permissions')) {
            return;
        }

        // Spec Revue SMM §3 : le rôle influence doit pouvoir enregistrer les
        // envois produits, suivre les paiements et joindre les documents.
        $role = Role::query()->where('slug', 'influence_manager')->first();
        if (! $role) {
            return;
        }

        $slugs = [
            'influencer_deliverables.view', 'influencer_deliverables.create', 'influencer_deliverables.update', 'influencer_deliverables.delete',
            'influencer_payments.view', 'influencer_payments.create', 'influencer_payments.update', 'influencer_payments.delete', 'influencer_payments.validate',
            'influencer_documents.view', 'influencer_documents.create', 'influencer_documents.update', 'influencer_documents.delete',
            'influencer_shipments.view', 'influencer_shipments.create', 'influencer_shipments.update', 'influencer_shipments.delete',
        ];

        $ids = Permission::query()->whereIn('slug', $slugs)->pluck('id')->all();
        if ($ids !== []) {
            $role->permissions()->syncWithoutDetaching($ids);
        }
    }

    public function down(): void
    {
        // On ne retire pas les permissions (non destructif).
    }
};
