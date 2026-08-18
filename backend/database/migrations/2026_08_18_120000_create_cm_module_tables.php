<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('daily_checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cm_user_id')->constrained('users')->cascadeOnDelete();
            $table->date('work_date');
            $table->string('status')->default('en_cours');
            $table->unsignedBigInteger('validated_by')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['brand_id', 'cm_user_id', 'work_date']);
            $table->foreign('validated_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('daily_checklist_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('daily_checklist_id')->constrained('daily_checklists')->cascadeOnDelete();
            $table->string('label');
            $table->boolean('is_completed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->string('category')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('moderation_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cm_user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('social_account_id')->nullable();
            $table->string('platform')->nullable();
            $table->string('action_type');
            $table->text('description')->nullable();
            $table->string('screenshot_url')->nullable();
            $table->timestamp('action_date');
            $table->timestamps();

            $table->foreign('social_account_id')->references('id')->on('social_accounts')->nullOnDelete();
        });

        Schema::create('influencer_content_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cm_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('influencer_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('collaboration_id')->nullable();
            $table->string('content_type');
            $table->string('platform');
            $table->string('content_url')->nullable();
            $table->string('screenshot_url')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->boolean('is_archived')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('collaboration_id')->references('id')->on('influencer_collaborations')->nullOnDelete();
        });

        Schema::create('influencer_signals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->foreignId('cm_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('influencer_id')->constrained()->cascadeOnDelete();
            $table->string('signal_type');
            $table->string('severity')->default('moyen');
            $table->text('description');
            $table->string('status')->default('ouvert');
            $table->unsignedBigInteger('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->foreign('resolved_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('influencer_signals');
        Schema::dropIfExists('influencer_content_logs');
        Schema::dropIfExists('moderation_actions');
        Schema::dropIfExists('daily_checklist_items');
        Schema::dropIfExists('daily_checklists');
    }
};
