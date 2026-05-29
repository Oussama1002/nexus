<?php

namespace App\Services\Delivery\Providers;

use Illuminate\Http\Client\Response;

/**
 * Sendit.ma API v1 — auth via public_key + secret_key, Bearer token for calls.
 *
 * @see https://app.sendit.ma/api/v1/
 */
class SenditDeliveryProvider extends AbstractHttpDeliveryProvider
{
    protected ?string $token = null;

    protected function providerCode(): string
    {
        return 'sendit';
    }

    protected function defaultApiUrl(): string
    {
        return (string) config('delivery.sendit.api_url', 'https://app.sendit.ma/api/v1');
    }

    /** @return array{public_key: string, secret_key: string}|null */
    protected function credentialsReady(): ?array
    {
        if (! $this->company) {
            return null;
        }

        $public = trim((string) ($this->company->api_key_ref ?? ''));
        $secret = trim((string) ($this->company->api_key ?? ''));

        if ($public === '' || $secret === '') {
            return null;
        }

        return ['public_key' => $public, 'secret_key' => $secret];
    }

    public function createShipment(array $payload): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        if (! $this->ensureToken($credentials)) {
            return $this->failure('sendit_auth_failed', 'Sendit authentication failed. Check public and secret keys.');
        }

        $districtId = $payload['district_id'] ?? null;
        if ($districtId === null && ! empty($payload['recipient_city'])) {
            $districtId = $this->resolveDistrictId((string) $payload['recipient_city']);
        }

        $pickupDistrictId = $payload['pickup_district_id'] ?? $districtId ?? 54;

        $body = [
            'pickup_district_id' => (int) $pickupDistrictId,
            'district_id' => (int) ($districtId ?? $pickupDistrictId),
            'name' => (string) ($payload['recipient_name'] ?? ''),
            'amount' => (float) ($payload['cod_amount'] ?? 0),
            'address' => (string) ($payload['recipient_address'] ?? ''),
            'phone' => (string) ($payload['recipient_phone'] ?? ''),
            'comment' => (string) ($payload['comment'] ?? $payload['notes'] ?? ''),
            'reference' => (string) ($payload['reference'] ?? $payload['tracking_number'] ?? ''),
            'allow_open' => ! empty($payload['allow_open']) ? '1' : '0',
            'allow_try' => ! empty($payload['allow_try']) ? '1' : '0',
            'products_from_stock' => '0',
            'products' => (string) ($payload['products'] ?? ''),
            'packaging_id' => (int) ($payload['packaging_id'] ?? 1),
            'option_exchange' => '0',
            'delivery_exchange_id' => '',
        ];

        $response = $this->authorizedPost('deliveries', $body);
        $data = $this->decodeJson($response);

        if (! $response->successful() || ! is_array($data)) {
            return $this->failure('sendit_create_failed', $this->responseMessage($response, 'Sendit create delivery failed.'), [
                'http_status' => $response->status(),
                'raw' => $data,
            ]);
        }

        if (! empty($data['error'])) {
            return $this->failure('sendit_create_failed', (string) $data['error'], ['raw' => $data]);
        }

        $code = is_array($data['data'] ?? null) ? ($data['data']['code'] ?? null) : null;

        return $this->success('sendit_created', 'Shipment registered at Sendit.', [
            'tracking_number' => $code,
            'external_tracking_id' => $code,
            'carrier_status' => is_array($data['data'] ?? null) ? ($data['data']['status'] ?? 'created') : 'created',
            'raw' => $data,
        ]);
    }

    public function trackShipment(string $trackingNumber): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        if (! $this->ensureToken($credentials)) {
            return $this->failure('sendit_auth_failed', 'Sendit authentication failed.');
        }

        $response = $this->authorizedGet('deliveries/'.urlencode($trackingNumber));
        $data = $this->decodeJson($response);

        if (! $response->successful() || ! is_array($data)) {
            $listResponse = $this->authorizedGet('deliveries', ['code' => $trackingNumber]);
            $data = $this->decodeJson($listResponse);
            if (! $listResponse->successful() || ! is_array($data)) {
                return $this->failure('sendit_track_failed', $this->responseMessage($response, 'Sendit tracking failed.'), [
                    'tracking_number' => $trackingNumber,
                    'http_status' => $response->status(),
                ]);
            }
        }

        $delivery = is_array($data['data'] ?? null) ? $data['data'] : $data;
        $status = (string) ($delivery['status'] ?? $delivery['state'] ?? '');

        return $this->success('sendit_track', 'Sendit tracking snapshot.', [
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

        if (! $this->ensureToken($credentials)) {
            return $this->failure('sendit_auth_failed', 'Sendit authentication failed.');
        }

        $response = $this->authorizedPost('deliveries/'.urlencode($trackingNumber).'/cancel');
        $data = $this->decodeJson($response);

        if (! $response->successful()) {
            return $this->failure('sendit_cancel_failed', $this->responseMessage($response, 'Sendit cancel failed.'), [
                'tracking_number' => $trackingNumber,
                'raw' => $data,
            ]);
        }

        return $this->success('sendit_cancelled', 'Shipment cancelled at Sendit.', [
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

        if (! $this->ensureToken($credentials)) {
            return $this->failure('sendit_auth_failed', 'Sendit authentication failed.');
        }

        $response = $this->authorizedGet('deliveries/'.urlencode($trackingNumber).'/label');
        $data = $this->decodeJson($response);

        $labelUrl = is_array($data) ? ($data['data']['label_url'] ?? $data['label_url'] ?? null) : null;

        if (! $response->successful() || ! is_string($labelUrl) || $labelUrl === '') {
            return $this->failure('sendit_label_failed', $this->responseMessage($response, 'Sendit label not available.'), [
                'tracking_number' => $trackingNumber,
                'raw' => $data,
            ]);
        }

        return $this->success('label_available', 'Sendit label URL retrieved.', [
            'label_url' => $labelUrl,
            'tracking_number' => $trackingNumber,
        ]);
    }

    /** @param  array{public_key: string, secret_key: string}  $credentials */
    public function testConnection(array $credentials): array
    {
        $this->token = null;

        if ($credentials['public_key'] === '' || $credentials['secret_key'] === '') {
            return $this->failure('sendit_incomplete', 'Sendit requires a public key and a secret key.');
        }

        if (! $this->ensureToken($credentials)) {
            return $this->failure('sendit_auth_failed', 'Sendit authentication failed. Verify public and secret keys.');
        }

        return $this->success('sendit_connected', 'Sendit API connection successful.');
    }

    /**
     * @return array{ok: bool, code: string, message: string, data: array<string, mixed>}
     */
    public function listDeliveries(int $page = 1): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        if (! $this->ensureToken($credentials)) {
            return $this->failure('sendit_auth_failed', 'Sendit authentication failed.');
        }

        $response = $this->authorizedGet('deliveries', ['page' => max(1, $page)]);
        $data = $this->decodeJson($response);

        if (! $response->successful() || ! is_array($data) || empty($data['success'])) {
            return $this->failure('sendit_list_failed', $this->responseMessage($response, 'Sendit list deliveries failed.'), [
                'page' => $page,
                'http_status' => $response->status(),
                'raw' => $data,
            ]);
        }

        $items = is_array($data['data'] ?? null) ? $data['data'] : [];

        return $this->success('sendit_list', 'Sendit deliveries retrieved.', [
            'page' => $page,
            'items' => $items,
            'count' => count($items),
            'raw' => $data,
        ]);
    }

    /**
     * @return array{ok: bool, code: string, message: string, data: array<string, mixed>}
     */
    public function getDelivery(string $code): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        if (! $this->ensureToken($credentials)) {
            return $this->failure('sendit_auth_failed', 'Sendit authentication failed.');
        }

        $response = $this->authorizedGet('deliveries/'.urlencode($code));
        $data = $this->decodeJson($response);

        if (! $response->successful() || ! is_array($data) || empty($data['success'])) {
            return $this->failure('sendit_detail_failed', $this->responseMessage($response, 'Sendit delivery detail failed.'), [
                'code' => $code,
                'http_status' => $response->status(),
                'raw' => $data,
            ]);
        }

        $delivery = is_array($data['data'] ?? null) ? $data['data'] : [];

        return $this->success('sendit_detail', 'Sendit delivery detail retrieved.', [
            'delivery' => $delivery,
            'raw' => $data,
        ]);
    }

    /** @param  array{public_key: string, secret_key: string}  $credentials */
    protected function ensureToken(array $credentials): bool
    {
        if ($this->token !== null) {
            return true;
        }

        $response = $this->httpPost('login', [
            'public_key' => $credentials['public_key'],
            'secret_key' => $credentials['secret_key'],
        ]);

        $data = $this->decodeJson($response);
        if (! $response->successful() || ! is_array($data) || empty($data['success'])) {
            return false;
        }

        $token = is_array($data['data'] ?? null) ? ($data['data']['token'] ?? null) : null;
        if (! is_string($token) || $token === '') {
            return false;
        }

        $this->token = $token;

        return true;
    }

    protected function resolveDistrictId(string $cityName): ?int
    {
        if ($this->token === null) {
            return null;
        }

        $response = $this->authorizedGet('districts', [
            'querystring' => $cityName,
            'page' => 1,
        ]);

        $data = $this->decodeJson($response);
        if (! is_array($data) || ! is_array($data['data'] ?? null)) {
            return null;
        }

        foreach ($data['data'] as $district) {
            if (! is_array($district)) {
                continue;
            }
            if (isset($district['name'], $district['id']) && mb_strtolower((string) $district['name']) === mb_strtolower($cityName)) {
                return (int) $district['id'];
            }
        }

        $first = $data['data'][0] ?? null;

        return is_array($first) && isset($first['id']) ? (int) $first['id'] : null;
    }

    /** @param  array<string, mixed>  $body */
    protected function authorizedPost(string $path, array $body = []): Response
    {
        return $this->httpPost($path, $body, $this->authHeaders());
    }

    /** @param  array<string, mixed>  $query */
    protected function authorizedGet(string $path, array $query = []): Response
    {
        return $this->httpGet($path, $query, $this->authHeaders());
    }

    /** @return array<string, string> */
    protected function authHeaders(): array
    {
        return [
            'Authorization' => 'Bearer '.(string) $this->token,
            'Content-Type' => 'application/json',
        ];
    }
}
