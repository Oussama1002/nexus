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

class MetaOAuthController extends Controller
{
    private const GRAPH_VERSION = 'v21.0';

    // read_insights (stats Pages/Instagram) is refused by Facebook Login for
    // Business without review; ad statistics already come with ads_read.
    private const SCOPES = [
        'ads_management',
        'ads_read',
        'business_management',
        // Lecture des Pages (détection Page, publication des publicités).
        // instagram_basic n'existe que si l'app a le cas d'utilisation
        // Instagram : Meta refuse la connexion sinon.
        'pages_show_list',
        'pages_read_engagement',
        // Publier sur la Page et modérer ses commentaires depuis le CRM
        // (cas d'utilisation « Manage everything on your Page »).
        'pages_manage_posts',
        'pages_manage_engagement',
    ];

    /**
     * Autorisations Instagram : les noms changent selon le cas d'utilisation
     * activé dans l'app Meta (instagram_basic pour l'API Graph historique,
     * instagram_business_* pour la nouvelle). Un nom inconnu fait échouer
     * toute la connexion (« Invalid Scopes »), d'où une liste saisie dans
     * Paramètres → Meta plutôt qu'une liste figée ici.
     */

    public function redirectUrl(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false)
            ?? (int) Brand::query()->orderBy('id')->value('id');

        $appId = $this->getSetting($brandId, 'meta_app_id');
        if (! $appId) {
            return ApiResponse::error('Meta App ID non configuré. Renseignez-le dans Paramètres → Meta.', null, 422);
        }

        $state = $this->buildState($brandId);

        $scopes = array_merge(self::SCOPES, $this->instagramScopes($brandId));

        $params = http_build_query([
            'client_id' => $appId,
            'redirect_uri' => $this->callbackUrl(),
            'scope' => implode(',', $scopes),
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

    /**
     * Autorisations Instagram saisies par la marque, nettoyées.
     *
     * @return list<string>
     */
    private function instagramScopes(int $brandId): array
    {
        $raw = (string) ($this->getSetting($brandId, 'meta_instagram_scopes') ?? '');
        if (trim($raw) === '') {
            return [];
        }

        $scopes = [];
        foreach (preg_split('/[\s,]+/', $raw) ?: [] as $scope) {
            $scope = strtolower(trim($scope));
            if ($scope !== '' && preg_match('/^[a-z0-9_]+$/', $scope)) {
                $scopes[] = $scope;
            }
        }

        return array_values(array_unique($scopes));
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

    /**
     * Laravel n'est servi que sous /api sur le serveur client : l'URL sans ce
     * préfixe tombe sur le SPA et le callback n'est jamais exécuté.
     * META_REDIRECT_URI permet de forcer une autre valeur si besoin.
     */
    private function callbackUrl(): string
    {
        $configured = trim((string) env('META_REDIRECT_URI', ''));
        if ($configured !== '') {
            return $configured;
        }

        return rtrim(config('app.url'), '/') . '/api/meta/oauth/callback';
    }

    private function frontendUrl(string $path): string
    {
        $base = trim((string) env('FRONTEND_URL', '')) ?: (string) config('app.url');
        $appUrl = (string) config('app.url');

        // Garde-fou : un FRONTEND_URL resté en localhost (valeur de dev) renverrait
        // l'utilisateur sur sa machine après la connexion Facebook.
        if (str_contains($base, 'localhost') && ! str_contains($appUrl, 'localhost')) {
            $base = $appUrl;
        }

        return rtrim($base, '/') . '/' . ltrim($path, '/');
    }
}
