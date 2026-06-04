<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreConversationRequest;
use App\Http\Requests\Api\StoreMessageRequest;
use App\Http\Requests\Api\UpdateConversationRequest;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Message;
use App\Services\AuditLogger;
use App\Services\WhatsAppCloudService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();
        $this->denyClientPortalUser($user);
        $user->loadMissing('roles');

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');

        $showAll = $request->query('all_brands') === '1';

        $q = Conversation::query()->with(['customer', 'lead', 'assignedUser', 'brand:id,name'])
            ->withMax(['messages as last_inbound_at' => fn ($mq) => $mq->where('direction', 'inbound')], 'sent_at')
            ->withMax(['messages as last_outbound_at' => fn ($mq) => $mq->where('direction', 'outbound')], 'sent_at')
            ->orderByDesc('last_message_at')
            ->orderByDesc('id');

        if (! $showAll) {
            $q->where('brand_id', $brandId);
        }

        if (! $user->canViewAllConversations()) {
            $q->where('assigned_user_id', $user->id);
        }

        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('external_thread_id', 'like', $s)
                    ->orWhereHas('customer', fn ($c) => $c->where('full_name', 'like', $s)->orWhere('phone', 'like', $s));
            });
        }

        $paginator = $q->paginate($perPage);
        $now = now();

        $paginator->getCollection()->transform(function (Conversation $conversation) use ($now) {
            $inbound = $conversation->getAttribute('last_inbound_at');
            $outbound = $conversation->getAttribute('last_outbound_at');
            $inboundAt = $inbound ? Carbon::parse((string) $inbound) : null;
            $outboundAt = $outbound ? Carbon::parse((string) $outbound) : null;

            $waitingForAgentReply = false;
            $waitingMinutes = 0;
            if ($inboundAt && (! $outboundAt || $outboundAt->lt($inboundAt))) {
                $waitingForAgentReply = true;
                $waitingMinutes = $inboundAt->diffInMinutes($now);
            }

            $conversation->setAttribute('is_waiting_agent_reply', $waitingForAgentReply);
            $conversation->setAttribute('waiting_agent_reply_minutes', $waitingMinutes);
            $conversation->setAttribute('needs_reply_alert', $waitingForAgentReply && $waitingMinutes >= 15);

            return $conversation;
        });

        return ApiResponse::success($paginator, 'Conversations retrieved successfully.');
    }

    public function store(StoreConversationRequest $request): JsonResponse
    {
        $this->denyClientPortalUser($request->user());
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['channel'] = $data['channel'] ?? 'whatsapp';
        $data['status'] = $data['status'] ?? 'open';

        if (! empty($data['customer_id'])) {
            $this->assertCustomerBrand((int) $data['customer_id'], $brandId);
        }
        if (! empty($data['lead_id'])) {
            $this->assertLeadBrand((int) $data['lead_id'], $brandId);
        }

        $conversation = Conversation::query()->create($data);
        AuditLogger::log($request, 'conversations.create', $conversation, null, $conversation->toArray());

        return ApiResponse::success($conversation->fresh(['customer', 'lead']), 'Conversation created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $conversation = $this->findConversationForUser($request, $id);

        return ApiResponse::success($conversation->load(['customer', 'lead', 'assignedUser']), 'Conversation retrieved successfully.');
    }

    public function update(UpdateConversationRequest $request, string $id): JsonResponse
    {
        $conversation = $this->findConversationForUser($request, $id);
        $before = $conversation->toArray();
        $data = $request->validated();

        if (array_key_exists('customer_id', $data) && $data['customer_id']) {
            $this->assertCustomerBrand((int) $data['customer_id'], $conversation->brand_id);
        }
        if (array_key_exists('lead_id', $data) && $data['lead_id']) {
            $this->assertLeadBrand((int) $data['lead_id'], $conversation->brand_id);
        }

        $conversation->fill($data);
        $conversation->save();

        AuditLogger::log($request, 'conversations.update', $conversation, $before, $conversation->fresh()->toArray());

        return ApiResponse::success($conversation->fresh(['customer', 'lead']), 'Conversation updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $conversation = $this->findConversationForUser($request, $id);
        $before = $conversation->toArray();
        $conversation->delete();
        AuditLogger::log($request, 'conversations.delete', null, $before, null);

        return ApiResponse::success(null, 'Conversation deleted successfully.');
    }

    public function messages(Request $request, string $id): JsonResponse
    {
        $conversation = $this->findConversationForUser($request, $id);
        $perPage = min(max((int) $request->query('per_page', 50), 1), 100);

        return ApiResponse::success(
            $conversation->messages()->with('sender')->orderBy('sent_at')->orderBy('id')->paginate($perPage),
            'Messages retrieved successfully.'
        );
    }

    public function storeMessage(StoreMessageRequest $request, string $id, WhatsAppCloudService $wa): JsonResponse
    {
        $conversation = $this->findConversationForUser($request, $id);
        $data = $request->validated();

        $direction = $data['direction'];
        $body = $data['content'] ?? null;
        $externalId = $data['external_message_id'] ?? null;

        if ($direction === 'outbound'
            && $conversation->channel === WhatsAppCloudService::CHANNEL
            && $body
            && $conversation->external_thread_id
            && empty($externalId)) {
            try {
                $externalId = $wa->sendText($conversation->brand_id, $conversation->external_thread_id, $body) ?: null;
            } catch (\Throwable $e) {
                return ApiResponse::error('WhatsApp send failed: ' . $e->getMessage(), null, 502);
            }
        }

        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => $request->user()->id,
            'direction' => $direction,
            'content' => $body,
            'message_type' => $data['message_type'] ?? 'text',
            'external_message_id' => $externalId,
            'sent_at' => now(),
        ]);

        $conversation->last_message_at = now();
        $conversation->save();

        AuditLogger::log($request, 'messages.create', $message, null, $message->toArray());

        return ApiResponse::success($message->fresh(['sender']), 'Message added successfully.', 201);
    }

    protected function findConversationForUser(Request $request, string $id): Conversation
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();
        $this->denyClientPortalUser($user);
        $user->loadMissing('roles');

        $q = Conversation::query()->where('brand_id', $brandId)->whereKey($id);
        if (! $user->canViewAllConversations()) {
            $q->where('assigned_user_id', $user->id);
        }

        return $q->firstOrFail();
    }

    private function denyClientPortalUser(?\App\Models\User $user): void
    {
        if ($user && $user->isClientBrandOwner()) {
            throw new AccessDeniedHttpException('Client portal users cannot access conversations.');
        }
    }

    protected function assertCustomerBrand(int $customerId, int $brandId): void
    {
        if (! Customer::query()->whereKey($customerId)->where('brand_id', $brandId)->exists()) {
            abort(422, 'Customer does not belong to this brand.');
        }
    }

    protected function assertLeadBrand(int $leadId, int $brandId): void
    {
        if (! Lead::query()->whereKey($leadId)->where('brand_id', $brandId)->exists()) {
            abort(422, 'Lead does not belong to this brand.');
        }
    }
}
