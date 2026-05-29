<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ad_accounts', function (Blueprint $table) {
            if (! Schema::hasColumn('ad_accounts', 'access_token_ref')) {
                $table->string('access_token_ref')->nullable()->after('external_account_id');
            }
        });

        $driver = Schema::getConnection()->getDriverName();

        Schema::table('campaigns', function (Blueprint $table) {
            if (! Schema::hasColumn('campaigns', 'spend')) {
                $table->decimal('spend', 12, 2)->default(0)->after('budget');
            }
            if (! Schema::hasColumn('campaigns', 'objective')) {
                $table->string('objective', 255)->nullable()->after('notes');
            }
        });

        if ($driver === 'mysql') {
            try {
                DB::statement("ALTER TABLE campaigns MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft'");
            } catch (\Throwable) {
                //
            }
        }

        Schema::table('campaign_metrics', function (Blueprint $table) {
            if (! Schema::hasColumn('campaign_metrics', 'reach')) {
                $table->unsignedBigInteger('reach')->default(0)->after('metric_date');
            }
            if (! Schema::hasColumn('campaign_metrics', 'messages')) {
                $table->unsignedInteger('messages')->default(0)->after('reach');
            }
            if (! Schema::hasColumn('campaign_metrics', 'confirmed_orders')) {
                $table->unsignedInteger('confirmed_orders')->default(0)->after('leads');
            }
            if (! Schema::hasColumn('campaign_metrics', 'delivered_orders')) {
                $table->unsignedInteger('delivered_orders')->default(0)->after('confirmed_orders');
            }
            foreach (['cpc' => [12, 4], 'cpm' => [12, 4], 'cpl' => [12, 4], 'cpa' => [12, 4], 'roas' => [12, 4]] as $col => $precision) {
                if (! Schema::hasColumn('campaign_metrics', $col)) {
                    $table->decimal($col, $precision[0], $precision[1])->nullable()->after('revenue');
                }
            }
        });

        if (Schema::hasColumn('campaign_metrics', 'orders') && Schema::hasColumn('campaign_metrics', 'confirmed_orders')) {
            $driver = Schema::getConnection()->getDriverName();
            if ($driver === 'sqlite') {
                DB::statement('UPDATE campaign_metrics SET confirmed_orders = COALESCE(orders, 0)');
            } else {
                DB::statement('UPDATE campaign_metrics SET confirmed_orders = COALESCE(`orders`, 0)');
            }
            Schema::table('campaign_metrics', function (Blueprint $table) {
                $table->dropColumn('orders');
            });
        }

        Schema::table('daily_kpis', function (Blueprint $table) {
            if (! Schema::hasColumn('daily_kpis', 'total_orders')) {
                $table->unsignedInteger('total_orders')->default(0)->after('kpi_date');
            }
            if (! Schema::hasColumn('daily_kpis', 'returned_orders')) {
                $table->unsignedInteger('returned_orders')->default(0)->after('total_orders');
            }
            if (! Schema::hasColumn('daily_kpis', 'shipped_orders')) {
                $table->unsignedInteger('shipped_orders')->default(0)->after('returned_orders');
            }
            if (! Schema::hasColumn('daily_kpis', 'revenue')) {
                $table->decimal('revenue', 14, 2)->default(0)->after('shipped_orders');
            }
            if (! Schema::hasColumn('daily_kpis', 'ad_spend')) {
                $table->decimal('ad_spend', 14, 2)->default(0)->after('revenue');
            }
            if (! Schema::hasColumn('daily_kpis', 'influencer_spend')) {
                $table->decimal('influencer_spend', 14, 2)->default(0)->after('ad_spend');
            }
            if (! Schema::hasColumn('daily_kpis', 'total_marketing_spend')) {
                $table->decimal('total_marketing_spend', 14, 2)->default(0)->after('influencer_spend');
            }
            if (! Schema::hasColumn('daily_kpis', 'new_customers')) {
                $table->unsignedInteger('new_customers')->default(0)->after('total_marketing_spend');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ad_accounts', function (Blueprint $table) {
            if (Schema::hasColumn('ad_accounts', 'access_token_ref')) {
                $table->dropColumn('access_token_ref');
            }
        });

        Schema::table('daily_kpis', function (Blueprint $table) {
            foreach (['total_orders', 'returned_orders', 'shipped_orders', 'revenue', 'ad_spend', 'influencer_spend', 'total_marketing_spend', 'new_customers'] as $c) {
                if (Schema::hasColumn('daily_kpis', $c)) {
                    $table->dropColumn($c);
                }
            }
        });

        Schema::table('campaign_metrics', function (Blueprint $table) {
            foreach (['reach', 'messages', 'confirmed_orders', 'delivered_orders', 'cpc', 'cpm', 'cpl', 'cpa', 'roas'] as $c) {
                if (Schema::hasColumn('campaign_metrics', $c)) {
                    $table->dropColumn($c);
                }
            }
            if (! Schema::hasColumn('campaign_metrics', 'orders')) {
                $table->unsignedInteger('orders')->default(0)->after('leads');
            }
        });
    }
};
