<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Message;
use App\Models\SystemSetting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppCloudService
{
    public const CHANNEL = 'whatsapp';

    private function config(int $brandId): array
    {
        $rows = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->whereIn('setting_key', [
                'wa_provider', 'wa_api_base_url', 'wa_api_token',
                'wa_phone_id', 'wa_business_account_id', 'wa_webhook_verify_token',
                // Legacy keys (fallback)
                'whatsapp_api_token', 'whatsapp_phone_id',
            ])
            ->pluck('setting_value', 'setting_key')
            ->all();

        return [
            'provider' => trim((string) ($rows['wa_provider'] ?? 'meta_cloud')),
            'base_url' => rtrim((string) ($rows['wa_api_base_url'] ?? 'https://graph.facebook.com/v25.0'), '/'),
            'token' => trim((string) ($rows['wa_api_token'] ?? $rows['whatsapp_api_token'] ?? '')),
            'phone_id' => trim((string) ($rows['wa_phone_id'] ?? $rows['whatsapp_phone_id'] ?? '')),
            'verify_token' => trim((string) ($rows['wa_webhook_verify_token'] ?? '')),
        ];
    }

    /** Resolve brand by incoming phone_number_id (Meta payload metadata). */
    public function resolveBrandIdByPhoneId(string $phoneNumberId): ?int
    {
        $row = SystemSetting::query()
            ->where('setting_key', 'wa_phone_id')
            ->where('setting_value', $phoneNumberId)
            ->orderBy('id')
            ->first();

        return $row?->brand_id;
    }

    /** Resolve verify token across all brands (used by GET webhook verification). */
    public function findBrandIdByVerifyToken(string $token): ?int
    {
        if ($token === '') {
            return null;
        }

        $row = SystemSetting::query()
            ->where('setting_key', 'wa_webhook_verify_token')
            ->where('setting_value', $token)
            ->orderBy('id')
            ->first();

        return $row?->brand_id;
    }

    /**
     * Ingest a Meta Cloud API webhook payload. Returns count of stored messages.
     *
     * @param  array<string, mixed>  $payload
     */
    public function ingestWebhook(array $payload): int
    {
        $stored = 0;

        foreach ($payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                if (($change['field'] ?? null) !== 'messages') {
                    continue;
                }

                $value = $change['value'] ?? [];
                $phoneId = (string) ($value['metadata']['phone_number_id'] ?? '');
                if ($phoneId === '') {
                    continue;
                }

                $brandId = $this->resolveBrandIdByPhoneId($phoneId);
                if (! $brandId) {
                    Log::warning('whatsapp.webhook.unknown_phone_id', ['phone_id' => $phoneId]);
                    continue;
                }

                foreach ($value['messages'] ?? [] as $msg) {
                    if ($this->storeInboundMessage($brandId, $value, $msg)) {
                        $stored++;
                    }
                }
            }
        }

        return $stored;
    }

    private function storeInboundMessage(int $brandId, array $value, array $msg): bool
    {
        $externalId = (string) ($msg['id'] ?? '');
        if ($externalId !== '' && Message::query()->where('external_message_id', $externalId)->exists()) {
            return false;
        }

        $fromWaId = (string) ($msg['from'] ?? '');
        $type = (string) ($msg['type'] ?? 'text');
        $body = $this->extractBody($msg, $type);
        $sentAt = isset($msg['timestamp'])
            ? Carbon::createFromTimestampUTC((int) $msg['timestamp'])
            : now();

        $profileName = $value['contacts'][0]['profile']['name'] ?? null;

        $customer = $this->findOrCreateCustomer($brandId, $fromWaId, $profileName);
        $conversation = $this->findOrCreateConversation($brandId, $customer, $fromWaId);

        Message::query()->create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => null,
            'direction' => 'inbound',
            'content' => $body,
            'message_type' => $type,
            'external_message_id' => $externalId ?: null,
            'sent_at' => $sentAt,
        ]);

        $conversation->forceFill([
            'last_message_at' => $sentAt,
            'status' => $conversation->status === 'closed' ? 'open' : $conversation->status,
        ])->save();

        return true;
    }

    private function extractBody(array $msg, string $type): ?string
    {
        return match ($type) {
            'text' => $msg['text']['body'] ?? null,
            'image', 'video', 'audio', 'document', 'sticker' => $msg[$type]['caption']
                ?? ('[' . $type . ': ' . ($msg[$type]['id'] ?? 'media') . ']'),
            'location' => sprintf('[location: %s, %s]',
                $msg['location']['latitude'] ?? '?', $msg['location']['longitude'] ?? '?'),
            'button' => $msg['button']['text'] ?? null,
            'interactive' => $msg['interactive']['button_reply']['title']
                ?? $msg['interactive']['list_reply']['title']
                ?? null,
            default => json_encode($msg, JSON_UNESCAPED_UNICODE),
        };
    }

    private function findOrCreateCustomer(int $brandId, string $waId, ?string $profileName): Customer
    {
        $phone = '+' . ltrim($waId, '+');

        // Build all possible phone variants for matching (e.g. +212xxx ↔ 0xxx)
        $variants = PhoneNormalizer::variants($phone);

        $customer = Customer::query()
            ->where('brand_id', $brandId)
            ->where(function ($q) use ($variants) {
                foreach ($variants as $v) {
                    $q->orWhere('phone', $v);
                }
            })
            ->first();

        if ($customer) {
            return $customer;
        }

        $customer = Customer::query()->create([
            'brand_id' => $brandId,
            'full_name' => $profileName ?: ('WhatsApp ' . $waId),
            'phone' => $phone,
            'client_source' => 'whatsapp',
            'status' => 'active',
        ]);

        // Auto-create lead from WhatsApp conversation
        try {
            Lead::query()->create([
                'brand_id' => $brandId,
                'customer_id' => $customer->id,
                'source' => 'WhatsApp',
                'status' => 'new',
                'notes' => 'Lead auto-cree depuis une conversation WhatsApp.',
            ]);
        } catch (\Throwable $e) {
            Log::warning('whatsapp.auto_lead_failed', ['customer_id' => $customer->id, 'error' => $e->getMessage()]);
        }

        return $customer;
    }

    private function findOrCreateConversation(int $brandId, Customer $customer, string $waId): Conversation
    {
        $conversation = Conversation::query()
            ->where('brand_id', $brandId)
            ->where('channel', self::CHANNEL)
            ->where('external_thread_id', $waId)
            ->first();

        if ($conversation) {
            return $conversation;
        }

        return Conversation::query()->create([
            'brand_id' => $brandId,
            'customer_id' => $customer->id,
            'channel' => self::CHANNEL,
            'external_thread_id' => $waId,
            'status' => 'open',
            'last_message_at' => now(),
        ]);
    }

    /**
     * Send a plain text WhatsApp message. Returns external message id on success.
     *
     * @throws \RuntimeException
     */
    public function sendText(int $brandId, string $toWaId, string $body): string
    {
        $cfg = $this->config($brandId);

        if ($cfg['token'] === '' || $cfg['phone_id'] === '') {
            throw new \RuntimeException('WhatsApp credentials missing for this brand.');
        }

        $url = sprintf('%s/%s/messages', $cfg['base_url'], $cfg['phone_id']);

        $res = Http::withToken($cfg['token'])
            ->acceptJson()
            ->asJson()
            ->post($url, [
                'messaging_product' => 'whatsapp',
                'to' => ltrim($toWaId, '+'),
                'type' => 'text',
                'text' => ['body' => $body],
            ]);

        if (! $res->successful()) {
            Log::error('whatsapp.send.failed', [
                'status' => $res->status(),
                'body' => $res->body(),
            ]);
            throw new \RuntimeException('WhatsApp send failed: ' . $res->status() . ' ' . $res->body());
        }

        return (string) ($res->json('messages.0.id') ?? '');
    }

}
