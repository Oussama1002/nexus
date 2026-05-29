<?php

namespace App\Services\Delivery\Providers;

use App\Models\DeliveryCompany;
use App\Services\Delivery\Contracts\DeliveryProviderInterface;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

abstract class AbstractHttpDeliveryProvider implements DeliveryProviderInterface
{
    public function __construct(
        protected ?DeliveryCompany $company = null
    ) {}

    abstract protected function providerCode(): string;

    abstract protected function defaultApiUrl(): string;

    protected function apiUrl(): string
    {
        $url = $this->company?->integrationApiUrl();

        return rtrim((string) ($url ?: $this->defaultApiUrl()), '/');
    }

    protected function isConfigured(): bool
    {
        return $this->company !== null && filled($this->credentialsReady());
    }

    /** @return array<string, mixed>|null */
    protected function credentialsReady(): ?array
    {
        return null;
    }

    /**
     * @return array{ok: bool, code: string, message: string, data: array<string, mixed>}
     */
    protected function notConfigured(): array
    {
        return [
            'ok' => false,
            'code' => 'not_configured',
            'message' => sprintf(
                '%s integration: configure api_url and API credentials on the delivery company.',
                ucfirst($this->providerCode())
            ),
            'data' => [],
        ];
    }

    /**
     * @return array{ok: bool, code: string, message: string, data: array<string, mixed>}
     */
    protected function failure(string $code, string $message, array $data = []): array
    {
        return [
            'ok' => false,
            'code' => $code,
            'message' => $message,
            'data' => $data,
        ];
    }

    /**
     * @return array{ok: bool, code: string, message: string, data: array<string, mixed>}
     */
    protected function success(string $code, string $message, array $data = []): array
    {
        return [
            'ok' => true,
            'code' => $code,
            'message' => $message,
            'data' => $data,
        ];
    }

  /**
     * @param  array<string, string>  $headers
     */
    protected function httpGet(string $path, array $query = [], array $headers = []): Response
    {
        return Http::timeout(30)
            ->acceptJson()
            ->withHeaders($headers)
            ->get($this->apiUrl().'/'.ltrim($path, '/'), $query);
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, string>  $headers
     */
    protected function httpPost(string $path, array $body = [], array $headers = []): Response
    {
        return Http::timeout(30)
            ->acceptJson()
            ->withHeaders($headers)
            ->post($this->apiUrl().'/'.ltrim($path, '/'), $body);
    }

    /**
     * @param  array<string, string>  $headers
     */
    protected function httpDelete(string $path, array $headers = []): Response
    {
        return Http::timeout(30)
            ->acceptJson()
            ->withHeaders($headers)
            ->delete($this->apiUrl().'/'.ltrim($path, '/'));
    }

    /** @return array<string, mixed>|null */
    protected function decodeJson(Response $response): ?array
    {
        $data = $response->json();

        return is_array($data) ? $data : null;
    }

    protected function responseMessage(Response $response, string $fallback = 'Carrier API error.'): string
    {
        $data = $this->decodeJson($response);
        if (is_array($data)) {
            foreach (['message', 'error', 'MESSAGE'] as $key) {
                if (! empty($data[$key]) && is_string($data[$key])) {
                    return $data[$key];
                }
            }
            $check = $data['CHECK_API'] ?? null;
            if (is_array($check) && ! empty($check['MESSAGE']) && is_string($check['MESSAGE'])) {
                return $check['MESSAGE'];
            }
        }

        return $fallback;
    }
}
