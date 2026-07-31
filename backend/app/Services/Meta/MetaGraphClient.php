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
    public function get(int $brandId, string $path, array $query = []): array
    {
        $cfg = $this->config->forBrand($brandId);
        if ($cfg['access_token'] === '') {
            throw new MetaApiException('Meta access token manquant. Configurez-le dans Paramètres → Meta.');
        }

        $url = rtrim($cfg['base_url'], '/').'/'.ltrim($path, '/');
        $query['access_token'] = $cfg['access_token'];

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
     * @param  array<string, mixed>  $query
     * @return list<array<string, mixed>>
     */
    public function paginate(int $brandId, string $path, array $query = [], int $maxPages = 20): array
    {
        $items = [];
        $page = 0;
        $nextPath = $path;
        $nextQuery = $query;

        while ($page < $maxPages) {
            $payload = $this->get($brandId, $nextPath, $nextQuery);
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
