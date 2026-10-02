<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Identifiant du post chez Meta : sans lui, supprimer la fiche ne peut pas
 * retirer la publication de la Page.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('content_calendar') && ! Schema::hasColumn('content_calendar', 'external_post_id')) {
            Schema::table('content_calendar', function (Blueprint $table) {
                $table->string('external_post_id', 100)->nullable()->after('published_url');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('content_calendar') && Schema::hasColumn('content_calendar', 'external_post_id')) {
            Schema::table('content_calendar', function (Blueprint $table) {
                $table->dropColumn('external_post_id');
            });
        }
    }
};
