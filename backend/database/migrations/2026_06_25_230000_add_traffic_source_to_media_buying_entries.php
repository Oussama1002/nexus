<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media_buying_entries', function (Blueprint $table) {
            $table->enum('traffic_source', ['organic', 'sponsored'])->default('sponsored')->after('status');
            $table->decimal('organic_reach', 12, 0)->nullable()->after('roas');
            $table->decimal('organic_impressions', 12, 0)->nullable()->after('organic_reach');
            $table->decimal('organic_engagement', 12, 4)->nullable()->after('organic_impressions');
            $table->decimal('organic_clicks', 12, 0)->nullable()->after('organic_engagement');
            $table->decimal('sponsored_reach', 12, 0)->nullable()->after('organic_clicks');
            $table->decimal('sponsored_impressions', 12, 0)->nullable()->after('sponsored_reach');
            $table->decimal('sponsored_engagement', 12, 4)->nullable()->after('sponsored_impressions');
            $table->decimal('sponsored_clicks', 12, 0)->nullable()->after('sponsored_engagement');
        });
    }

    public function down(): void
    {
        Schema::table('media_buying_entries', function (Blueprint $table) {
            $table->dropColumn([
                'traffic_source',
                'organic_reach',
                'organic_impressions',
                'organic_engagement',
                'organic_clicks',
                'sponsored_reach',
                'sponsored_impressions',
                'sponsored_engagement',
                'sponsored_clicks',
            ]);
        });
    }
};
