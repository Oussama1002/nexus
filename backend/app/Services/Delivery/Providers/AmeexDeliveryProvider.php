<?php

namespace App\Services\Delivery\Providers;

use Illuminate\Http\Client\Response;
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

        $body = [
            'type' => 'SIMPLE',
            'business' => $credentials['api_id'],
            'order_num' => (string) ($payload['reference'] ?? ''),
            'receiver' => (string) ($payload['recipient_name'] ?? ''),
            'phone' => (string) ($payload['recipient_phone'] ?? ''),
            'city' => (string) ($payload['recipient_city'] ?? ''),
            'address' => (string) ($payload['recipient_address'] ?? ''),
            'cod' => (string) ((float) ($payload['cod_amount'] ?? 0)),
            // Ameex attend le contre-remboursement sous le nom « crbt ».
            'crbt' => (string) ((float) ($payload['cod_amount'] ?? 0)),
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

        // Pas de numéro de suivi = Ameex n'a rien enregistré, même sans message
        // d'erreur explicite. Ne jamais marquer l'expédition comme envoyée.
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

        if (! $response->successful()) {
            return $this->failure('ameex_cancel_failed', $this->responseMessage($response, 'Ameex cancel failed.'), [
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

        return $fallback;
    }

    private function extractTracking(?array $data): ?string
    {
        if (! is_array($data)) {
            return null;
        }
        $scopes = [$data];
        foreach (['data', 'api', 'parcel'] as $nested) {
            if (is_array($data[$nested] ?? null)) {
                $scopes[] = $data[$nested];
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
