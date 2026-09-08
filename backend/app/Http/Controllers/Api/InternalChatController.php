<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatConversation;
use App\Models\ChatConversationMember;
use App\Models\InternalMessage;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InternalChatController extends Controller
{
    /**
     * List conversations (distinct users the current user has chatted with),
     * with unread count and last message preview.
     */
    public function threads(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        $messages = InternalMessage::query()
            ->where('sender_id', $me)
            ->orWhere('receiver_id', $me)
            ->orderByDesc('created_at')
            ->get();

        $threads = [];
        foreach ($messages as $msg) {
            $peerId = $msg->sender_id === $me ? $msg->receiver_id : $msg->sender_id;
            if (isset($threads[$peerId])) {
                $threads[$peerId]['unread'] += ($msg->receiver_id === $me && ! $msg->read_at) ? 1 : 0;
                continue;
            }
            $threads[$peerId] = [
                'user_id' => $peerId,
                'last_message' => $msg->body,
                'last_message_at' => $msg->created_at->toIso8601String(),
                'last_direction' => $msg->sender_id === $me ? 'sent' : 'received',
                'unread' => ($msg->receiver_id === $me && ! $msg->read_at) ? 1 : 0,
            ];
        }

        $peerIds = array_keys($threads);
        $users = User::query()->whereIn('id', $peerIds)->get(['id', 'name', 'email', 'avatar_url'])->keyBy('id');

        $result = [];
        foreach ($threads as $peerId => $t) {
            $u = $users->get($peerId);
            $result[] = [
                ...$t,
                'user_name' => $u?->name ?? 'Utilisateur supprimé',
                'user_email' => $u?->email ?? '',
                'user_avatar' => $u?->avatar_url ?? '',
            ];
        }

        return ApiResponse::success($result, 'Threads retrieved.');
    }

    /**
     * Get messages between current user and another user.
     */
    public function messages(Request $request, string $userId): JsonResponse
    {
        $me = $request->user()->id;
        $peer = (int) $userId;

        $messages = InternalMessage::query()
            ->where(function ($q) use ($me, $peer) {
                $q->where('sender_id', $me)->where('receiver_id', $peer);
            })
            ->orWhere(function ($q) use ($me, $peer) {
                $q->where('sender_id', $peer)->where('receiver_id', $me);
            })
            ->orderBy('created_at')
            ->orderBy('id')
            ->limit(200)
            ->get();

        // Mark received messages as read
        InternalMessage::query()
            ->where('sender_id', $peer)
            ->where('receiver_id', $me)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return ApiResponse::success($messages->map(fn (InternalMessage $m) => [
            'id' => $m->id,
            'sender_id' => $m->sender_id,
            'receiver_id' => $m->receiver_id,
            'body' => $m->body,
            'read_at' => $m->read_at?->toIso8601String(),
            'created_at' => $m->created_at->toIso8601String(),
        ]), 'Messages retrieved.');
    }

    /**
     * Send a message to another user.
     */
    public function send(Request $request, string $userId): JsonResponse
    {
        $me = $request->user()->id;
        $peer = (int) $userId;

        if ($me === $peer) {
            return ApiResponse::error('Impossible d\'envoyer un message à soi-même.', null, 422);
        }

        if (! User::query()->where('id', $peer)->exists()) {
            return ApiResponse::error('Utilisateur introuvable.', null, 404);
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $msg = InternalMessage::query()->create([
            'sender_id' => $me,
            'receiver_id' => $peer,
            'body' => $data['body'],
        ]);

        return ApiResponse::success([
            'id' => $msg->id,
            'sender_id' => $msg->sender_id,
            'receiver_id' => $msg->receiver_id,
            'body' => $msg->body,
            'read_at' => null,
            'created_at' => $msg->created_at->toIso8601String(),
        ], 'Message envoyé.', 201);
    }

    /**
     * Unread count for the current user (for badge display).
     * Includes both DM messages (receiver_id) and group messages posted
     * to conversations the user is a member of.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $me = $request->user()->id;
        $dm = InternalMessage::query()
            ->where('receiver_id', $me)
            ->whereNull('read_at')
            ->count();
        $group = 0;
        foreach ($this->membershipsWithLastRead($me) as $m) {
            $q = InternalMessage::query()
                ->where('conversation_id', $m->conversation_id)
                ->where('sender_id', '!=', $me);
            if ($m->last_read_at) $q->where('created_at', '>', $m->last_read_at);
            $group += $q->count();
        }
        return ApiResponse::success(['unread' => $dm + $group], 'OK');
    }

    /**
     * List every group conversation the current user is a member of, with
     * unread count + last-message preview.
     */
    public function conversations(Request $request): JsonResponse
    {
        $me = $request->user()->id;
        $memberships = $this->membershipsWithLastRead($me);
        if ($memberships->isEmpty()) return ApiResponse::success([], 'OK');

        $convIds = $memberships->pluck('conversation_id')->all();
        $convos = ChatConversation::query()->whereIn('id', $convIds)->get()->keyBy('id');
        $memberCounts = ChatConversationMember::query()
            ->whereIn('conversation_id', $convIds)
            ->select('conversation_id', DB::raw('count(*) as c'))
            ->groupBy('conversation_id')
            ->pluck('c', 'conversation_id');

        // Last message per conversation
        $lastMessages = InternalMessage::query()
            ->whereIn('conversation_id', $convIds)
            ->orderBy('conversation_id')
            ->orderByDesc('created_at')
            ->get(['id', 'conversation_id', 'sender_id', 'body', 'created_at'])
            ->unique('conversation_id')
            ->keyBy('conversation_id');

        $out = [];
        foreach ($memberships as $mem) {
            $c = $convos->get($mem->conversation_id);
            if (!$c) continue;
            $last = $lastMessages->get($mem->conversation_id);
            $unreadQ = InternalMessage::query()
                ->where('conversation_id', $mem->conversation_id)
                ->where('sender_id', '!=', $me);
            if ($mem->last_read_at) $unreadQ->where('created_at', '>', $mem->last_read_at);
            $out[] = [
                'conversation_id' => $c->id,
                'title' => $c->title ?? 'Groupe',
                'type' => $c->type,
                'member_count' => (int) ($memberCounts[$c->id] ?? 0),
                'last_message' => $last?->body ?? '',
                'last_message_at' => ($last?->created_at ?? $c->last_message_at ?? $c->created_at)?->toIso8601String(),
                'last_direction' => $last ? ($last->sender_id === $me ? 'sent' : 'received') : 'received',
                'unread' => $unreadQ->count(),
            ];
        }
        // Sort by most recent activity first
        usort($out, fn ($a, $b) => strcmp((string) $b['last_message_at'], (string) $a['last_message_at']));
        return ApiResponse::success($out, 'OK');
    }

    /**
     * Create a new group conversation.
     * POST { title: string, user_ids: int[] } — creator is auto-added.
     */
    public function createConversation(Request $request): JsonResponse
    {
        $me = $request->user()->id;
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $memberIds = collect($data['user_ids'])->map(fn ($id) => (int) $id)->push($me)->unique()->values()->all();
        if (count($memberIds) < 2) {
            return ApiResponse::error('Un groupe doit avoir au moins deux membres.', null, 422);
        }

        $conv = DB::transaction(function () use ($data, $me, $memberIds) {
            $c = ChatConversation::query()->create([
                'type' => 'group',
                'title' => $data['title'],
                'created_by_user_id' => $me,
            ]);
            foreach ($memberIds as $uid) {
                ChatConversationMember::query()->create([
                    'conversation_id' => $c->id,
                    'user_id' => $uid,
                    'joined_at' => now(),
                    'last_read_at' => $uid === $me ? now() : null,
                ]);
            }
            return $c;
        });

        return ApiResponse::success(['conversation_id' => $conv->id, 'title' => $conv->title], 'Groupe créé.', 201);
    }

    /**
     * Fetch group-conversation messages. 403 if the user isn't a member.
     */
    public function conversationMessages(Request $request, string $conversationId): JsonResponse
    {
        $me = $request->user()->id;
        $cid = (int) $conversationId;
        if (!$this->isMember($cid, $me)) {
            return ApiResponse::error('Vous ne faites pas partie de cette conversation.', null, 403);
        }

        $messages = InternalMessage::query()
            ->where('conversation_id', $cid)
            ->with('sender:id,name,avatar_url')
            ->orderBy('created_at')->orderBy('id')
            ->limit(300)
            ->get();

        // Mark this conversation as read for the current user.
        ChatConversationMember::query()
            ->where('conversation_id', $cid)
            ->where('user_id', $me)
            ->update(['last_read_at' => now()]);

        return ApiResponse::success($messages->map(fn (InternalMessage $m) => [
            'id' => $m->id,
            'sender_id' => $m->sender_id,
            'sender_name' => $m->sender?->name,
            'sender_avatar' => $m->sender?->avatar_url,
            'body' => $m->body,
            'created_at' => $m->created_at->toIso8601String(),
        ]), 'OK');
    }

    /**
     * Post a message to a group conversation.
     */
    public function sendToConversation(Request $request, string $conversationId): JsonResponse
    {
        $me = $request->user()->id;
        $cid = (int) $conversationId;
        if (!$this->isMember($cid, $me)) {
            return ApiResponse::error('Vous ne faites pas partie de cette conversation.', null, 403);
        }

        $data = $request->validate(['body' => ['required', 'string', 'max:5000']]);

        $msg = InternalMessage::query()->create([
            'sender_id' => $me,
            'receiver_id' => null,
            'conversation_id' => $cid,
            'body' => $data['body'],
        ]);
        ChatConversation::query()->where('id', $cid)->update(['last_message_at' => now()]);
        // The sender has read their own message.
        ChatConversationMember::query()
            ->where('conversation_id', $cid)
            ->where('user_id', $me)
            ->update(['last_read_at' => now()]);

        return ApiResponse::success([
            'id' => $msg->id,
            'sender_id' => $msg->sender_id,
            'body' => $msg->body,
            'created_at' => $msg->created_at->toIso8601String(),
        ], 'Message envoyé.', 201);
    }

    private function isMember(int $conversationId, int $userId): bool
    {
        return ChatConversationMember::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->exists();
    }

    private function membershipsWithLastRead(int $userId)
    {
        return ChatConversationMember::query()
            ->where('user_id', $userId)
            ->get(['conversation_id', 'last_read_at']);
    }
}
