<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Message;
use App\Models\Order;
use App\Models\SystemSetting;
use App\Models\WhatsAppNumber;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Fire approved WhatsApp templates on business events so an agent doesn't
 * have to open the conversation to greet a new customer, or send an order
 * follow-up.
 *
 * Which template goes on which event is configured per brand under three
 * SystemSetting keys (blank/unset ⇒ that event doesn't fire):
 *   - wa_tpl_welcome              → first inbound on a fresh thread
 *   - wa_tpl_order_confirmation   → order status → 'confirmed'
 *   - wa_tpl_delivery             → order status → 'shipped' (en livraison)
 *
 * The value is the exact template name registered + approved on the WABA
 * (e.g. "welcome_generique", "suivi_commande", "rappel_paiement").
 *
 * Positional parameter contracts (agents author the template with matching
 * {{1}}, {{2}} ... placeholders):
 *   - welcome:          {{1}} = customer name
 *   - order_confirmed:  {{1}} = customer name, {{2}} = order number, {{3}} = total
 *   - order_shipped:    {{1}} = customer name, {{2}} = order number, {{3}} = total
 */
class WhatsAppTemplateAutomationService
{
    public function __construct(protected WhatsAppCloudService $wa) {}

    public function sendWelcome(Conversation $conversation, Customer $customer): void
    {
        $name = $this->templateName($conversation->brand_id, 'welcome');
        if (! $name) return;
        $params = [$customer->full_name ?? 'client'];
        $this->fire($conversation, $name, $params, 'welcome');
    }

    public function sendOrderConfirmed(Order $order): void
    {
        $name = $this->templateName($order->brand_id, 'order_confirmed');
        if (! $name) return;
        $conversation = $this->resolveConversationForOrder($order);
        if (! $conversation) return;
        $params = [
            (string) ($order->customer?->full_name ?? 'client'),
            (string) ($order->reference ?? '#' . $order->id),
            $this->formatMoney((float) $order->total_amount ?? 0),
        ];
        $this->fire($conversation, $name, $params, 'order_confirmed');
    }

    public function sendOrderShipped(Order $order): void
    {
        $name = $this->templateName($order->brand_id, 'order_shipped');
        if (! $name) return;
        $conversation = $this->resolveConversationForOrder($order);
        if (! $conversation) return;
        $params = [
            (string) ($order->customer?->full_name ?? 'client'),
            (string) ($order->reference ?? '#' . $order->id),
            $this->formatMoney((float) $order->total_amount ?? 0),
        ];
        $this->fire($conversation, $name, $params, 'order_shipped');
    }

    /**
     * Send the template through Meta, persist the rendered body as an
     * outbound Message so the UI reads the actual text (not
     * "[Template: name]").
     */
    private function fire(Conversation $conversation, string $templateName, array $params, string $event): void
    {
        $conversation->loadMissing(['customer', 'whatsappNumber']);
        $recipient = $conversation->external_thread_id;
        if (! $recipient && $conversation->customer?->phone) {
            $recipient = PhoneNormalizer::toWhatsAppId($conversation->customer->phone);
        }
        if (! $recipient) {
            Log::info('wa.auto_template.skip_no_recipient', ['event' => $event, 'conv' => $conversation->id]);
            return;
        }

        try {
            $wamid = $this->wa->sendTemplate(
                $conversation->brand_id,
                $recipient,
                $templateName,
                'fr',
                $params,
                $conversation->whatsappNumber,
            );

            $rendered = $this->renderBody($conversation->brand_id, $templateName, $params, $conversation->whatsappNumber);

            Message::query()->create([
                'conversation_id' => $conversation->id,
                'sender_user_id' => null,
                'direction' => 'outbound',
                'content' => $rendered !== '' ? $rendered : '[Template: ' . $templateName . ']',
                'message_type' => 'template',
                'external_message_id' => $wamid ?: null,
                'sent_at' => now(),
                'delivery_status' => $wamid ? 'sent' : null,
            ]);

            if (! $conversation->external_thread_id) {
                $conversation->external_thread_id = $recipient;
            }
            $conversation->last_message_at = now();
            $conversation->save();
        } catch (\Throwable $e) {
            // A failed auto-template shouldn't break the calling flow (order
            // confirm, inbound webhook, ...). Persist a "failed" row instead
            // so the agent sees what went wrong.
            Log::warning('wa.auto_template.failed', ['event' => $event, 'template' => $templateName, 'error' => $e->getMessage()]);
            Message::query()->create([
                'conversation_id' => $conversation->id,
                'sender_user_id' => null,
                'direction' => 'outbound',
                'content' => '[Template: ' . $templateName . ']',
                'message_type' => 'template',
                'sent_at' => now(),
                'delivery_status' => 'failed',
                'delivery_error' => $e->getMessage(),
            ]);
        }
    }

    private function templateName(int $brandId, string $event): ?string
    {
        $key = match ($event) {
            'welcome' => 'wa_tpl_welcome',
            'order_confirmed' => 'wa_tpl_order_confirmation',
            'order_shipped' => 'wa_tpl_delivery',
            default => null,
        };
        if (! $key) return null;
        $row = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', $key)
            ->first();
        $val = trim((string) ($row?->setting_value ?? ''));
        return $val === '' ? null : $val;
    }

    private function resolveConversationForOrder(Order $order): ?Conversation
    {
        $order->loadMissing('customer');
        $customerId = $order->customer_id;
        if (! $customerId) return null;
        return Conversation::query()
            ->where('brand_id', $order->brand_id)
            ->where('customer_id', $customerId)
            ->where('channel', WhatsAppCloudService::CHANNEL)
            ->orderByDesc('last_message_at')
            ->first();
    }

    /**
     * Fetch the template body from Meta (cached 5 min per brand) and
     * substitute {{1}}, {{2}}, ... with the positional parameters.
     */
    private function renderBody(int $brandId, string $templateName, array $params, ?WhatsAppNumber $number): string
    {
        try {
            $templates = Cache::remember(
                "wa_templates_brand_{$brandId}",
                300,
                fn () => $this->wa->fetchTemplates($brandId),
            );
        } catch (\Throwable $e) {
            return '';
        }
        $body = '';
        foreach ($templates as $t) {
            if (($t['name'] ?? null) === $templateName) {
                $body = (string) ($t['body'] ?? '');
                break;
            }
        }
        if ($body === '') return '';
        $i = 1;
        foreach (array_values($params) as $v) {
            $body = str_replace('{{' . $i . '}}', (string) $v, $body);
            $i++;
        }
        return $body;
    }

    private function formatMoney(float $v): string
    {
        return number_format($v, 2, ',', ' ') . ' MAD';
    }

    public static function renderStoredBody(int $brandId, string $templateName, array $params, WhatsAppCloudService $wa): string
    {
        return (new self($wa))->renderBody($brandId, $templateName, $params, null);
    }
}
