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
    ];

    /**
     * Autorisations supplémentaires saisies par la marque : Instagram
     * (instagram_basic…) et écriture sur les Pages (pages_manage_posts,
     * pages_manage_engagement). Leur disponibilité dépend des cas
     * d'utilisation activés dans l'app, et un nom inconnu fait échouer toute
     * la connexion (« Invalid Scopes ») — d'où une liste modifiable plutôt
     * qu'une liste figée ici.
     */

    public function redirectUrl(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false)
            ?? (int) Brand::query()->orderBy('id')->value('id');

        $appId = $this->getSetting($brandId, 'meta_app_id');
        if (! $appId) {
            return ApiResponse::error('Meta App ID non configuré. Renseignez-le dans Paramètres → Meta.', null, 422);
        }

        $state = $this->buildState($brandId, $this->sanitizeReturnPath($request->query('return')));

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
        // Lu en premier : meme un refus doit ramener sur la page d'origine.
        [$brandId, $returnPath] = $this->parseState($request->query('state'));

        $error = $request->query('error');
        if ($error) {
            Log::warning('meta.oauth.denied', ['error' => $error, 'reason' => $request->query('error_reason')]);

            return redirect($this->frontendUrl($this->oauthReturnUrl($returnPath, 'denied')));
        }

        $code = $request->query('code');
        if (! $code || ! $brandId) {
            return redirect($this->frontendUrl($this->oauthReturnUrl($returnPath, 'invalid')));
        }

        $appId = $this->getSetting($brandId, 'meta_app_id');
        $appSecret = $this->getSetting($brandId, 'meta_app_secret');

        if (! $appId || ! $appSecret) {
            return redirect($this->frontendUrl($this->oauthReturnUrl($returnPath, 'missing_config')));
        }

        $shortLived = $this->exchangeCodeForToken($code, $appId, $appSecret);
        if (! $shortLived) {
            return redirect($this->frontendUrl($this->oauthReturnUrl($returnPath, 'exchange_failed')));
        }

        $longLived = $this->exchangeForLongLivedToken($shortLived, $appId, $appSecret);
        $token = $longLived ?: $shortLived;

        $this->storeSetting($brandId, 'meta_access_token', $token);

        $businessId = $this->fetchBusinessId($token);
        if ($businessId) {
            $this->storeSetting($brandId, 'meta_business_id', $businessId);
        }

        return redirect($this->frontendUrl($this->oauthReturnUrl($returnPath, 'success')));
    }

    private function buildState(int $brandId, string $returnPath = ''): string
    {
        // La page d'origine voyage avec l'etat : sans elle le retour tombe
        // toujours sur le centre de parametres.
        $payload = $brandId . '.' . time() . '.' . rawurlencode($returnPath);
        $sig = hash_hmac('sha256', $payload, config('app.key'));

        return base64_encode($payload . '|' . $sig);
    }

    /**
     * Chemin interne uniquement : jamais une URL absolue, qui permettrait de
     * renvoyer l'utilisateur ailleurs apres la connexion.
     */
    private function sanitizeReturnPath(?string $path): string
    {
        $path = trim((string) $path);

        if ($path === '' || ! str_starts_with($path, '/') || str_starts_with($path, '//')) {
            return '';
        }

        return mb_substr($path, 0, 200);
    }

    /** @return array{0: int|null, 1: string} */
    private function parseState(?string $state): array
    {
        if (! $state) {
            return [null, ''];
        }

        $decoded = base64_decode($state, true);
        if (! $decoded || ! str_contains($decoded, '|')) {
            return [null, ''];
        }

        [$payload, $sig] = explode('|', $decoded, 2);
        $expected = hash_hmac('sha256', $payload, config('app.key'));

        if (! hash_equals($expected, $sig)) {
            Log::warning('meta.oauth.invalid_state_signature');

            return [null, ''];
        }

        $parts = explode('.', $payload);
        $brandId = (int) ($parts[0] ?? 0);
        $timestamp = (int) ($parts[1] ?? 0);
        $return = $this->sanitizeReturnPath(rawurldecode((string) ($parts[2] ?? '')));

        if ($brandId <= 0 || abs(time() - $timestamp) > 600) {
            return [null, $return];
        }

        return [$brandId, $return];
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

    /** Page d'origine si elle est connue, centre de parametres sinon. */
    private function oauthReturnUrl(string $returnPath, string $outcome): string
    {
        $base = $returnPath !== '' ? $returnPath : '/parametres';
        $separator = str_contains($base, '?') ? '&' : '?';

        return $base . $separator . 'section=meta&oauth=' . $outcome;
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
