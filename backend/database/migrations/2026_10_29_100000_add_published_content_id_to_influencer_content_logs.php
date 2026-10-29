<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('influencer_content_logs')
            && Schema::hasTable('influencer_published_contents')
            && ! Schema::hasColumn('influencer_content_logs', 'published_content_id')) {
            Schema::table('influencer_content_logs', function (Blueprint $table) {
                // Lien vers le contenu publié miroir (Studio Influence) créé quand
                // un log « Suivi influenceurs » est rattaché à un livrable.
                $table->foreignId('published_content_id')
                    ->nullable()
                    ->after('collaboration_id')
                    ->constrained('influencer_published_contents')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('influencer_content_logs')
            && Schema::hasColumn('influencer_content_logs', 'published_content_id')) {
            Schema::table('influencer_content_logs', function (Blueprint $table) {
                $table->dropConstrainedForeignId('published_content_id');
            });
        }
    }
};
