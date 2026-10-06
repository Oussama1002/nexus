<?php

namespace App\Services\Delivery\Providers;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Ameex.app customer delivery API.
 * Auth: C-Api-Id + C-Api-Key headers.
 * api_key_ref = C-Api-Id, api_key = C-Api-Key.
 */
class AmeexDeliveryProvider extends AbstractHttpDeliveryProvider
{
    protected function providerCode(): string
    {
        return 'ameex';
    }

    protected function defaultApiUrl(): string
    {
        return (string) config('delivery.ameex.api_url', 'https://api.ameex.app');
    }

    /** @return array{api_id: string, api_key: string}|null */
    protected function credentialsReady(): ?array
    {
        if (! $this->company) {
            return null;
        }

        $apiId = trim((string) ($this->company->api_key_ref ?? ''));
        $apiKey = trim((string) ($this->company->api_key ?? ''));

        if ($apiId === '' || $apiKey === '') {
            return null;
        }

        return ['api_id' => $apiId, 'api_key' => $apiKey];
    }

    public function createShipment(array $payload): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        // Ameex lit le contre-remboursement dans « cod » mais le nomme « CRBT »
        // dans ses erreurs, et considère « 0 » comme vide : un colis déjà payé
        // est refusé par l'API, autant le dire clairement ici.
        $cod = (float) ($payload['cod_amount'] ?? 0);
        if ($cod <= 0) {
            return $this->failure(
                'ameex_cod_required',
                'Ameex exige un montant à encaisser (CRBT) supérieur à 0 : une commande déjà payée ne peut pas être envoyée via l\'API.'
            );
        }

        // Ameex attend l'identifiant de ville de son référentiel, pas son nom.
        $cityName = (string) ($payload['recipient_city'] ?? '');
        $cityId = $this->resolveCityId($cityName, $credentials);
        if ($cityId === null) {
            return $this->failure(
                'ameex_city_unknown',
                $cityName === ''
                    ? 'Ville de livraison manquante : Ameex exige une ville de son référentiel.'
                    : sprintf('Ville « %s » inconnue chez Ameex. Corrigez la ville du client avec une ville desservie par Ameex.', $cityName)
            );
        }

        $body = [
            'type' => 'SIMPLE',
            'business' => $credentials['api_id'],
            'order_num' => (string) ($payload['reference'] ?? ''),
            'receiver' => (string) ($payload['recipient_name'] ?? ''),
            'phone' => (string) ($payload['recipient_phone'] ?? ''),
            'city' => $cityId,
            'address' => (string) ($payload['recipient_address'] ?? ''),
            'cod' => (string) $cod,
            'crbt' => (string) $cod,
            'product' => (string) ($payload['products'] ?? ''),
            'comment' => (string) ($payload['comment'] ?? $payload['notes'] ?? ''),
            'open' => ! empty($payload['allow_open']) ? 'YES' : 'NO',
            'try' => ! empty($payload['allow_try']) ? 'YES' : 'NO',
            'fragile' => '0',
            'replace' => 'false',
        ];

        $response = $this->ameexPost('customer/Delivery/Parcels/Action/Type/Add', $body, $credentials);
        $data = $this->decodeJson($response);

        if (! $response->successful() || ! is_array($data)) {
            return $this->failure('ameex_create_failed', $this->responseMessage($response, 'Ameex create parcel failed.'), [
                'http_status' => $response->status(),
                'raw' => $data,
            ]);
        }

        if ($this->isApiError($data)) {
            return $this->failure('ameex_create_failed', $this->extractMessage($data, 'Ameex create parcel failed.'), ['raw' => $data]);
        }

        $tracking = $this->extractTracking($data);

        // La réponse d'ajout ne contient pas toujours le code du colis : on le
        // relit dans la liste des colis via le numéro de commande envoyé.
        if ($tracking === null || $tracking === '') {
            $tracking = $this->findParcelCode((string) ($body['order_num'] ?? ''), $credentials);
        }

        // Toujours rien : Ameex n'a pas confirmé l'enregistrement.
        if ($tracking === null || $tracking === '') {
            return $this->failure(
                'ameex_no_tracking',
                $this->extractMessage($data, "Ameex n'a renvoyé aucun numéro de suivi."),
                ['raw' => $data]
            );
        }

        return $this->success('ameex_created', 'Colis enregistré chez Ameex.', [
            'tracking_number' => $tracking,
            'external_tracking_id' => $tracking,
            'carrier_status' => (string) ($data['status'] ?? 'created'),
            'raw' => $data,
        ]);
    }

    public function trackShipment(string $trackingNumber): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        $response = $this->ameexGet(
            'customer/Delivery/DeliveryNotes/Print/Type/Note',
            ['Ref' => $trackingNumber],
            $credentials
        );
        $data = $this->decodeJson($response);

        if (! $response->successful() || ! is_array($data)) {
            return $this->failure('ameex_track_failed', $this->responseMessage($response, 'Ameex tracking failed.'), [
                'tracking_number' => $trackingNumber,
                'http_status' => $response->status(),
            ]);
        }

        $status = (string) ($data['status'] ?? $data['parcel_status'] ?? '');

        return $this->success('ameex_track', 'Ameex tracking snapshot.', [
            'tracking_number' => $trackingNumber,
            'carrier_status' => $status,
            'internal_status' => $status,
            'raw' => $data,
        ]);
    }

    public function cancelShipment(string $trackingNumber): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        $response = Http::timeout(30)
            ->acceptJson()
            ->withHeaders($this->apiHeaders($credentials))
            ->delete($this->apiUrl() . '/customer/Delivery/DeliveryNotes/Action/Type/Add', [
                'Ref' => $trackingNumber,
            ]);

        $data = $this->decodeJson($response);

        // Ameex répond 200 même pour un refus : même détection que l'ajout.
        if (! $response->successful() || $this->isApiError($data)) {
            return $this->failure('ameex_cancel_failed', $this->extractMessage($data, $this->responseMessage($response, 'Ameex cancel failed.')), [
                'tracking_number' => $trackingNumber,
                'raw' => $data,
            ]);
        }

        return $this->success('ameex_cancelled', 'Colis annulé chez Ameex.', [
            'tracking_number' => $trackingNumber,
            'raw' => $data,
        ]);
    }

    public function printLabel(string $trackingNumber): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        $url = $this->apiUrl() . '/customer/Delivery/DeliveryNotes/Print/Type/Note?Ref=' . urlencode($trackingNumber);

        return $this->success('label_available', 'Ameex label URL retrieved.', [
            'label_url' => $url,
            'tracking_number' => $trackingNumber,
            'headers' => $this->apiHeaders($credentials),
        ]);
    }

    /** @param  array{api_id: string, api_key: string}  $credentials */
    public function listDeliveries(int $page = 1, int $perPage = 100): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        $start = ($page - 1) * $perPage;

        $body = [
            'start' => (string) $start,
            'length' => (string) $perPage,
            'search[value]' => '',
            'search[regex]' => 'false',
            'business' => $credentials['api_id'],
            'all_data' => '1',
            'date[from]' => '01/01/2020',
            'date[to]' => now()->format('m/d/Y'),
        ];

        $response = $this->ameexPost('customer/Delivery/Parcels/Json', $body, $credentials);
        $data = $this->decodeJson($response);

        if (! $response->successful() || ! is_array($data)) {
            return $this->failure('ameex_list_failed', $this->responseMessage($response, 'Ameex list parcels failed.'), [
                'page' => $page,
                'http_status' => $response->status(),
                'raw' => $data,
            ]);
        }

        $items = $data['aaData'] ?? [];
        if (! is_array($items)) {
            $items = [];
        }

        $totalRecords = (int) ($data['iTotalDisplayRecords'] ?? 0);

        return $this->success('ameex_list', 'Ameex parcels retrieved.', [
            'page' => $page,
            'items' => $items,
            'count' => count($items),
            'total_records' => $totalRecords,
            'has_more' => ($start + count($items)) < $totalRecords,
        ]);
    }

    public function testConnection(array $credentials): array
    {
        if ($credentials['api_id'] === '' || $credentials['api_key'] === '') {
            return $this->failure('ameex_incomplete', 'Ameex API ID et API Key requis.');
        }

        $response = $this->ameexPost('customer/Delivery/Parcels/Action/Type/Add', [
            'type' => 'SIMPLE',
            'business' => $credentials['api_id'],
        ], $credentials);

        if ($response->status() === 401 || $response->status() === 403) {
            return $this->failure('ameex_auth_failed', 'Ameex API credentials invalides.');
        }

        return $this->success('ameex_connected', 'Connexion Ameex API réussie.');
    }

    /**
     * Code du colis Ameex à partir du numéro de commande, quand l'ajout
     * répond « succès » sans renvoyer le code.
     *
     * @param  array{api_id: string, api_key: string}  $credentials
     */
    protected function findParcelCode(string $orderNumber, array $credentials): ?string
    {
        if ($orderNumber === '') {
            return null;
        }

        try {
            $response = $this->ameexPost('customer/Delivery/Parcels/Json', [
                'start' => '0',
                'length' => '25',
                'search[value]' => $orderNumber,
                'search[regex]' => 'false',
                'business' => $credentials['api_id'],
                'all_data' => '1',
                'date[from]' => '01/01/2020',
                'date[to]' => now()->format('m/d/Y'),
            ], $credentials);
        } catch (\Throwable) {
            return null;
        }

        $data = $this->decodeJson($response);
        $items = $data['aaData'] ?? null;
        if (! is_array($items)) {
            return null;
        }

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $haystack = strip_tags(implode(' ', array_map(fn ($v) => is_scalar($v) ? (string) $v : '', $item)));
            if (str_contains($haystack, $orderNumber) && ! empty($item['TBL_CODE'])) {
                return (string) $item['TBL_CODE'];
            }
        }

        return null;
    }

    /**
     * Référentiel des villes Ameex : ['id' => '1', 'name' => 'Marrakech', …].
     *
     * @param  array{api_id: string, api_key: string}|null  $credentials
     * @return array<int, array{id: string, name: string}>
     */
    public function fetchCities(?array $credentials = null): array
    {
        $credentials ??= $this->credentialsReady();
        if ($credentials === null) {
            return [];
        }

        $cacheKey = 'ameex.cities.'.md5($credentials['api_id'].$this->apiUrl());

        return Cache::remember($cacheKey, now()->addHours(12), function () use ($credentials) {
            try {
                $response = $this->ameexGet('customer/Delivery/Cities', [], $credentials);
            } catch (\Throwable) {
                return [];
            }

            $data = $this->decodeJson($response);
            $cities = $data['api']['cities'] ?? null;
            if (! is_array($cities)) {
                return [];
            }

            $out = [];
            foreach ($cities as $key => $city) {
                if (! is_array($city)) {
                    continue;
                }
                $id = (string) ($city['id'] ?? $key);
                $name = trim((string) ($city['name'] ?? ''));
                if ($id !== '' && $name !== '') {
                    $out[] = ['id' => $id, 'name' => $name];
                }
            }

            return $out;
        });
    }

    /** @param  array{api_id: string, api_key: string}  $credentials */
    protected function resolveCityId(string $cityName, array $credentials): ?string
    {
        $needle = $this->normalizeCity($cityName);
        if ($needle === '') {
            return null;
        }

        $cities = $this->fetchCities($credentials);
        if ($cities === []) {
            return null;
        }

        foreach ($cities as $city) {
            if ($this->normalizeCity($city['name']) === $needle) {
                return $city['id'];
            }
        }

        // « Casablanca Ain Sebaa » saisi pour « Casablanca » : on accepte le
        // préfixe le plus long qui corresponde à une ville du référentiel.
        $best = null;
        foreach ($cities as $city) {
            $candidate = $this->normalizeCity($city['name']);
            if ($candidate !== '' && str_starts_with($needle, $candidate)) {
                if ($best === null || strlen($candidate) > strlen($this->normalizeCity($best['name']))) {
                    $best = $city;
                }
            }
        }

        return $best['id'] ?? null;
    }

    /** Minuscules sans accents ni ponctuation, pour comparer « Salé » et « Sale ». */
    private function normalizeCity(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = strtr($value, [
            'à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ã' => 'a',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'î' => 'i', 'ï' => 'i', 'í' => 'i',
            'ô' => 'o', 'ö' => 'o', 'ó' => 'o', 'õ' => 'o',
            'û' => 'u', 'ü' => 'u', 'ù' => 'u', 'ú' => 'u',
            'ç' => 'c', 'ñ' => 'n',
        ]);

        return (string) preg_replace('/[^a-z0-9]/', '', $value);
    }

    protected function ameexPost(string $path, array $body, array $credentials): Response
    {
        return Http::timeout(30)
            ->acceptJson()
            ->withHeaders($this->apiHeaders($credentials))
            ->asMultipart()
            ->post($this->apiUrl() . '/' . ltrim($path, '/'), $this->toMultipart($body));
    }

    protected function ameexGet(string $path, array $query, array $credentials): Response
    {
        return Http::timeout(30)
            ->acceptJson()
            ->withHeaders($this->apiHeaders($credentials))
            ->get($this->apiUrl() . '/' . ltrim($path, '/'), $query);
    }

    /** @return array<string, string> */
    protected function apiHeaders(array $credentials): array
    {
        return [
            'C-Api-Id' => $credentials['api_id'],
            'C-Api-Key' => $credentials['api_key'],
        ];
    }

    /** @return array<int, array{name: string, contents: string}> */
    private function toMultipart(array $body): array
    {
        $parts = [];
        foreach ($body as $key => $value) {
            $parts[] = ['name' => $key, 'contents' => (string) $value];
        }

        return $parts;
    }

    private function isApiError(?array $data): bool
    {
        if (! is_array($data)) {
            return false;
        }
        $check = $data['CHECK_API'] ?? null;
        if (is_array($check) && ($check['RESULT'] ?? '') === 'ERROR') {
            return true;
        }
        if (isset($data['error']) && $data['error'] === true) {
            return true;
        }
        // Forme réelle d'un refus : {"login":"success","api":{"type":"error","msg":"…"}}
        $api = $data['api'] ?? null;
        if (is_array($api) && mb_strtolower((string) ($api['type'] ?? '')) === 'error') {
            return true;
        }
        if (isset($data['login']) && mb_strtolower((string) $data['login']) !== 'success') {
            return true;
        }

        return false;
    }

    private function extractMessage(?array $data, string $fallback): string
    {
        if (! is_array($data)) {
            return $fallback;
        }
        $check = $data['CHECK_API'] ?? null;
        if (is_array($check) && ! empty($check['MESSAGE'])) {
            return (string) $check['MESSAGE'];
        }
        $api = $data['api'] ?? null;
        if (is_array($api) && ! empty($api['msg'])) {
            return 'Ameex : ' . $api['msg'];
        }
        if (! empty($data['message'])) {
            return (string) $data['message'];
        }

        // {"login":"error","data":{"pg_title":"Page de connexion…"}} : Ameex
        // renvoie sa page de login sans message. Sans ce cas, le refus
        // d'authentification ressortait en erreur generique.
        if (isset($data['login']) && mb_strtolower((string) $data['login']) !== 'success') {
            return 'Ameex a refusé l’authentification : vérifiez C-Api-Id et C-Api-Key '
                .'dans Paramètres › Intégrations › Livraison.';
        }

        return $fallback;
    }

    private function extractTracking(?array $data): ?string
    {
        if (! is_array($data)) {
            return null;
        }
        // Réponse réelle : {"api":{"data":{"id":…,"code":"CSA…"}}}
        $scopes = [$data];
        foreach (['data', 'api', 'parcel'] as $nested) {
            if (is_array($data[$nested] ?? null)) {
                $scopes[] = $data[$nested];
                if (is_array($data[$nested]['data'] ?? null)) {
                    $scopes[] = $data[$nested]['data'];
                }
            }
        }

        foreach ($scopes as $scope) {
            foreach (['code', 'parcel_code', 'tracking', 'tracking_number', 'ref', 'Ref', 'order_num'] as $key) {
                if (! empty($scope[$key])) {
                    return (string) $scope[$key];
                }
            }
        }

        return null;
    }
}
