<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\SettingsCenterAuditLog;
use App\Models\SystemSetting;
use App\Support\SystemSettingRegistry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Couche métier : exposition des réglages en JSON structuré (pas de clés techniques vers le client).
 * Persistance interne : table system_settings.
 */
class SettingsCenterService
{
    /** @return array<string, mixed> */
    public function get(string $section, int $brandId): array
    {
        return match ($section) {
            'general' => $this->getGeneral($brandId),
            'catalogue' => $this->getCatalogue($brandId),
            'integrations' => $this->getIntegrations($brandId),
            'delivery' => $this->getDelivery($brandId),
            'whatsapp' => $this->getWhatsapp($brandId),
            'meta' => $this->getMeta($brandId),
            'finance' => $this->getFinance($brandId),
            'security' => $this->getSecurity($brandId),
            default => [],
        };
    }

    /** @param  array<string, mixed>  $payload */
    public function save(Request $request, string $section, int $brandId, array $payload, bool $isAdmin): void
    {
        match ($section) {
            'general' => $this->saveGeneral($brandId, $payload),
            'catalogue' => $this->saveCatalogue($brandId, $payload),
            'integrations' => $this->saveIntegrations($brandId, $payload, $isAdmin),
            'delivery' => $this->saveDelivery($brandId, $payload, $isAdmin),
            'whatsapp' => $this->saveWhatsapp($brandId, $payload, $isAdmin),
            'meta' => $this->saveMeta($brandId, $payload, $isAdmin),
            'finance' => $this->saveFinance($brandId, $payload),
            'security' => $this->saveSecurity($brandId, $payload),
            default => null,
        };

        SettingsCenterAuditLog::query()->create([
            'brand_id' => $brandId,
            'user_id' => $request->user()?->id,
            'section' => $section,
        ]);

        AuditService::log($request, 'settings.center_save', null, null, [
            'section' => $section,
            'brand_id' => $brandId,
        ]);
    }

    private function getRaw(int $brandId, string $key): ?string
    {
        $row = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', $key)
            ->first();

        return $row?->setting_value;
    }

    private function hasStoredValue(int $brandId, string $key): bool
    {
        $v = $this->getRaw($brandId, $key);

        return $v !== null && trim((string) $v) !== '';
    }

    /** @return array<string, mixed> */
    private function getGeneral(int $brandId): array
    {
        return [
            'company' => [
                'name' => $this->getRaw($brandId, 'company_name') ?? '',
                'logoUrl' => $this->getRaw($brandId, 'company_logo_url') ?? '',
                'phone' => $this->getRaw($brandId, 'company_phone') ?? '',
                'email' => $this->getRaw($brandId, 'company_email') ?? '',
                'address' => $this->getRaw($brandId, 'company_address') ?? '',
                'city' => $this->getRaw($brandId, 'company_city') ?? '',
                'website' => $this->getRaw($brandId, 'company_website') ?? '',
                'ice' => $this->getRaw($brandId, 'company_ice') ?? '',
                'ifNumber' => $this->getRaw($brandId, 'company_if') ?? '',
                'rc' => $this->getRaw($brandId, 'company_rc') ?? '',
            ],
            'system' => [
                'timezone' => $this->getRaw($brandId, 'system_timezone') ?? '',
                'defaultLanguage' => $this->getRaw($brandId, 'system_default_language') ?? '',
                'currency' => $this->getRaw($brandId, 'system_currency') ?? 'MAD',
                'dateFormat' => $this->getRaw($brandId, 'system_date_format') ?? '',
            ],
            'branding' => [
                'primaryColor' => $this->getRaw($brandId, 'brand_primary_color') ?? '',
                'crmDisplayName' => $this->getRaw($brandId, 'brand_crm_display_name') ?? '',
            ],
            'workflow' => [
                'defaultLeadStatus' => $this->getRaw($brandId, 'workflow_default_lead_status') ?? '',
                'defaultOrderStatus' => $this->getRaw($brandId, 'workflow_default_order_status') ?? '',
                'leadSlaHours' => $this->getRaw($brandId, 'workflow_lead_sla_hours') ?? '',
            ],
            'navigation' => [
                'items' => $this->decodeSidebarNavVisibility($brandId),
            ],
        ];
    }

    /**
     * Public accessor for sidebar-nav visibility (used by the lightweight endpoint).
     *
     * @return array<string, bool>
     */
    public function getSidebarNavVisibility(int $brandId): array
    {
        return $this->decodeSidebarNavVisibility($brandId);
    }

    /** @return array<string, mixed> */
    private function getCatalogue(int $brandId): array
    {
        return [
            'productCategories' => $this->decodeJsonList($brandId, 'product_categories'),
            'productTypes' => $this->decodeJsonList($brandId, 'product_types'),
            'supplierCategories' => $this->decodeJsonList($brandId, 'supplier_categories'),
        ];
    }

    /** @param  array<string, mixed>  $p */
    private function saveCatalogue(int $brandId, array $p): void
    {
        DB::transaction(function () use ($p) {
            $cats = is_array($p['productCategories'] ?? null) ? array_values(array_filter($p['productCategories'], 'is_string')) : [];
            $types = is_array($p['productTypes'] ?? null) ? array_values(array_filter($p['productTypes'], 'is_string')) : [];
            $supCats = is_array($p['supplierCategories'] ?? null) ? array_values(array_filter($p['supplierCategories'], 'is_string')) : [];
            $this->upsertAll('catalogue', 'product_categories', json_encode($cats, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
            $this->upsertAll('catalogue', 'product_types', json_encode($types, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
            $this->upsertAll('catalogue', 'supplier_categories', json_encode($supCats, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        });
    }

    /**
     * Public accessor for product categories & types (used by the lightweight endpoint).
     *
     * @return array{categories: string[], types: string[]}
     */
    public function getProductOptions(int $brandId): array
    {
        return [
            'categories' => $this->decodeJsonList($brandId, 'product_categories'),
            'types' => $this->decodeJsonList($brandId, 'product_types'),
        ];
    }

    /** @return string[] */
    public function getSupplierCategories(int $brandId): array
    {
        return $this->decodeJsonList($brandId, 'supplier_categories');
    }

    /** Append a single value to a JSON list setting (used by quick-add endpoints). */
    public function appendToJsonList(int $brandId, string $group, string $key, string $value): void
    {
        $list = $this->decodeJsonList($brandId, $key);
        if (! in_array($value, $list, true)) {
            $list[] = $value;
            $this->upsertAll($group, $key, json_encode($list, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        }
    }

    /** @return string[] */
    private function decodeJsonList(int $brandId, string $key): array
    {
        $raw = $this->getRaw($brandId, $key);
        if ($raw === null || trim((string) $raw) === '') {
            return [];
        }

        try {
            $decoded = json_decode((string) $raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        if (! is_array($decoded)) {
            return [];
        }

        return array_values(array_filter($decoded, 'is_string'));
    }

    /** @return array<string, bool> */
    private function decodeSidebarNavVisibility(int $brandId): array
    {
        // Sidebar nav visibility is global — fetch from any brand that has the setting
        $row = SystemSetting::query()
            ->where('setting_key', 'sidebar_nav_visibility')
            ->whereNotNull('setting_value')
            ->where('setting_value', '!=', '')
            ->first();
        $raw = $row?->setting_value;
        if ($raw === null || trim((string) $raw) === '') {
            return [];
        }

        try {
            $decoded = json_decode((string) $raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }

        if (! is_array($decoded)) {
            return [];
        }

        $items = [];
        foreach ($decoded as $key => $visible) {
            if (! is_string($key)) {
                continue;
            }
            $items[$key] = filter_var($visible, FILTER_VALIDATE_BOOL);
        }

        return $items;
    }

    /** @param  array<string, mixed>  $p */
    private function saveGeneral(int $brandId, array $p): void
    {
        DB::transaction(function () use ($p) {
            $c = $p['company'] ?? [];
            $this->upsertAll('general', 'company_name', $c['name'] ?? '');
            $this->upsertAll('general', 'company_logo_url', $c['logoUrl'] ?? '');
            $this->upsertAll('general', 'company_phone', $c['phone'] ?? '');
            $this->upsertAll('general', 'company_email', $c['email'] ?? '');
            $this->upsertAll('general', 'company_address', $c['address'] ?? '');
            $this->upsertAll('general', 'company_city', $c['city'] ?? '');
            $this->upsertAll('general', 'company_website', $c['website'] ?? '');
            $this->upsertAll('general', 'company_ice', $c['ice'] ?? '');
            $this->upsertAll('general', 'company_if', $c['ifNumber'] ?? '');
            $this->upsertAll('general', 'company_rc', $c['rc'] ?? '');
            $s = $p['system'] ?? [];
            $this->upsertAll('general', 'system_timezone', $s['timezone'] ?? '');
            $this->upsertAll('general', 'system_default_language', $s['defaultLanguage'] ?? '');
            $this->upsertAll('general', 'system_currency', $s['currency'] ?? '');
            $this->upsertAll('general', 'system_date_format', $s['dateFormat'] ?? '');
            $b = $p['branding'] ?? [];
            $this->upsertAll('general', 'brand_primary_color', $b['primaryColor'] ?? '');
            $this->upsertAll('general', 'brand_crm_display_name', $b['crmDisplayName'] ?? '');
            $w = $p['workflow'] ?? [];
            $this->upsertAll('general', 'workflow_default_lead_status', $w['defaultLeadStatus'] ?? '');
            $this->upsertAll('general', 'workflow_default_order_status', $w['defaultOrderStatus'] ?? '');
            $this->upsertAll('general', 'workflow_lead_sla_hours', $w['leadSlaHours'] ?? '');
            $nav = $p['navigation'] ?? [];
            $navItems = is_array($nav['items'] ?? null) ? $nav['items'] : [];
            $normalized = [];
            foreach ($navItems as $key => $visible) {
                if (! is_string($key)) {
                    continue;
                }
                $val = filter_var($visible, FILTER_VALIDATE_BOOL);
                if (! $val) {
                    $normalized[$key] = false;
                }
            }
            $navJson = json_encode($normalized, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
            $this->upsertAll('general', 'sidebar_nav_visibility', $navJson);
        });
    }

    /** @return array<string, mixed> */
    private function getIntegrations(int $brandId): array
    {
        return [
            'email' => [
                'smtpHost' => $this->getRaw($brandId, 'smtp_host') ?? '',
                'smtpPort' => $this->getRaw($brandId, 'smtp_port') ?? '',
                'smtpUser' => $this->getRaw($brandId, 'smtp_user') ?? '',
                'smtpPassword' => '',
                'smtpPasswordConfigured' => $this->hasStoredValue($brandId, 'smtp_password'),
                'smtpEncryption' => $this->getRaw($brandId, 'smtp_encryption') ?? '',
                'senderName' => $this->getRaw($brandId, 'smtp_sender_name') ?? '',
            ],
            'sms' => [
                'provider' => $this->getRaw($brandId, 'sms_provider') ?? '',
                'apiKey' => '',
                'apiKeyConfigured' => $this->hasStoredValue($brandId, 'sms_api_key'),
                'sender' => $this->getRaw($brandId, 'sms_sender') ?? '',
            ],
            'storage' => [
                'provider' => $this->getRaw($brandId, 'storage_driver') ?? '',
                'bucket' => $this->getRaw($brandId, 'storage_bucket') ?? '',
                'accessKey' => '',
                'accessKeyConfigured' => $this->hasStoredValue($brandId, 'storage_access_key'),
                'secretKey' => '',
                'secretKeyConfigured' => $this->hasStoredValue($brandId, 'storage_secret_key'),
            ],
            'webhooks' => [
                'url' => $this->getRaw($brandId, 'integration_webhook_url') ?? '',
                'secret' => '',
                'secretConfigured' => $this->hasStoredValue($brandId, 'integration_webhook_secret'),
            ],
        ];
    }

    /** @param  array<string, mixed>  $p */
    private function saveIntegrations(int $brandId, array $p, bool $isAdmin): void
    {
        $defs = SystemSettingRegistry::definitions('integrations');
        DB::transaction(function () use ($brandId, $p, $isAdmin, $defs) {
            $e = $p['email'] ?? [];
            $this->upsert($brandId, 'integrations', 'smtp_host', $e['smtpHost'] ?? '');
            $this->upsert($brandId, 'integrations', 'smtp_port', $e['smtpPort'] ?? '');
            $this->upsert($brandId, 'integrations', 'smtp_user', $e['smtpUser'] ?? '');
            $this->upsert($brandId, 'integrations', 'smtp_encryption', $e['smtpEncryption'] ?? '');
            $this->upsert($brandId, 'integrations', 'smtp_sender_name', $e['senderName'] ?? '');
            $pwd = $e['smtpPassword'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $pwd) && $pwd !== '') {
                $this->upsertSensitive($brandId, 'integrations', 'smtp_password', (string) $pwd, $defs);
            }
            $sms = $p['sms'] ?? [];
            $this->upsert($brandId, 'integrations', 'sms_provider', $sms['provider'] ?? '');
            $this->upsert($brandId, 'integrations', 'sms_sender', $sms['sender'] ?? '');
            $sk = $sms['apiKey'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $sk) && $sk !== '') {
                $this->upsertSensitive($brandId, 'integrations', 'sms_api_key', (string) $sk, $defs);
            }
            $st = $p['storage'] ?? [];
            $this->upsert($brandId, 'integrations', 'storage_driver', $st['provider'] ?? '');
            $this->upsert($brandId, 'integrations', 'storage_bucket', $st['bucket'] ?? '');
            $ak = $st['accessKey'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $ak) && $ak !== '') {
                $this->upsertSensitive($brandId, 'integrations', 'storage_access_key', (string) $ak, $defs);
            }
            $sek = $st['secretKey'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $sek) && $sek !== '') {
                $this->upsertSensitive($brandId, 'integrations', 'storage_secret_key', (string) $sek, $defs);
            }
            $wh = $p['webhooks'] ?? [];
            $this->upsert($brandId, 'integrations', 'integration_webhook_url', $wh['url'] ?? '');
            $wsec = $wh['secret'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $wsec) && $wsec !== '') {
                $this->upsertSensitive($brandId, 'integrations', 'integration_webhook_secret', (string) $wsec, $defs);
            }
        });
    }

    /** @return array<string, mixed> */
    private function getDelivery(int $brandId): array
    {
        return [
            'defaults' => [
                'defaultCarrierId' => $this->getRaw($brandId, 'delivery_default_company_id') ?? '',
                'defaultShippingFee' => $this->getRaw($brandId, 'delivery_default_fee') ?? '',
                'averageDeliveryDays' => $this->getRaw($brandId, 'delivery_avg_days') ?? '',
            ],
            'rules' => [
                'insuranceEnabled' => $this->boolFromStored($brandId, 'delivery_insurance_enabled'),
                'allowOpenPackage' => $this->boolFromStored($brandId, 'delivery_allow_open_package'),
                'autoTrackingNumber' => $this->boolFromStored($brandId, 'delivery_auto_tracking_number'),
                'autoSyncTracking' => $this->boolFromStored($brandId, 'delivery_auto_sync_tracking'),
            ],
            'carriers' => [
                'sendit' => [
                    'apiUrl' => $this->getRaw($brandId, 'carrier_sendit_api_url')
                        ?: (string) config('delivery.sendit.api_url', ''),
                    'publicKey' => '',
                    'publicKeyConfigured' => $this->hasStoredValue($brandId, 'carrier_sendit_public_key'),
                    'secretKey' => '',
                    'secretKeyConfigured' => $this->hasStoredValue($brandId, 'carrier_sendit_secret_key'),
                ],
                'ameex' => [
                    'apiUrl' => $this->getRaw($brandId, 'carrier_ameex_api_url')
                        ?: (string) config('delivery.ameex.api_url', ''),
                    'apiKey' => '',
                    'apiKeyConfigured' => $this->hasStoredValue($brandId, 'carrier_ameex_api_key'),
                ],
            ],
            'cod' => [
                'reconciliationDelayDays' => $this->getRaw($brandId, 'cod_reconciliation_delay_days') ?? '',
                'disputeTolerance' => $this->getRaw($brandId, 'cod_dispute_tolerance') ?? '',
            ],
        ];
    }

    private function boolFromStored(int $brandId, string $key): bool
    {
        $v = strtolower(trim((string) ($this->getRaw($brandId, $key) ?? '')));

        return in_array($v, ['1', 'true', 'oui', 'yes', 'on'], true);
    }

    /** @param  array<string, mixed>  $p */
    private function saveDelivery(int $brandId, array $p, bool $isAdmin): void
    {
        $defs = SystemSettingRegistry::definitions('delivery');
        DB::transaction(function () use ($brandId, $p, $isAdmin, $defs) {
            $d = $p['defaults'] ?? [];
            $this->upsert($brandId, 'delivery', 'delivery_default_company_id', $d['defaultCarrierId'] ?? '');
            $this->upsert($brandId, 'delivery', 'delivery_default_fee', $d['defaultShippingFee'] ?? '');
            $this->upsert($brandId, 'delivery', 'delivery_avg_days', $d['averageDeliveryDays'] ?? '');
            $r = $p['rules'] ?? [];
            $this->upsert($brandId, 'delivery', 'delivery_insurance_enabled', ! empty($r['insuranceEnabled']) ? '1' : '0');
            $this->upsert($brandId, 'delivery', 'delivery_allow_open_package', ! empty($r['allowOpenPackage']) ? '1' : '0');
            $this->upsert($brandId, 'delivery', 'delivery_auto_tracking_number', ! empty($r['autoTrackingNumber']) ? '1' : '0');
            $this->upsert($brandId, 'delivery', 'delivery_auto_sync_tracking', ! empty($r['autoSyncTracking']) ? '1' : '0');
            $car = $p['carriers'] ?? [];
            $si = $car['sendit'] ?? [];
            $this->upsert($brandId, 'delivery', 'carrier_sendit_api_url', $si['apiUrl'] ?? '');
            $spk = $si['publicKey'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $spk) && $spk !== '') {
                $this->upsertSensitive($brandId, 'delivery', 'carrier_sendit_public_key', (string) $spk, $defs);
            }
            $ssk = $si['secretKey'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $ssk) && $ssk !== '') {
                $this->upsertSensitive($brandId, 'delivery', 'carrier_sendit_secret_key', (string) $ssk, $defs);
            }
            $ax = $car['ameex'] ?? [];
            $this->upsert($brandId, 'delivery', 'carrier_ameex_api_url', $ax['apiUrl'] ?? '');
            $ak = $ax['apiKey'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $ak) && $ak !== '') {
                $this->upsertSensitive($brandId, 'delivery', 'carrier_ameex_api_key', (string) $ak, $defs);
            }
            $cod = $p['cod'] ?? [];
            $this->upsert($brandId, 'delivery', 'cod_reconciliation_delay_days', $cod['reconciliationDelayDays'] ?? '');
            $this->upsert($brandId, 'delivery', 'cod_dispute_tolerance', $cod['disputeTolerance'] ?? '');
        });
    }

    /** @return array<string, mixed> */
    private function getWhatsapp(int $brandId): array
    {
        $tokenConfigured = $this->hasStoredValue($brandId, 'wa_api_token')
            || $this->hasStoredValue($brandId, 'whatsapp_api_token');
        $verifyConfigured = $this->hasStoredValue($brandId, 'wa_webhook_verify_token')
            || $this->hasStoredValue($brandId, 'whatsapp_webhook_secret');

        return [
            'connection' => [
                'provider' => $this->getRaw($brandId, 'wa_provider') ?? $this->getRaw($brandId, 'whatsapp_provider') ?? '',
                'apiBaseUrl' => $this->getRaw($brandId, 'wa_api_base_url') ?? $this->getRaw($brandId, 'whatsapp_api_url') ?? '',
                'businessNumber' => $this->getRaw($brandId, 'wa_business_number') ?? '',
                'businessAccountId' => $this->getRaw($brandId, 'wa_business_account_id') ?? $this->getRaw($brandId, 'whatsapp_business_account_id') ?? '',
                'apiToken' => '',
                'apiTokenConfigured' => $tokenConfigured,
                'phoneId' => $this->getRaw($brandId, 'wa_phone_id') ?? $this->getRaw($brandId, 'whatsapp_phone_id') ?? '',
                'webhookVerifyToken' => '',
                'webhookVerifyConfigured' => $verifyConfigured,
                'webhookUrlHint' => $this->getRaw($brandId, 'wa_webhook_display_url') ?? '',
            ],
            'automation' => [
                'autoCreateLead' => $this->boolFromStored($brandId, 'wa_auto_create_lead'),
                'autoAssignConversation' => $this->boolFromStored($brandId, 'wa_auto_assign_conversations'),
                'autoReplies' => $this->boolFromStored($brandId, 'wa_enable_auto_replies'),
                'defaultWelcomeMessage' => $this->getRaw($brandId, 'wa_default_welcome_message') ?? '',
            ],
            'templates' => [
                'orderConfirmation' => $this->getRaw($brandId, 'wa_tpl_order_confirmation') ?? '',
                'delivery' => $this->getRaw($brandId, 'wa_tpl_delivery') ?? '',
                'followUp' => $this->getRaw($brandId, 'wa_tpl_relance') ?? '',
                'upsell' => $this->getRaw($brandId, 'wa_tpl_upsell') ?? '',
            ],
        ];
    }

    /** @param  array<string, mixed>  $p */
    private function saveWhatsapp(int $brandId, array $p, bool $isAdmin): void
    {
        $defs = SystemSettingRegistry::definitions('whatsapp');
        DB::transaction(function () use ($brandId, $p, $isAdmin, $defs) {
            $c = $p['connection'] ?? [];
            $this->upsert($brandId, 'whatsapp', 'wa_provider', $c['provider'] ?? '');
            $this->upsert($brandId, 'whatsapp', 'wa_api_base_url', $c['apiBaseUrl'] ?? '');
            $this->upsert($brandId, 'whatsapp', 'wa_business_number', $c['businessNumber'] ?? '');
            $this->upsert($brandId, 'whatsapp', 'wa_business_account_id', $c['businessAccountId'] ?? '');
            $this->upsert($brandId, 'whatsapp', 'wa_phone_id', $c['phoneId'] ?? '');
            $this->upsert($brandId, 'whatsapp', 'wa_webhook_display_url', $c['webhookUrlHint'] ?? '');
            $tok = $c['apiToken'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $tok) && $tok !== '') {
                $this->upsertSensitive($brandId, 'whatsapp', 'wa_api_token', (string) $tok, $defs);
            }
            $vt = $c['webhookVerifyToken'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $vt) && $vt !== '') {
                $this->upsertSensitive($brandId, 'whatsapp', 'wa_webhook_verify_token', (string) $vt, $defs);
            }
            $a = $p['automation'] ?? [];
            $this->upsert($brandId, 'whatsapp', 'wa_auto_create_lead', ! empty($a['autoCreateLead']) ? '1' : '0');
            $this->upsert($brandId, 'whatsapp', 'wa_auto_assign_conversations', ! empty($a['autoAssignConversation']) ? '1' : '0');
            $this->upsert($brandId, 'whatsapp', 'wa_enable_auto_replies', ! empty($a['autoReplies']) ? '1' : '0');
            $this->upsert($brandId, 'whatsapp', 'wa_default_welcome_message', $a['defaultWelcomeMessage'] ?? '');
            $t = $p['templates'] ?? [];
            $this->upsert($brandId, 'whatsapp', 'wa_tpl_order_confirmation', $t['orderConfirmation'] ?? '');
            $this->upsert($brandId, 'whatsapp', 'wa_tpl_delivery', $t['delivery'] ?? '');
            $this->upsert($brandId, 'whatsapp', 'wa_tpl_relance', $t['followUp'] ?? '');
            $this->upsert($brandId, 'whatsapp', 'wa_tpl_upsell', $t['upsell'] ?? '');
        });
    }

    /** @return array<string, mixed> */
    private function getMeta(int $brandId): array
    {
        return [
            'credentials' => [
                'appId' => $this->getRaw($brandId, 'meta_app_id') ?? '',
                'appSecret' => '',
                'appSecretConfigured' => $this->hasStoredValue($brandId, 'meta_app_secret'),
                'accessToken' => '',
                'accessTokenConfigured' => $this->hasStoredValue($brandId, 'meta_access_token'),
                'businessId' => $this->getRaw($brandId, 'meta_business_id') ?? '',
            ],
            'ads' => [
                'attributionWindowDays' => $this->getRaw($brandId, 'meta_attribution_window_days') ?? '',
                'syncFrequencyMinutes' => $this->getRaw($brandId, 'meta_sync_frequency_minutes') ?? '',
                'currency' => $this->getRaw($brandId, 'meta_currency') ?? '',
            ],
            'targets' => [
                'cac' => $this->getRaw($brandId, 'meta_target_cac') ?? '',
                'cpa' => $this->getRaw($brandId, 'meta_target_cpa') ?? '',
                'roas' => $this->getRaw($brandId, 'meta_target_roas') ?? '',
            ],
        ];
    }

    /** @param  array<string, mixed>  $p */
    private function saveMeta(int $brandId, array $p, bool $isAdmin): void
    {
        $defs = SystemSettingRegistry::definitions('meta');
        DB::transaction(function () use ($brandId, $p, $isAdmin, $defs) {
            $cr = $p['credentials'] ?? [];
            $this->upsert($brandId, 'meta', 'meta_app_id', $cr['appId'] ?? '');
            $this->upsert($brandId, 'meta', 'meta_business_id', $cr['businessId'] ?? '');
            $sec = $cr['appSecret'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $sec) && $sec !== '') {
                $this->upsertSensitive($brandId, 'meta', 'meta_app_secret', (string) $sec, $defs);
            }
            $at = $cr['accessToken'] ?? '';
            if ($isAdmin && ! SystemSetting::valueIsUnchangedSecretPlaceholder((string) $at) && $at !== '') {
                $this->upsertSensitive($brandId, 'meta', 'meta_access_token', (string) $at, $defs);
            }
            $ad = $p['ads'] ?? [];
            $this->upsert($brandId, 'meta', 'meta_attribution_window_days', $ad['attributionWindowDays'] ?? '');
            $this->upsert($brandId, 'meta', 'meta_sync_frequency_minutes', $ad['syncFrequencyMinutes'] ?? '');
            $this->upsert($brandId, 'meta', 'meta_currency', $ad['currency'] ?? '');
            $tg = $p['targets'] ?? [];
            $this->upsert($brandId, 'meta', 'meta_target_cac', $tg['cac'] ?? '');
            $this->upsert($brandId, 'meta', 'meta_target_cpa', $tg['cpa'] ?? '');
            $this->upsert($brandId, 'meta', 'meta_target_roas', $tg['roas'] ?? '');
        });
    }

    /** @return array<string, mixed> */
    private function getFinance(int $brandId): array
    {
        return [
            'global' => [
                'taxPercent' => $this->getRaw($brandId, 'finance_tax_percent') ?? '',
                'invoicePrefix' => $this->getRaw($brandId, 'finance_invoice_prefix') ?? '',
                'invoiceAutoNumbering' => $this->boolFromStored($brandId, 'finance_invoice_auto_numbering'),
            ],
            'cod' => [
                'delayDays' => $this->getRaw($brandId, 'finance_cod_delay_days') ?? '',
            ],
            'charges' => [
                'categories' => $this->getRaw($brandId, 'finance_charge_categories') ?? '',
                'expenseValidation' => $this->getRaw($brandId, 'finance_expense_validation') ?? '',
            ],
            'accounting' => [
                'enableExport' => $this->boolFromStored($brandId, 'finance_enable_accounting_export'),
                'exportFormat' => $this->getRaw($brandId, 'finance_export_format') ?? '',
            ],
        ];
    }

    /** @param  array<string, mixed>  $p */
    private function saveFinance(int $brandId, array $p): void
    {
        DB::transaction(function () use ($p) {
            $g = $p['global'] ?? [];
            $this->upsertAll('finance', 'finance_tax_percent', $g['taxPercent'] ?? '');
            $this->upsertAll('finance', 'finance_invoice_prefix', $g['invoicePrefix'] ?? '');
            $this->upsertAll('finance', 'finance_invoice_auto_numbering', ! empty($g['invoiceAutoNumbering']) ? '1' : '0');
            $cod = $p['cod'] ?? [];
            $this->upsertAll('finance', 'finance_cod_delay_days', $cod['delayDays'] ?? '');
            $ch = $p['charges'] ?? [];
            $this->upsertAll('finance', 'finance_charge_categories', $ch['categories'] ?? '');
            $this->upsertAll('finance', 'finance_expense_validation', $ch['expenseValidation'] ?? '');
            $ac = $p['accounting'] ?? [];
            $this->upsertAll('finance', 'finance_enable_accounting_export', ! empty($ac['enableExport']) ? '1' : '0');
            $this->upsertAll('finance', 'finance_export_format', $ac['exportFormat'] ?? '');
        });
    }

    /** @return array<string, mixed> */
    private function getSecurity(int $brandId): array
    {
        return [
            'auth' => [
                'enable2fa' => $this->boolFromStored($brandId, 'security_enable_2fa'),
                'sessionTimeoutMinutes' => $this->getRaw($brandId, 'security_session_duration_minutes') ?? '',
                'maxLoginAttempts' => $this->getRaw($brandId, 'security_max_login_attempts') ?? '',
            ],
            'passwords' => [
                'minLength' => $this->getRaw($brandId, 'security_password_min_length') ?? '',
                'requireComplexity' => $this->boolFromStored($brandId, 'security_password_require_complexity'),
            ],
            'network' => [
                'ipWhitelist' => $this->getRaw($brandId, 'security_ip_whitelist') ?? '',
                'allowedOrigins' => $this->getRaw($brandId, 'security_allowed_origins') ?? '',
            ],
            'data' => [
                'encryptSensitiveFields' => $this->boolFromStored($brandId, 'security_encrypt_sensitive_fields'),
                'auditRetentionDays' => $this->getRaw($brandId, 'security_audit_retention_days') ?? '',
            ],
        ];
    }

    /** @param  array<string, mixed>  $p */
    private function saveSecurity(int $brandId, array $p): void
    {
        DB::transaction(function () use ($p) {
            $a = $p['auth'] ?? [];
            $this->upsertAll('security', 'security_enable_2fa', ! empty($a['enable2fa']) ? '1' : '0');
            $this->upsertAll('security', 'security_session_duration_minutes', $a['sessionTimeoutMinutes'] ?? '');
            $this->upsertAll('security', 'security_max_login_attempts', $a['maxLoginAttempts'] ?? '');
            $pw = $p['passwords'] ?? [];
            $this->upsertAll('security', 'security_password_min_length', $pw['minLength'] ?? '');
            $this->upsertAll('security', 'security_password_require_complexity', ! empty($pw['requireComplexity']) ? '1' : '0');
            $n = $p['network'] ?? [];
            $this->upsertAll('security', 'security_ip_whitelist', $n['ipWhitelist'] ?? '');
            $this->upsertAll('security', 'security_allowed_origins', $n['allowedOrigins'] ?? '');
            $d = $p['data'] ?? [];
            $this->upsertAll('security', 'security_encrypt_sensitive_fields', ! empty($d['encryptSensitiveFields']) ? '1' : '0');
            $this->upsertAll('security', 'security_audit_retention_days', $d['auditRetentionDays'] ?? '');
        });
    }

    private function upsert(int $brandId, string $group, string $key, string $value): void
    {
        $defs = SystemSettingRegistry::definitions($group);
        $meta = $defs[$key] ?? ['sensitive' => false, 'description' => null];
        SystemSetting::query()->updateOrCreate(
            ['brand_id' => $brandId, 'setting_key' => $key],
            [
                'setting_group' => $group,
                'setting_value' => $value,
                'is_sensitive' => $meta['sensitive'] ?? false,
                'description' => $meta['description'] ?? null,
            ]
        );
    }

    private function upsertAll(string $group, string $key, string $value): void
    {
        $brandIds = Brand::query()->pluck('id');
        foreach ($brandIds as $bid) {
            $this->upsert((int) $bid, $group, $key, $value);
        }
    }

    /**
     * @param  array{sensitive: bool, description: string}  $defs
     */
    private function upsertSensitive(int $brandId, string $group, string $key, string $value, array $allDefs): void
    {
        $meta = $allDefs[$key] ?? ['sensitive' => true, 'description' => null];
        SystemSetting::query()->updateOrCreate(
            ['brand_id' => $brandId, 'setting_key' => $key],
            [
                'setting_group' => $group,
                'setting_value' => $value,
                'is_sensitive' => true,
                'description' => $meta['description'] ?? null,
            ]
        );
    }

    /**
     * @throws \InvalidArgumentException
     */
    public function storeCompanyLogo(int $brandId, \Illuminate\Http\UploadedFile $file): string
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: 'png');
        if (! in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'], true)) {
            throw new \InvalidArgumentException('Format non supporté (JPG, PNG, GIF, WebP ou SVG).');
        }

        $dir = 'brand-logos/shared';
        $filename = 'logo.'.$ext;

        \Illuminate\Support\Facades\Storage::disk('public')->deleteDirectory($dir);
        $path = $file->storeAs($dir, $filename, 'public');

        $url = '/storage/'.$path;
        $this->upsertAll('general', 'company_logo_url', $url);

        return $url;
    }
}
