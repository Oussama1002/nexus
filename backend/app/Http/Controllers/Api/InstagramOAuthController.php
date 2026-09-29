<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\SystemSetting;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Connexion Instagram directe (Instagram API with Instagram Login).
 *
 * L'accès par la Page Facebook est fermé pour les apps récentes :
 * instagram_basic n'existe plus et instagram_business_* n'est pas accordée
 * par Facebook Login. Instagram délivre donc son propre jeton, stocké à part
 * et utilisé sur graph.instagram.com.
 */
class InstagramOAuthController extends Controller
{
    private const SCOPES = [
        'instagram_business_basic',
    ];

    public function redirectUrl(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false)
            ?? (int) Brand::query()->orderBy('id')->value('id');

        $appId = $this->getSetting($brandId, 'instagram_app_id');
        if (! $appId) {
            return ApiResponse::error(
                'Instagram App ID non configuré. Renseignez-le dans Paramètres → Meta (section Instagram).',
                null,
                422
            );
        }

        $params = http_build_query([
            'client_id' => $appId,
            'redirect_uri' => $this->callbackUrl(),
            'scope' => implode(',', self::SCOPES),
            'response_type' => 'code',
            'state' => $this->buildState($brandId),
        ]);

        return ApiResponse::success(
            ['url' => 'https://www.instagram.com/oauth/authorize?'.$params],
            'URL de connexion Instagram générée.'
        );
    }

    public function callback(Request $request): RedirectResponse
    {
        if ($request->query('error')) {
            Log::warning('instagram.oauth.denied', [
                'error' => $request->query('error'),
                'reason' => $request->query('error_reason'),
            ]);

            return redirect($this->frontendUrl('/parametres?section=meta&instagram=denied'));
        }

        $code = (string) $request->query('code');
        $brandId = $this->parseState($request->query('state'));

        if ($code === '' || ! $brandId) {
            return redirect($this->frontendUrl('/parametres?section=meta&instagram=invalid'));
        }

        $appId = $this->getSetting($brandId, 'instagram_app_id');
        $appSecret = $this->getSetting($brandId, 'instagram_app_secret');
        if (! $appId || ! $appSecret) {
            return redirect($this->frontendUrl('/parametres?section=meta&instagram=missing_config'));
        }

        // Instagram renvoie le code suffixé de « #_ » dans certains navigateurs.
        $code = rtrim($code, '#_');

        $short = Http::asForm()->post('https://api.instagram.com/oauth/access_token', [
            'client_id' => $appId,
            'client_secret' => $appSecret,
            'grant_type' => 'authorization_code',
            'redirect_uri' => $this->callbackUrl(),
            'code' => $code,
        ]);

        if (! $short->successful()) {
            Log::warning('instagram.oauth.token_exchange_failed', ['body' => $short->body()]);

            return redirect($this->frontendUrl('/parametres?section=meta&instagram=exchange_failed'));
        }

        $shortToken = (string) $short->json('access_token');
        $userId = (string) ($short->json('user_id') ?? '');

        // Instagram renvoie les permissions réellement accordées : sans elles,
        // tous les nœuds répondent « Unsupported request ».
        $permissions = $short->json('permissions');
        $permissions = is_array($permissions) ? implode(',', $permissions) : (string) $permissions;
        Log::info('instagram.oauth.granted', ['user_id' => $userId, 'permissions' => $permissions]);
        $this->storeSetting($brandId, 'instagram_permissions', $permissions, false);

        if ($shortToken === '') {
            return redirect($this->frontendUrl('/parametres?section=meta&instagram=exchange_failed'));
        }

        // Jeton longue durée (60 jours) : sans ça la connexion expire en 1 h.
        $long = Http::get('https://graph.instagram.com/access_token', [
            'grant_type' => 'ig_exchange_token',
            'client_secret' => $appSecret,
            'access_token' => $shortToken,
        ]);

        $token = $long->successful() ? (string) $long->json('access_token') : $shortToken;

        $this->storeSetting($brandId, 'instagram_access_token', $token, true);
        if ($userId !== '') {
            $this->storeSetting($brandId, 'instagram_user_id', $userId, false);
        }

        // Le pseudo sert d'accusé de connexion dans les paramètres.
        $me = Http::get('https://graph.instagram.com/me', [
            'fields' => 'user_id,username',
            'access_token' => $token,
        ]);
        if ($me->successful() && $me->json('username')) {
            $this->storeSetting($brandId, 'instagram_username', (string) $me->json('username'), false);
        }

        return redirect($this->frontendUrl('/parametres?section=meta&instagram=success'));
    }

    private function buildState(int $brandId): string
    {
        $payload = $brandId.'.'.time();

        return base64_encode($payload.'|'.hash_hmac('sha256', $payload, config('app.key')));
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
        if (! hash_equals(hash_hmac('sha256', $payload, config('app.key')), $sig)) {
            return null;
        }

        $parts = explode('.', $payload);
        $brandId = (int) ($parts[0] ?? 0);
        $timestamp = (int) ($parts[1] ?? 0);

        return ($brandId > 0 && abs(time() - $timestamp) <= 600) ? $brandId : null;
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

    private function storeSetting(int $brandId, string $key, string $value, bool $sensitive): void
    {
        SystemSetting::query()->updateOrCreate(
            ['brand_id' => $brandId, 'setting_key' => $key],
            ['setting_group' => 'meta', 'setting_value' => $value, 'is_sensitive' => $sensitive]
        );
    }

    private function callbackUrl(): string
    {
        $configured = trim((string) env('INSTAGRAM_REDIRECT_URI', ''));
        if ($configured !== '') {
            return $configured;
        }

        return rtrim(config('app.url'), '/').'/api/instagram/oauth/callback';
    }

    private function frontendUrl(string $path): string
    {
        $base = trim((string) env('FRONTEND_URL', '')) ?: (string) config('app.url');
        $appUrl = (string) config('app.url');

        if (str_contains($base, 'localhost') && ! str_contains($appUrl, 'localhost')) {
            $base = $appUrl;
        }

        return rtrim($base, '/').'/'.ltrim($path, '/');
    }
}
