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
use Illuminate\Support\Facades\Storage;

class InternalChatController extends Controller
{
    /**
     * List conversations (distinct users the current user has chatted with),
     * with unread count and last message preview.
     */
    public function threads(Request $request): JsonResponse
    {
        $me = $request->user()->id;

        // DM-only: exclude group messages (conversation_id set, receiver_id null).
        // Wrapping the sender/receiver clause in its own where() prevents the
        // "conversation_id null" filter from being OR'd away.
        $messages = InternalMessage::query()
            ->whereNull('conversation_id')
            ->whereNotNull('receiver_id')
            ->where(fn ($q) => $q->where('sender_id', $me)->orWhere('receiver_id', $me))
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
                'last_message' => $this->messagePreview($msg),
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

        return ApiResponse::success($messages->map(fn (InternalMessage $m) => $this->serializeMessage($m)), 'Messages retrieved.');
    }

    /**
     * Send a message (with optional attachment) to another user.
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

        $data = $this->validateMessageInput($request);

        $msg = InternalMessage::query()->create(array_merge([
            'sender_id' => $me,
            'receiver_id' => $peer,
        ], $data));

        return ApiResponse::success($this->serializeMessage($msg->fresh()), 'Message envoyé.', 201);
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
                'last_message' => $last ? $this->messagePreview($last) : '',
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

        return ApiResponse::success($messages->map(fn (InternalMessage $m) => array_merge(
            $this->serializeMessage($m),
            [
                'sender_name' => $m->sender?->name,
                'sender_avatar' => $m->sender?->avatar_url,
            ],
        )), 'OK');
    }

    /**
     * Post a message (with optional attachment) to a group conversation.
     */
    public function sendToConversation(Request $request, string $conversationId): JsonResponse
    {
        $me = $request->user()->id;
        $cid = (int) $conversationId;
        if (!$this->isMember($cid, $me)) {
            return ApiResponse::error('Vous ne faites pas partie de cette conversation.', null, 403);
        }

        $data = $this->validateMessageInput($request);

        $msg = InternalMessage::query()->create(array_merge([
            'sender_id' => $me,
            'receiver_id' => null,
            'conversation_id' => $cid,
        ], $data));
        ChatConversation::query()->where('id', $cid)->update(['last_message_at' => now()]);
        // The sender has read their own message.
        ChatConversationMember::query()
            ->where('conversation_id', $cid)
            ->where('user_id', $me)
            ->update(['last_read_at' => now()]);

        return ApiResponse::success(array_merge(
            $this->serializeMessage($msg->fresh()),
            [
                'sender_name' => $request->user()->name,
                'sender_avatar' => $request->user()->avatar_url,
            ],
        ), 'Message envoyé.', 201);
    }

    /**
     * Upload a single attachment file to the storage/public disk under
     * chat/YYYY/MM/. Returns the URL + metadata so the client can
     * include them in a follow-up send() call.
     * POST /internal-chat/upload  multipart file[file] (max 15 MB)
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:15360'], // 15 MB
        ]);
        $file = $request->file('file');
        $dir = 'chat/' . now()->format('Y/m');
        $path = $file->store($dir, 'public');
        return ApiResponse::success([
            'url' => '/storage/' . $path,
            'name' => $file->getClientOriginalName(),
            'mime' => $file->getMimeType(),
            'size' => (int) $file->getSize(),
        ], 'Fichier téléversé.');
    }

    private function validateMessageInput(Request $request): array
    {
        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:5000'],
            'attachment_url' => ['nullable', 'string', 'max:500'],
            'attachment_name' => ['nullable', 'string', 'max:255'],
            'attachment_mime' => ['nullable', 'string', 'max:120'],
            'attachment_size' => ['nullable', 'integer', 'min:0'],
        ]);
        // A message must carry at least a body or an attachment.
        if (empty(trim((string) ($data['body'] ?? ''))) && empty($data['attachment_url'] ?? null)) {
            abort(422, 'Message vide : ajoutez du texte ou un fichier.');
        }
        return $data;
    }

    /**
     * Preview text for a message in a thread list.
     * - Message with body → the body (server-side truncation is up to the caller).
     * - Attachment-only image → "📷 Image".
     * - Attachment-only other file → "📎 <filename>".
     * - Nothing at all → empty string.
     */
    private function messagePreview(InternalMessage $m): string
    {
        $body = trim((string) $m->body);
        if ($body !== '') return $body;
        if ($m->attachment_url) {
            if (str_starts_with((string) $m->attachment_mime, 'image/')) {
                return '📷 Image';
            }
            return '📎 ' . ($m->attachment_name ?: 'Fichier');
        }
        return '';
    }

    private function serializeMessage(InternalMessage $m): array
    {
        return [
            'id' => $m->id,
            'sender_id' => $m->sender_id,
            'receiver_id' => $m->receiver_id,
            'conversation_id' => $m->conversation_id,
            'body' => $m->body,
            'attachment_url' => $m->attachment_url,
            'attachment_name' => $m->attachment_name,
            'attachment_mime' => $m->attachment_mime,
            'attachment_size' => $m->attachment_size,
            'read_at' => $m->read_at?->toIso8601String(),
            'created_at' => $m->created_at->toIso8601String(),
        ];
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
