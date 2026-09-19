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
        $brandMailer = app(BrandMailer::class);
        $s = $brandMailer->settings($brandId);
        if (! $s) {
            return ['success' => false, 'message' => 'Configuration incomplète : choisissez le fournisseur, saisissez l’e-mail et le mot de passe, puis enregistrez.'];
        }

        if (preg_match('/@(gmail|googlemail)\.com$/i', $s['user']) && strtolower($s['host']) !== 'smtp.gmail.com') {
            return ['success' => false, 'message' => 'Cette adresse est une adresse Gmail : choisissez « Gmail / Google Workspace » comme fournisseur.'];
        }
        if (strtolower($s['host']) === 'smtp.gmail.com' && strlen($s['password']) !== 16) {
            return ['success' => false, 'message' => 'Le mot de passe enregistré n’est pas un mot de passe d’application Google (16 lettres). Créez-en un sur myaccount.google.com/apppasswords, collez-le dans « Mot de passe », enregistrez, puis retestez.'];
        }

        try {
            $brandMailer->for($brandId)->raw(
                "Bonjour,\n\nCet e-mail confirme que l’envoi depuis le CRM fonctionne.\n",
                fn ($message) => $message->to($s['user'])->subject('Test e-mail CRM')
            );
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => BrandMailer::translateError($e->getMessage())];
        }

        return ['success' => true, 'message' => 'Connexion OK — un e-mail de test a été envoyé à '.$s['user'].'.'];
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

            $errMsg = (string) ($res->json('error.message') ?? $res->body());
            $code = $res->json('error.code');

            return ['success' => false, 'message' => \App\Services\Meta\MetaErrorTranslator::toFrench($errMsg, is_int($code) ? $code : null)];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => 'Erreur de connexion : '.$e->getMessage()];
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

        $ameexApiId = $this->val($brandId, 'carrier_ameex_api_id');
        $ameexApiKey = $this->val($brandId, 'carrier_ameex_api_key');
        if ($ameexApiId !== '' && $ameexApiKey !== '') {
            $company = new DeliveryCompany([
                'code' => 'ameex',
                'api_url' => $this->val($brandId, 'carrier_ameex_api_url') ?: 'https://api.ameex.app',
                'api_key_ref' => $ameexApiId,
                'api_key' => $ameexApiKey,
            ]);
            $result = (new AmeexDeliveryProvider($company))->testConnection([
                'api_id' => $ameexApiId,
                'api_key' => $ameexApiKey,
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
