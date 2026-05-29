<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_kpis', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->date('kpi_date');
            $table->decimal('cac', 12, 2)->nullable();
            $table->decimal('cpa', 12, 2)->nullable();
            $table->decimal('cpc', 12, 2)->nullable();
            $table->decimal('cpd', 12, 2)->nullable();
            $table->decimal('aov', 12, 2)->nullable();
            $table->decimal('ltv', 12, 2)->nullable();
            $table->decimal('churn_rate', 8, 4)->nullable();
            $table->unsignedInteger('leads_count')->default(0);
            $table->unsignedInteger('messages_count')->default(0);
            $table->unsignedInteger('orders_confirmed')->default(0);
            $table->unsignedInteger('orders_delivered')->default(0);
            $table->decimal('engagement_rate', 8, 4)->nullable();
            $table->unsignedBigInteger('reach')->default(0);
            $table->unsignedBigInteger('impressions')->default(0);
            $table->decimal('content_performance', 12, 2)->nullable();
            $table->decimal('posting_consistency', 8, 4)->nullable();
            $table->decimal('influencer_cost', 12, 2)->nullable();
            $table->decimal('influencer_revenue', 12, 2)->nullable();
            $table->decimal('influencer_roi', 12, 2)->nullable();
            $table->decimal('influencer_conversion_rate', 8, 4)->nullable();
            $table->timestamps();

            $table->unique(['brand_id', 'kpi_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_kpis');
    }
};
