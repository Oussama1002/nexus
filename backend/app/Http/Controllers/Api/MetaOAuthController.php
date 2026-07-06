<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MetaOAuthController extends Controller
{
    private const GRAPH_VERSION = 'v21.0';

    private const SCOPES = [
        'ads_management',
        'ads_read',
        'business_management',
        'read_insights',
    ];

    public function redirectUrl(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $appId = $this->getSetting($brandId, 'meta_app_id');
        if (! $appId) {
            return ApiResponse::error('Meta App ID non configuré. Renseignez-le dans Paramètres → Meta.', null, 422);
        }

        $state = $this->buildState($brandId);

        $params = http_build_query([
            'client_id' => $appId,
            'redirect_uri' => $this->callbackUrl(),
            'scope' => implode(',', self::SCOPES),
            'response_type' => 'code',
            'state' => $state,
        ]);

        $url = 'https://www.facebook.com/' . self::GRAPH_VERSION . '/dialog/oauth?' . $params;

        return ApiResponse::success(['url' => $url], 'URL de connexion Meta générée.');
    }

    public function callback(Request $request): RedirectResponse
    {
        $error = $request->query('error');
        if ($error) {
            Log::warning('meta.oauth.denied', ['error' => $error, 'reason' => $request->query('error_reason')]);

            return redirect($this->frontendUrl('/parametres?section=meta&oauth=denied'));
        }

        $code = $request->query('code');
        $state = $request->query('state');

        $brandId = $this->parseState($state);
        if (! $code || ! $brandId) {
            return redirect($this->frontendUrl('/parametres?section=meta&oauth=invalid'));
        }

        $appId = $this->getSetting($brandId, 'meta_app_id');
        $appSecret = $this->getSetting($brandId, 'meta_app_secret');

        if (! $appId || ! $appSecret) {
            return redirect($this->frontendUrl('/parametres?section=meta&oauth=missing_config'));
        }

        $shortLived = $this->exchangeCodeForToken($code, $appId, $appSecret);
        if (! $shortLived) {
            return redirect($this->frontendUrl('/parametres?section=meta&oauth=exchange_failed'));
        }

        $longLived = $this->exchangeForLongLivedToken($shortLived, $appId, $appSecret);
        $token = $longLived ?: $shortLived;

        $this->storeSetting($brandId, 'meta_access_token', $token);

        $businessId = $this->fetchBusinessId($token);
        if ($businessId) {
            $this->storeSetting($brandId, 'meta_business_id', $businessId);
        }

        return redirect($this->frontendUrl('/parametres?section=meta&oauth=success'));
    }

    private function buildState(int $brandId): string
    {
        $payload = $brandId . '.' . time();
        $sig = hash_hmac('sha256', $payload, config('app.key'));

        return base64_encode($payload . '|' . $sig);
    }

    private function parseState(?string $state): ?int
    {
        if (! $state) {
            return null;
        }

        $decoded = base64_decode($state, true);
        if (! $decoded || ! str_contains($decoded, '|')) {
            return null;
        }

        [$payload, $sig] = explode('|', $decoded, 2);
        $expected = hash_hmac('sha256', $payload, config('app.key'));

        if (! hash_equals($expected, $sig)) {
            Log::warning('meta.oauth.invalid_state_signature');

            return null;
        }

        $parts = explode('.', $payload);
        $brandId = (int) ($parts[0] ?? 0);
        $timestamp = (int) ($parts[1] ?? 0);

        if ($brandId <= 0 || abs(time() - $timestamp) > 600) {
            return null;
        }

        return $brandId;
    }

    private function exchangeCodeForToken(string $code, string $appId, string $appSecret): ?string
    {
        $response = Http::get('https://graph.facebook.com/' . self::GRAPH_VERSION . '/oauth/access_token', [
            'client_id' => $appId,
            'client_secret' => $appSecret,
            'redirect_uri' => $this->callbackUrl(),
            'code' => $code,
        ]);

        if (! $response->successful()) {
            Log::warning('meta.oauth.token_exchange_failed', ['body' => $response->body()]);

            return null;
        }

        return $response->json('access_token');
    }

    private function exchangeForLongLivedToken(string $shortToken, string $appId, string $appSecret): ?string
    {
        $response = Http::get('https://graph.facebook.com/' . self::GRAPH_VERSION . '/oauth/access_token', [
            'grant_type' => 'fb_exchange_token',
            'client_id' => $appId,
            'client_secret' => $appSecret,
            'fb_exchange_token' => $shortToken,
        ]);

        if (! $response->successful()) {
            Log::warning('meta.oauth.long_lived_exchange_failed', ['body' => $response->body()]);

            return null;
        }

        return $response->json('access_token');
    }

    private function fetchBusinessId(string $token): ?string
    {
        $response = Http::get('https://graph.facebook.com/' . self::GRAPH_VERSION . '/me/businesses', [
            'access_token' => $token,
            'fields' => 'id,name',
            'limit' => 1,
        ]);

        if (! $response->successful()) {
            return null;
        }

        $data = $response->json('data', []);

        return ! empty($data[0]['id']) ? (string) $data[0]['id'] : null;
    }

    private function getSetting(int $brandId, string $key): ?string
    {
        $val = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', $key)
            ->value('setting_value');

        $val = is_string($val) ? trim($val) : '';

        return $val !== '' ? $val : null;
    }

    private function storeSetting(int $brandId, string $key, string $value): void
    {
        SystemSetting::query()->updateOrCreate(
            ['brand_id' => $brandId, 'setting_key' => $key],
            [
                'setting_group' => 'meta',
                'setting_value' => $value,
                'is_sensitive' => true,
            ]
        );
    }

    private function callbackUrl(): string
    {
        return rtrim(config('app.url'), '/') . '/meta/oauth/callback';
    }

    private function frontendUrl(string $path): string
    {
        $base = env('FRONTEND_URL', config('app.url'));

        return rtrim($base, '/') . '/' . ltrim($path, '/');
    }
}
