<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── DailyChecklistItem: +8 fields ──
        Schema::table('daily_checklist_items', function (Blueprint $table) {
            $table->string('task_type')->default('custom')->after('category');
            $table->time('scheduled_time')->nullable()->after('task_type');
            $table->string('platform')->nullable()->after('scheduled_time');
            $table->unsignedBigInteger('content_item_id')->nullable()->after('platform');
            $table->string('status')->default('pending')->after('is_completed');
            $table->unsignedInteger('delay_minutes')->nullable()->after('completed_at');
            $table->text('justification')->nullable()->after('delay_minutes');
            $table->text('comment')->nullable()->after('justification');

            $table->foreign('content_item_id')->references('id')->on('content_calendar')->nullOnDelete();
        });

        // ── DailyChecklist: +6 fields ──
        Schema::table('daily_checklists', function (Blueprint $table) {
            $table->unsignedBigInteger('template_id')->nullable()->after('notes');
            $table->decimal('completion_rate', 5, 2)->default(0)->after('template_id');
            $table->decimal('punctuality_rate', 5, 2)->default(0)->after('completion_rate');
            $table->timestamp('closed_at')->nullable()->after('punctuality_rate');
            $table->unsignedBigInteger('closed_by_user_id')->nullable()->after('closed_at');
            $table->boolean('closed_automatically')->default(false)->after('closed_by_user_id');

            $table->foreign('closed_by_user_id')->references('id')->on('users')->nullOnDelete();
        });

        // ── ModerationAction: +4 fields ──
        Schema::table('moderation_actions', function (Blueprint $table) {
            $table->string('account_handle')->nullable()->after('description');
            $table->boolean('public_comment_deleted')->default(false)->after('account_handle');
            $table->boolean('message_sent')->default(false)->after('public_comment_deleted');
            $table->unsignedBigInteger('complaint_id')->nullable()->after('message_sent');

            $table->foreign('complaint_id')->references('id')->on('complaints')->nullOnDelete();
        });

        // ── InfluencerContentLog: +5 fields ──
        Schema::table('influencer_content_logs', function (Blueprint $table) {
            $table->unsignedInteger('live_duration_minutes')->nullable()->after('notes');
            $table->unsignedInteger('live_viewers_count')->nullable()->after('live_duration_minutes');
            $table->boolean('no_publication')->default(false)->after('live_viewers_count');
            $table->unsignedInteger('quantity')->default(1)->after('no_publication');
            $table->string('archive_url')->nullable()->after('quantity');
        });

        // ── CM Notifications table ──
        Schema::create('cm_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('recipient_user_id');
            $table->string('type');
            $table->string('title');
            $table->text('body')->nullable();
            $table->json('data')->nullable();
            $table->string('related_type')->nullable();
            $table->unsignedBigInteger('related_id')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->foreign('recipient_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['recipient_user_id', 'is_read']);
        });

        // ── Checklist Templates ──
        Schema::create('checklist_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('items_json');
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // FK on daily_checklists.template_id
        Schema::table('daily_checklists', function (Blueprint $table) {
            $table->foreign('template_id')->references('id')->on('checklist_templates')->nullOnDelete();
        });

        // ── CM Decision Points log ──
        Schema::create('cm_decision_points', function (Blueprint $table) {
            $table->id();
            $table->foreignId('brand_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('cm_user_id');
            $table->string('decision_code');
            $table->string('decision_label');
            $table->string('context_type')->nullable();
            $table->unsignedBigInteger('context_id')->nullable();
            $table->json('input_data')->nullable();
            $table->json('output_data')->nullable();
            $table->string('result');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('cm_user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cm_decision_points');

        Schema::table('daily_checklists', function (Blueprint $table) {
            $table->dropForeign(['template_id']);
        });

        Schema::dropIfExists('checklist_templates');
        Schema::dropIfExists('cm_notifications');

        Schema::table('influencer_content_logs', function (Blueprint $table) {
            $table->dropColumn(['live_duration_minutes', 'live_viewers_count', 'no_publication', 'quantity', 'archive_url']);
        });

        Schema::table('moderation_actions', function (Blueprint $table) {
            $table->dropForeign(['complaint_id']);
            $table->dropColumn(['account_handle', 'public_comment_deleted', 'message_sent', 'complaint_id']);
        });

        Schema::table('daily_checklists', function (Blueprint $table) {
            $table->dropForeign(['closed_by_user_id']);
            $table->dropColumn(['template_id', 'completion_rate', 'punctuality_rate', 'closed_at', 'closed_by_user_id', 'closed_automatically']);
        });

        Schema::table('daily_checklist_items', function (Blueprint $table) {
            $table->dropForeign(['content_item_id']);
            $table->dropColumn(['task_type', 'scheduled_time', 'platform', 'content_item_id', 'status', 'delay_minutes', 'justification', 'comment']);
        });
    }
};
