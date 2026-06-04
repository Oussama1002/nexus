<?php

namespace App\Services;

use App\Models\DeliveryCompany;
use App\Models\SystemSetting;
use App\Services\Delivery\Providers\AmeexDeliveryProvider;
use App\Services\Delivery\Providers\SenditDeliveryProvider;
use App\Services\Meta\MetaAdsSyncService;
use App\Services\Meta\MetaApiException;

/**
 * Vérifications « test connexion » pour les intégrations du centre de paramètres.
 */
class SettingsConnectionTestService
{
    private function row(int $brandId, string $key): ?SystemSetting
    {
        return SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', $key)
            ->first();
    }

    private function val(int $brandId, string $key): string
    {
        return trim((string) ($this->row($brandId, $key)?->setting_value ?? ''));
    }

    private function hasSecret(int $brandId, string $key): bool
    {
        $v = $this->val($brandId, $key);

        return $v !== '' && ! preg_match('/^\*+$/', $v);
    }

    /** @return array{success: bool, message: string} */
    public function smtp(int $brandId): array
    {
        $host = $this->val($brandId, 'smtp_host');
        $port = $this->val($brandId, 'smtp_port');
        $user = $this->val($brandId, 'smtp_user');
        if ($host === '' || $port === '' || $user === '') {
            return ['success' => false, 'message' => 'Configuration incomplète.'];
        }
        if (! $this->hasSecret($brandId, 'smtp_password')) {
            return ['success' => false, 'message' => 'Configuration incomplète.'];
        }

        return ['success' => true, 'message' => 'Paramètres SMTP présents — test réseau non exécuté dans cette version.'];
    }

    /** @return array{success: bool, message: string} */
    public function whatsapp(int $brandId): array
    {
        $phoneId = $this->val($brandId, 'wa_phone_id') ?: $this->val($brandId, 'whatsapp_phone_id');
        if ($phoneId === '') {
            return ['success' => false, 'message' => 'Phone ID manquant.'];
        }
        $token = $this->val($brandId, 'wa_api_token') ?: $this->val($brandId, 'whatsapp_api_token');
        if ($token === '' || preg_match('/^\*+$/', $token)) {
            return ['success' => false, 'message' => 'Jeton API manquant.'];
        }

        // Real API call to verify credentials
        $baseUrl = $this->val($brandId, 'wa_api_base_url');
        if ($baseUrl === '') {
            $baseUrl = 'https://graph.facebook.com/v25.0';
        }
        $baseUrl = rtrim($baseUrl, '/');

        try {
            $res = \Illuminate\Support\Facades\Http::withToken($token)
                ->acceptJson()
                ->timeout(10)
                ->get("{$baseUrl}/{$phoneId}");

            if ($res->successful()) {
                $name = $res->json('verified_name') ?? $res->json('display_phone_number') ?? '';
                $suffix = $name ? " ({$name})" : '';

                return ['success' => true, 'message' => "Connexion WhatsApp OK{$suffix}."];
            }

            $errMsg = $res->json('error.message') ?? $res->body();

            return ['success' => false, 'message' => "Erreur Meta API: {$errMsg}"];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => 'Erreur de connexion: '.$e->getMessage()];
        }
    }

    /** @return array{success: bool, message: string} */
    public function meta(int $brandId): array
    {
        try {
            return app(MetaAdsSyncService::class)->testConnection($brandId);
        } catch (MetaApiException $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /** @return array{success: bool, message: string} */
    public function delivery(int $brandId): array
    {
        $messages = [];
        $anyOk = false;

        $senditCompany = DeliveryCompany::query()->where('code', 'sendit')->first();
        if ($senditCompany) {
            $public = trim((string) ($senditCompany->api_key_ref ?? ''));
            $secret = trim((string) ($senditCompany->api_key ?? ''));
            if ($public !== '' && $secret !== '') {
                $result = (new SenditDeliveryProvider($senditCompany))->testConnection([
                    'public_key' => $public,
                    'secret_key' => $secret,
                ]);
                $messages[] = 'Sendit: '.$result['message'];
                $anyOk = $anyOk || ($result['ok'] ?? false);
            }
        }

        if (! $anyOk) {
            $public = $this->val($brandId, 'carrier_sendit_public_key');
            $secretOk = $this->hasSecret($brandId, 'carrier_sendit_secret_key');
            $publicOk = $public !== '' && ! preg_match('/^\*+$/', $public);
            if ($publicOk && $secretOk) {
                $company = new DeliveryCompany([
                    'code' => 'sendit',
                    'api_url' => $this->val($brandId, 'carrier_sendit_api_url') ?: config('delivery.sendit.api_url'),
                    'api_key_ref' => $public,
                    'api_key' => $this->val($brandId, 'carrier_sendit_secret_key'),
                ]);
                $result = (new SenditDeliveryProvider($company))->testConnection([
                    'public_key' => $public,
                    'secret_key' => $this->val($brandId, 'carrier_sendit_secret_key'),
                ]);
                $messages[] = 'Sendit: '.$result['message'];
                $anyOk = $anyOk || ($result['ok'] ?? false);
            }
        }

        $ameexCompany = DeliveryCompany::query()->where('code', 'ameex')->first();
        if ($ameexCompany && filled($ameexCompany->integrationApiKey())) {
            $result = (new AmeexDeliveryProvider($ameexCompany))->testConnection([
                'api_key' => (string) $ameexCompany->integrationApiKey(),
            ]);
            $messages[] = 'Ameex: '.$result['message'];
            $anyOk = $anyOk || ($result['ok'] ?? false);
        }

        if (! $anyOk && $this->hasSecret($brandId, 'carrier_ameex_api_key')) {
            $company = new DeliveryCompany([
                'code' => 'ameex',
                'api_url' => $this->val($brandId, 'carrier_ameex_api_url') ?: config('delivery.ameex.api_url'),
                'api_key_ref' => $this->val($brandId, 'carrier_ameex_api_key'),
            ]);
            $result = (new AmeexDeliveryProvider($company))->testConnection([
                'api_key' => $this->val($brandId, 'carrier_ameex_api_key'),
            ]);
            $messages[] = 'Ameex: '.$result['message'];
            $anyOk = $anyOk || ($result['ok'] ?? false);
        }

        if (! $anyOk && $messages === []) {
            return ['success' => false, 'message' => 'Configuration incomplète — configurez Sendit ou Ameex.'];
        }

        return [
            'success' => $anyOk,
            'message' => $anyOk
                ? implode(' ', $messages)
                : (implode(' ', $messages) ?: 'Aucun transporteur connecté.'),
        ];
    }
}
