<?php

namespace App\Services\Delivery\Providers;

use Illuminate\Http\Client\Response;

/**
 * Ameex.ma customer delivery API — C-Api-Key header authentication.
 */
class AmeexDeliveryProvider extends AbstractHttpDeliveryProvider
{
    protected function providerCode(): string
    {
        return 'ameex';
    }

    protected function defaultApiUrl(): string
    {
        return (string) config('delivery.ameex.api_url', 'https://api.ameex.ma');
    }

    /** @return array{api_key: string}|null */
    protected function credentialsReady(): ?array
    {
        if (! $this->company) {
            return null;
        }

        $key = trim((string) ($this->company->integrationApiKey() ?? ''));

        return $key !== '' ? ['api_key' => $key] : null;
    }

    public function createShipment(array $payload): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        $body = [
            'parcel_receiver' => (string) ($payload['recipient_name'] ?? ''),
            'parcel_phone' => (string) ($payload['recipient_phone'] ?? ''),
            'parcel_city' => (string) ($payload['recipient_city'] ?? ''),
            'parcel_address' => (string) ($payload['recipient_address'] ?? ''),
            'parcel_price' => (float) ($payload['cod_amount'] ?? 0),
            'parcel_product' => (string) ($payload['products'] ?? ''),
            'parcel_note' => (string) ($payload['comment'] ?? $payload['notes'] ?? ''),
            'parcel_ref' => (string) ($payload['reference'] ?? $payload['tracking_number'] ?? ''),
            'parcel_open' => ! empty($payload['allow_open']) ? 1 : 0,
        ];

        $response = $this->authorizedPost('customer/Delivery/AddParcel', $body);
        $data = $this->decodeJson($response);

        if ($this->isApiKeyError($data)) {
            return $this->failure('ameex_auth_failed', 'Ameex API key invalid or not authorized.');
        }

        if (! $response->successful() || ! is_array($data)) {
            return $this->failure('ameex_create_failed', $this->responseMessage($response, 'Ameex create parcel failed.'), [
                'http_status' => $response->status(),
                'raw' => $data,
            ]);
        }

        $tracking = $data['parcel_code'] ?? $data['code'] ?? $data['tracking'] ?? null;
        if ($tracking === null && is_array($data['data'] ?? null)) {
            $tracking = $data['data']['parcel_code'] ?? $data['data']['code'] ?? null;
        }

        return $this->success('ameex_created', 'Shipment registered at Ameex.', [
            'tracking_number' => $tracking,
            'external_tracking_id' => $tracking,
            'carrier_status' => (string) ($data['status'] ?? $data['parcel_status'] ?? 'created'),
            'raw' => $data,
        ]);
    }

    public function trackShipment(string $trackingNumber): array
    {
        $credentials = $this->credentialsReady();
        if ($credentials === null) {
            return $this->notConfigured();
        }

        $response = $this->authorizedPost('customer/Delivery/GetParcelTracking', [
            'parcel_code' => $trackingNumber,
            'code' => $trackingNumber,
            'tracking' => $trackingNumber,
        ]);

        $data = $this->decodeJson($response);

        if ($this->isApiKeyError($data)) {
            return $this->failure('ameex_auth_failed', 'Ameex API key invalid or not authorized.');
        }

        if (! $response->successful() || ! is_array($data)) {
            return $this->failure('ameex_track_failed', $this->responseMessage($response, 'Ameex tracking failed.'), [
                'tracking_number' => $trackingNumber,
                'http_status' => $response->status(),
            ]);
        }

        $status = (string) (
            $data['parcel_status']
            ?? $data['status']
            ?? (is_array($data['data'] ?? null) ? ($data['data']['status'] ?? $data['data']['parcel_status'] ?? '') : '')
        );

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

        $response = $this->authorizedPost('customer/Delivery/DeleteParcel', [
            'parcel_code' => $trackingNumber,
            'code' => $trackingNumber,
        ]);

        $data = $this->decodeJson($response);

        if ($this->isApiKeyError($data)) {
            return $this->failure('ameex_auth_failed', 'Ameex API key invalid or not authorized.');
        }

        if (! $response->successful()) {
            return $this->failure('ameex_cancel_failed', $this->responseMessage($response, 'Ameex cancel failed.'), [
                'tracking_number' => $trackingNumber,
                'raw' => $data,
            ]);
        }

        return $this->success('ameex_cancelled', 'Shipment cancelled at Ameex.', [
            'tracking_number' => $trackingNumber,
            'raw' => $data,
        ]);
    }

    public function printLabel(string $trackingNumber): array
    {
        $track = $this->trackShipment($trackingNumber);
        if (! ($track['ok'] ?? false)) {
            return $track;
        }

        $raw = is_array($track['data']['raw'] ?? null) ? $track['data']['raw'] : [];
        $labelUrl = $raw['label_url'] ?? $raw['label'] ?? null;
        if (is_array($raw['data'] ?? null)) {
            $labelUrl = $labelUrl ?? ($raw['data']['label_url'] ?? $raw['data']['label'] ?? null);
        }

        if (! is_string($labelUrl) || $labelUrl === '') {
            return $this->failure('ameex_label_failed', 'Ameex label not available for this parcel.', [
                'tracking_number' => $trackingNumber,
            ]);
        }

        return $this->success('label_available', 'Ameex label URL retrieved.', [
            'label_url' => $labelUrl,
            'tracking_number' => $trackingNumber,
        ]);
    }

    /** @param  array{api_key: string}  $credentials */
    public function testConnection(array $credentials): array
    {
        if ($credentials['api_key'] === '') {
            return $this->failure('ameex_incomplete', 'Ameex API key is required.');
        }

        $response = $this->httpGet('customer/Delivery/ParcelsList', [], $this->apiHeaders($credentials['api_key']));
        $data = $this->decodeJson($response);

        if ($this->isApiKeyError($data)) {
            return $this->failure('ameex_auth_failed', 'Ameex API key invalid or not authorized.');
        }

        if (! $response->successful()) {
            return $this->failure('ameex_connection_failed', $this->responseMessage($response, 'Ameex connection test failed.'));
        }

        return $this->success('ameex_connected', 'Ameex API connection successful.');
    }

    /** @param  array<string, mixed>  $body */
    protected function authorizedPost(string $path, array $body): Response
    {
        $credentials = $this->credentialsReady();
        $key = is_array($credentials) ? $credentials['api_key'] : '';

        return $this->httpPost($path, $body, $this->apiHeaders($key));
    }

    /** @return array<string, string> */
    protected function apiHeaders(string $apiKey): array
    {
        return [
            'C-Api-Key' => $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }

    /** @param  array<string, mixed>|null  $data */
    protected function isApiKeyError(?array $data): bool
    {
        if (! is_array($data)) {
            return false;
        }

        $check = $data['CHECK_API'] ?? null;

        return is_array($check)
            && ($check['RESULT'] ?? '') === 'ERROR'
            && str_contains(mb_strtolower((string) ($check['MESSAGE'] ?? '')), 'api key');
    }
}
