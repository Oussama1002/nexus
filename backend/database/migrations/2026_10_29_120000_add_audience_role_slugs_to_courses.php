<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Revue CRM — point 5 (Brandna Academy) : cibler une formation sur des rôles
 * précis. NULL/vide = visible par tous (comportement actuel inchangé).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('courses') && ! Schema::hasColumn('courses', 'audience_role_slugs')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->json('audience_role_slugs')->nullable()->after('difficulty_level');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('courses') && Schema::hasColumn('courses', 'audience_role_slugs')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropColumn('audience_role_slugs');
            });
        }
    }
};
