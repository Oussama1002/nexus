<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('courses') && ! Schema::hasColumn('courses', 'target_roles')) {
            Schema::table('courses', function (Blueprint $table) {
                // Rôles (slugs) autorisés à voir la formation. NULL/[] = tout le monde.
                $table->json('target_roles')->nullable()->after('difficulty_level');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('courses') && Schema::hasColumn('courses', 'target_roles')) {
            Schema::table('courses', function (Blueprint $table) {
                $table->dropColumn('target_roles');
            });
        }
    }
};
