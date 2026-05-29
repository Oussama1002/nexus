<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_buying_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('ad_account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('source_entry_id')->nullable()->constrained('media_buying_entries')->nullOnDelete();
            $table->string('title');
            $table->string('angle', 255);
            $table->string('format', 80)->nullable();
            $table->text('hook')->nullable();
            $table->text('script')->nullable();
            $table->string('cta', 255)->nullable();
            $table->string('asset_url', 2048)->nullable();
            $table->string('external_ad_id', 128)->nullable();
            $table->enum('status', ['testing', 'winning', 'losing', 'archived'])->default('testing');
            $table->date('tested_at')->nullable();
            $table->decimal('spend', 12, 2)->default(0);
            $table->decimal('revenue', 12, 2)->default(0);
            $table->unsignedInteger('leads')->default(0);
            $table->unsignedInteger('confirmed_orders')->default(0);
            $table->decimal('cpa', 12, 4)->nullable();
            $table->decimal('ctr', 12, 4)->nullable();
            $table->decimal('roas', 12, 4)->nullable();
            $table->unsignedTinyInteger('repurpose_priority')->default(0);
            $table->text('repurpose_notes')->nullable();
            $table->boolean('is_repurposed')->default(false);
            $table->timestamps();

            $table->index(['brand_id', 'status'], 'media_buying_brand_status_idx');
            $table->index(['brand_id', 'angle'], 'media_buying_brand_angle_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_buying_entries');
    }
};
