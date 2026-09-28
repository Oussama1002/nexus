<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Structure Ads Manager : campagne → ensembles de publicités → publicités
 * (créatifs), avec leurs métriques quotidiennes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('ad_sets')) {
            Schema::create('ad_sets', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
                $table->string('external_ad_set_id', 64)->nullable();
                $table->string('name');
                $table->string('status', 40)->nullable();
                $table->string('effective_status', 40)->nullable();
                $table->string('optimization_goal', 60)->nullable();
                $table->string('billing_event', 60)->nullable();
                $table->string('bid_strategy', 60)->nullable();
                $table->decimal('daily_budget', 12, 2)->nullable();
                $table->decimal('lifetime_budget', 12, 2)->nullable();
                $table->timestamp('start_time')->nullable();
                $table->timestamp('stop_time')->nullable();
                $table->text('targeting_summary')->nullable();
                $table->timestamp('last_synced_at')->nullable();
                $table->timestamps();

                $table->unique(['campaign_id', 'external_ad_set_id']);
                $table->index(['brand_id', 'campaign_id']);
            });
        }

        if (! Schema::hasTable('ads')) {
            Schema::create('ads', function (Blueprint $table) {
                $table->id();
                $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
                $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
                $table->foreignId('ad_set_id')->constrained('ad_sets')->cascadeOnDelete();
                $table->string('external_ad_id', 64)->nullable();
                $table->string('name');
                $table->string('status', 40)->nullable();
                $table->string('effective_status', 40)->nullable();
                $table->string('creative_name')->nullable();
                $table->string('creative_title')->nullable();
                $table->text('creative_body')->nullable();
                $table->string('creative_thumbnail_url', 2048)->nullable();
                $table->string('creative_permalink', 2048)->nullable();
                $table->string('creative_call_to_action', 60)->nullable();
                $table->timestamp('last_synced_at')->nullable();
                $table->timestamps();

                $table->unique(['ad_set_id', 'external_ad_id']);
                $table->index(['brand_id', 'campaign_id']);
            });
        }

        foreach ([
            'ad_set_metrics' => ['ad_set_id', 'ad_sets'],
            'ad_metrics' => ['ad_id', 'ads'],
        ] as $table => [$column, $parent]) {
            if (Schema::hasTable($table)) {
                continue;
            }

            Schema::create($table, function (Blueprint $blueprint) use ($column, $parent) {
                $blueprint->id();
                $blueprint->foreignId($column)->constrained($parent)->cascadeOnDelete();
                $blueprint->date('metric_date');
                $blueprint->decimal('spend', 12, 2)->default(0);
                $blueprint->unsignedBigInteger('impressions')->default(0);
                $blueprint->unsignedBigInteger('clicks')->default(0);
                $blueprint->unsignedBigInteger('reach')->default(0);
                $blueprint->unsignedBigInteger('leads')->default(0);
                $blueprint->unsignedBigInteger('messages')->default(0);
                $blueprint->decimal('ctr', 10, 4)->nullable();
                $blueprint->decimal('frequency', 10, 4)->nullable();
                $blueprint->decimal('cpc', 12, 4)->nullable();
                $blueprint->decimal('cpm', 12, 4)->nullable();
                $blueprint->decimal('cpl', 12, 4)->nullable();
                $blueprint->timestamps();

                $blueprint->unique([$column, 'metric_date']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ad_metrics');
        Schema::dropIfExists('ad_set_metrics');
        Schema::dropIfExists('ads');
        Schema::dropIfExists('ad_sets');
    }
};
