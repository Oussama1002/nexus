<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Confirmatrices work the call center: they need Leads, and the carrier list so
// Logistique stops claiming "API transporteur non connectée".
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('roles') || ! Schema::hasTable('permissions') || ! Schema::hasTable('role_permissions')) {
            return;
        }

        $roleId = DB::table('roles')->where('slug', 'confirmatrice')->value('id');
        if (! $roleId) {
            return;
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('slug', ['leads.view', 'leads.update', 'delivery_companies.view'])
            ->pluck('id');

        foreach ($permissionIds as $permissionId) {
            DB::table('role_permissions')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
