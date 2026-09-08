<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds group-chat support to the internal messaging system.
 * DM messages keep working via nullable conversation_id.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('chat_conversations')) {
            Schema::create('chat_conversations', function (Blueprint $table) {
                $table->id();
                $table->string('type', 10)->default('group');   // group | dm (dm is optional — DMs can stay conversation-less)
                $table->string('title', 200)->nullable();
                $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('last_message_at')->nullable();
                $table->timestamps();
                $table->index(['type', 'last_message_at'], 'chat_conv_type_last_idx');
            });
        }

        if (!Schema::hasTable('chat_conversation_members')) {
            Schema::create('chat_conversation_members', function (Blueprint $table) {
                $table->id();
                $table->foreignId('conversation_id')->constrained('chat_conversations')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('joined_at')->useCurrent();
                $table->timestamp('last_read_at')->nullable();
                $table->timestamps();
                $table->unique(['conversation_id', 'user_id'], 'chat_conv_user_uq');
                $table->index('user_id', 'chat_conv_user_idx');
            });
        }

        if (!Schema::hasColumn('internal_messages', 'conversation_id')) {
            Schema::table('internal_messages', function (Blueprint $table) {
                $table->foreignId('conversation_id')->nullable()->after('id')
                    ->constrained('chat_conversations')->nullOnDelete();
                $table->index('conversation_id', 'im_conv_idx');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('internal_messages', 'conversation_id')) {
            Schema::table('internal_messages', function (Blueprint $table) {
                $table->dropForeign(['conversation_id']);
                $table->dropColumn('conversation_id');
            });
        }
        Schema::dropIfExists('chat_conversation_members');
        Schema::dropIfExists('chat_conversations');
    }
};
