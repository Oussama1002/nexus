<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_publications', function (Blueprint $table) {
            if (! Schema::hasColumn('social_publications', 'impressions')) {
                $table->unsignedBigInteger('impressions')->nullable()->after('reach');
            }
            if (! Schema::hasColumn('social_publications', 'clicks')) {
                $table->unsignedBigInteger('clicks')->nullable()->after('impressions');
            }
            if (! Schema::hasColumn('social_publications', 'notes')) {
                $table->text('notes')->nullable()->after('source');
            }
        });

        Schema::table('content_calendar', function (Blueprint $table) {
            if (! Schema::hasColumn('content_calendar', 'platform')) {
                $table->string('platform', 32)->nullable()->after('social_account_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('content_calendar', function (Blueprint $table) {
            if (Schema::hasColumn('content_calendar', 'platform')) {
                $table->dropColumn('platform');
            }
        });

        Schema::table('social_publications', function (Blueprint $table) {
            foreach (['notes', 'clicks', 'impressions'] as $col) {
                if (Schema::hasColumn('social_publications', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
