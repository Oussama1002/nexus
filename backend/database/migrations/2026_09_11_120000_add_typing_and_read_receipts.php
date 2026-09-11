<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Typing indicators + read receipts on both internal chat and WhatsApp
 * module conversations.
 *
 * - chat_conversation_members.last_typing_at → group chat typing.
 * - internal_dm_typing → DM typing (DMs have no conversation row).
 * - conversations.{agent_typing_user_id, agent_typing_at, agent_last_read_at}
 *   → WhatsApp workspace: which agent is typing on this thread + when the
 *   team last acknowledged an inbound customer message.
 * DM read receipts already exist as internal_messages.read_at; group read
 * receipts already exist as chat_conversation_members.last_read_at.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('chat_conversation_members') && ! Schema::hasColumn('chat_conversation_members', 'last_typing_at')) {
            Schema::table('chat_conversation_members', function (Blueprint $table) {
                $table->timestamp('last_typing_at')->nullable()->after('last_read_at');
            });
        }

        if (! Schema::hasTable('internal_dm_typing')) {
            Schema::create('internal_dm_typing', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('peer_user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('last_typing_at')->nullable();
                $table->timestamps();
                $table->unique(['user_id', 'peer_user_id'], 'dm_typing_pair_uq');
                $table->index('peer_user_id', 'dm_typing_peer_idx');
            });
        }

        if (Schema::hasTable('conversations')) {
            Schema::table('conversations', function (Blueprint $table) {
                if (! Schema::hasColumn('conversations', 'agent_typing_user_id')) {
                    $table->unsignedBigInteger('agent_typing_user_id')->nullable()->after('assigned_user_id');
                }
                if (! Schema::hasColumn('conversations', 'agent_typing_at')) {
                    $table->timestamp('agent_typing_at')->nullable()->after('agent_typing_user_id');
                }
                if (! Schema::hasColumn('conversations', 'agent_last_read_at')) {
                    $table->timestamp('agent_last_read_at')->nullable()->after('agent_typing_at');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('chat_conversation_members') && Schema::hasColumn('chat_conversation_members', 'last_typing_at')) {
            Schema::table('chat_conversation_members', function (Blueprint $table) {
                $table->dropColumn('last_typing_at');
            });
        }
        Schema::dropIfExists('internal_dm_typing');

        if (Schema::hasTable('conversations')) {
            Schema::table('conversations', function (Blueprint $table) {
                foreach (['agent_typing_user_id', 'agent_typing_at', 'agent_last_read_at'] as $col) {
                    if (Schema::hasColumn('conversations', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
