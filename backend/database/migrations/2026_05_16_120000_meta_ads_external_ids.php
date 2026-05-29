<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            if (! Schema::hasColumn('campaigns', 'external_campaign_id')) {
                $table->string('external_campaign_id', 64)->nullable()->after('source');
            }
            if (! Schema::hasColumn('campaigns', 'last_synced_at')) {
                $table->timestamp('last_synced_at')->nullable()->after('updated_at');
            }
        });

        Schema::table('ad_accounts', function (Blueprint $table) {
            if (! Schema::hasColumn('ad_accounts', 'last_synced_at')) {
                $table->timestamp('last_synced_at')->nullable()->after('updated_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            foreach (['external_campaign_id', 'last_synced_at'] as $c) {
                if (Schema::hasColumn('campaigns', $c)) {
                    $table->dropColumn($c);
                }
            }
        });

        Schema::table('ad_accounts', function (Blueprint $table) {
            if (Schema::hasColumn('ad_accounts', 'last_synced_at')) {
                $table->dropColumn('last_synced_at');
            }
        });
    }
};
