<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InternalMessage;
use App\Models\User;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $count = InternalMessage::query()
            ->where('receiver_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return ApiResponse::success(['unread' => $count], 'OK');
    }
}
