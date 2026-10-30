<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('brand_knowledge_items') && ! Schema::hasColumn('brand_knowledge_items', 'visible_to_smm')) {
            Schema::table('brand_knowledge_items', function (Blueprint $table) {
                // Visibilité par le rôle Social Media Manager (spec Revue SMM §5).
                // L'admin décoche pour masquer les infos sensibles (ventes…).
                $table->boolean('visible_to_smm')->default(true)->after('is_active');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('brand_knowledge_items') && Schema::hasColumn('brand_knowledge_items', 'visible_to_smm')) {
            Schema::table('brand_knowledge_items', function (Blueprint $table) {
                $table->dropColumn('visible_to_smm');
            });
        }
    }
};
