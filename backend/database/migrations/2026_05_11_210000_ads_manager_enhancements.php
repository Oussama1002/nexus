<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            try {
                DB::statement("ALTER TABLE ad_accounts MODIFY platform VARCHAR(32) NOT NULL");
            } catch (\Throwable) {
                //
            }
            try {
                DB::statement("ALTER TABLE ad_accounts MODIFY status VARCHAR(32) NOT NULL DEFAULT 'active'");
            } catch (\Throwable) {
                //
            }
        }

        Schema::table('ad_accounts', function (Blueprint $table) {
            if (! Schema::hasColumn('ad_accounts', 'business_manager_id')) {
                $table->string('business_manager_id', 128)->nullable()->after('external_account_id');
            }
            if (! Schema::hasColumn('ad_accounts', 'timezone')) {
                $table->string('timezone', 64)->nullable()->after('currency');
            }
            if (! Schema::hasColumn('ad_accounts', 'country')) {
                $table->string('country', 8)->nullable()->after('timezone');
            }
            if (! Schema::hasColumn('ad_accounts', 'api_connected')) {
                $table->boolean('api_connected')->default(false)->after('country');
            }
            if (! Schema::hasColumn('ad_accounts', 'refresh_token_ref')) {
                $table->string('refresh_token_ref', 500)->nullable()->after('access_token_ref');
            }
            if (! Schema::hasColumn('ad_accounts', 'webhook_secret_ref')) {
                $table->string('webhook_secret_ref', 500)->nullable()->after('refresh_token_ref');
            }
            if (! Schema::hasColumn('ad_accounts', 'responsible_user_id')) {
                $table->foreignId('responsible_user_id')->nullable()->after('brand_id')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('ad_accounts', 'notes')) {
                $table->text('notes')->nullable();
            }
        });

        if ($driver === 'mysql') {
            try {
                DB::statement("ALTER TABLE campaigns MODIFY source VARCHAR(32) NOT NULL");
            } catch (\Throwable) {
                //
            }
            try {
                DB::statement("ALTER TABLE campaigns MODIFY status VARCHAR(32) NOT NULL DEFAULT 'draft'");
            } catch (\Throwable) {
                //
            }
        }

        Schema::table('campaigns', function (Blueprint $table) {
            if (! Schema::hasColumn('campaigns', 'marketing_objective')) {
                $table->string('marketing_objective', 64)->nullable()->after('objective');
            }
            if (! Schema::hasColumn('campaigns', 'daily_budget')) {
                $table->decimal('daily_budget', 12, 2)->nullable()->after('budget');
            }
            if (! Schema::hasColumn('campaigns', 'campaign_currency')) {
                $table->string('campaign_currency', 10)->nullable()->after('daily_budget');
            }
            if (! Schema::hasColumn('campaigns', 'attribution_model')) {
                $table->string('attribution_model', 64)->nullable()->after('campaign_currency');
            }
            if (! Schema::hasColumn('campaigns', 'product_id')) {
                $table->foreignId('product_id')->nullable()->after('ad_account_id')->constrained()->nullOnDelete();
            }
            if (! Schema::hasColumn('campaigns', 'landing_url')) {
                $table->string('landing_url', 2048)->nullable()->after('notes');
            }
            if (! Schema::hasColumn('campaigns', 'confirmatrice_user_id')) {
                $table->foreignId('confirmatrice_user_id')->nullable()->after('landing_url')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('campaigns', 'influencer_id')) {
                $table->foreignId('influencer_id')->nullable()->after('confirmatrice_user_id')->constrained()->nullOnDelete();
            }
            if (! Schema::hasColumn('campaigns', 'utm_source')) {
                $table->string('utm_source', 128)->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'utm_campaign')) {
                $table->string('utm_campaign', 128)->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'utm_medium')) {
                $table->string('utm_medium', 128)->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'pixel_id')) {
                $table->string('pixel_id', 128)->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'target_cac')) {
                $table->decimal('target_cac', 12, 4)->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'target_cpa')) {
                $table->decimal('target_cpa', 12, 4)->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'target_roas')) {
                $table->decimal('target_roas', 12, 4)->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'target_leads')) {
                $table->unsignedInteger('target_leads')->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'description')) {
                $table->text('description')->nullable();
            }
            if (! Schema::hasColumn('campaigns', 'creatives_summary')) {
                $table->text('creatives_summary')->nullable();
            }
        });

        Schema::table('leads', function (Blueprint $table) {
            if (! Schema::hasColumn('leads', 'campaign_id')) {
                $table->foreignId('campaign_id')->nullable()->after('brand_id')->constrained()->nullOnDelete();
            }
        });

        Schema::table('orders', function (Blueprint $table) {
            if (! Schema::hasColumn('orders', 'campaign_id')) {
                $table->foreignId('campaign_id')->nullable()->after('brand_id')->constrained()->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            if (Schema::hasColumn('orders', 'campaign_id')) {
                $table->dropConstrainedForeignId('campaign_id');
            }
        });

        Schema::table('leads', function (Blueprint $table) {
            if (Schema::hasColumn('leads', 'campaign_id')) {
                $table->dropConstrainedForeignId('campaign_id');
            }
        });

        Schema::table('campaigns', function (Blueprint $table) {
            foreach (['product_id', 'confirmatrice_user_id', 'influencer_id'] as $fk) {
                if (Schema::hasColumn('campaigns', $fk)) {
                    $table->dropForeign([$fk]);
                    $table->dropColumn($fk);
                }
            }
            foreach ([
                'marketing_objective', 'daily_budget', 'campaign_currency', 'attribution_model',
                'landing_url',
                'utm_source', 'utm_campaign', 'utm_medium', 'pixel_id',
                'target_cac', 'target_cpa', 'target_roas', 'target_leads',
                'description', 'creatives_summary',
            ] as $c) {
                if (Schema::hasColumn('campaigns', $c)) {
                    $table->dropColumn($c);
                }
            }
        });

        Schema::table('ad_accounts', function (Blueprint $table) {
            if (Schema::hasColumn('ad_accounts', 'responsible_user_id')) {
                $table->dropForeign(['responsible_user_id']);
                $table->dropColumn('responsible_user_id');
            }
            foreach ([
                'business_manager_id', 'timezone', 'country', 'api_connected',
                'refresh_token_ref', 'webhook_secret_ref', 'notes',
            ] as $c) {
                if (Schema::hasColumn('ad_accounts', $c)) {
                    $table->dropColumn($c);
                }
            }
        });
    }
};
