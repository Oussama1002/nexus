<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Spec Phase 1 §7.3 — configurable home screen per role.
 * Nullable so a role without landing_view falls back to /dashboard.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('roles', 'landing_view')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->string('landing_view', 40)->nullable()->after('description');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('roles', 'landing_view')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->dropColumn('landing_view');
            });
        }
    }
};
