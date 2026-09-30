<?php

namespace App\Services\Meta;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MetaGraphClient
{
    public function __construct(
        private readonly MetaAdsConfig $config,
    ) {}

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function get(int $brandId, string $path, array $query = [], ?string $accessToken = null): array
    {
        $cfg = $this->config->forBrand($brandId);
        $token = $accessToken !== null && $accessToken !== '' ? $accessToken : $cfg['access_token'];
        if ($token === '') {
            throw new MetaApiException('Meta access token manquant. Configurez-le dans Paramètres → Meta.');
        }

        $url = rtrim($cfg['base_url'], '/').'/'.ltrim($path, '/');
        $query['access_token'] = $token;

        $response = Http::timeout(30)->acceptJson()->get($url, $query);

        if (! $response->successful()) {
            $body = $response->json();
            $err = is_array($body) ? ($body['error'] ?? []) : [];
            $message = is_array($err) ? (string) ($err['message'] ?? $response->body()) : $response->body();
            $code = is_array($err) ? ($err['code'] ?? null) : null;
            $type = is_array($err) ? ($err['type'] ?? null) : null;

            Log::warning('meta.graph.error', [
                'brand_id' => $brandId,
                'path' => $path,
                'status' => $response->status(),
                'message' => $message,
            ]);

            $graphCode = is_int($code) ? $code : null;
            $french = MetaErrorTranslator::toFrench($message ?: 'Erreur Meta Graph API.', $graphCode);

            throw new MetaApiException($french, $graphCode, is_string($type) ? $type : null);
        }

        $data = $response->json();
        if (! is_array($data)) {
            throw new MetaApiException('Réponse Meta invalide.');
        }

        return $data;
    }

    /**
     * Écriture (Marketing API) : création de campagne, ad set, creative…
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function post(int $brandId, string $path, array $payload = []): array
    {
        $cfg = $this->config->forBrand($brandId);
        if ($cfg['access_token'] === '') {
            throw new MetaApiException('Meta access token manquant. Configurez-le dans Paramètres → Meta.');
        }

        $url = rtrim($cfg['base_url'], '/').'/'.ltrim($path, '/');
        $payload['access_token'] = $cfg['access_token'];

        $response = Http::timeout(30)->asForm()->acceptJson()->post($url, $payload);

        if (! $response->successful()) {
            $body = $response->json();
            $err = is_array($body) ? ($body['error'] ?? []) : [];
            $message = is_array($err) ? (string) ($err['error_user_msg'] ?? $err['message'] ?? $response->body()) : $response->body();
            $code = is_array($err) ? ($err['code'] ?? null) : null;

            // Meta distingue une dizaine de refus derriere le meme message :
            // seuls le sous-code et le titre utilisateur les separent.
            Log::warning('meta.graph.post_error', [
                'brand_id' => $brandId,
                'path' => $path,
                'status' => $response->status(),
                'message' => $message,
                'code' => $code,
                'error_subcode' => is_array($err) ? ($err['error_subcode'] ?? null) : null,
                'error_user_title' => is_array($err) ? ($err['error_user_title'] ?? null) : null,
                'error_user_msg' => is_array($err) ? ($err['error_user_msg'] ?? null) : null,
                'blame_field_specs' => is_array($err) ? ($err['error_data']['blame_field_specs'] ?? null) : null,
                'payload_keys' => array_keys($payload),
            ]);

            throw new MetaApiException(
                MetaErrorTranslator::toFrench($message ?: 'Erreur Meta Graph API.', is_int($code) ? $code : null),
                is_int($code) ? $code : null
            );
        }

        $data = $response->json();

        return is_array($data) ? $data : [];
    }

    /**
     * @param  array<string, mixed>  $query
     * @return list<array<string, mixed>>
     */
    public function paginate(int $brandId, string $path, array $query = [], int $maxPages = 20, ?string $accessToken = null): array
    {
        $items = [];
        $page = 0;
        $nextPath = $path;
        $nextQuery = $query;

        while ($page < $maxPages) {
            $payload = $this->get($brandId, $nextPath, $nextQuery, $accessToken);
            foreach ($payload['data'] ?? [] as $row) {
                if (is_array($row)) {
                    $items[] = $row;
                }
            }

            $next = $payload['paging']['next'] ?? null;
            if (! is_string($next) || $next === '') {
                break;
            }

            $parsed = parse_url($next);
            $nextPath = ltrim((string) ($parsed['path'] ?? ''), '/');
            $nextPath = preg_replace('#^v\d+\.\d+/#', '', $nextPath) ?? $nextPath;
            parse_str((string) ($parsed['query'] ?? ''), $qs);
            unset($qs['access_token']);
            $nextQuery = $qs;
            $page++;
        }

        return $items;
    }
}
