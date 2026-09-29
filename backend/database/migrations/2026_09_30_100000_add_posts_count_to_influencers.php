<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nombre de publications d'une influenceuse : saisi à la main, Instagram ne
 * le renseigne pas pour les comptes tiers.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('influencers') || Schema::hasColumn('influencers', 'posts_count')) {
            return;
        }

        Schema::table('influencers', function (Blueprint $table) {
            $table->unsignedInteger('posts_count')->nullable()->after('audience_size');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('influencers') && Schema::hasColumn('influencers', 'posts_count')) {
            Schema::table('influencers', function (Blueprint $table) {
                $table->dropColumn('posts_count');
            });
        }
    }
};
