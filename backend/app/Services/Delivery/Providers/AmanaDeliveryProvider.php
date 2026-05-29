<?php

namespace App\Services\Delivery\Providers;

use App\Models\DeliveryCompany;
use App\Services\Delivery\Contracts\DeliveryProviderInterface;

/**
 * Placeholder for future Amana API — structure only, no live HTTP calls.
 */
class AmanaDeliveryProvider implements DeliveryProviderInterface
{
    public function __construct(
        protected ?DeliveryCompany $company = null
    ) {}

    public function createShipment(array $payload): array
    {
        if (! $this->isConfigured()) {
            return $this->notConfigured();
        }

        return [
            'ok' => false,
            'code' => 'amana_not_implemented',
            'message' => 'Amana API client not wired yet. Configure credentials for future use.',
            'data' => [],
        ];
    }

    public function trackShipment(string $trackingNumber): array
    {
        if (! $this->isConfigured()) {
            return $this->notConfigured();
        }

        return [
            'ok' => false,
            'code' => 'amana_track_stub',
            'message' => 'Tracking sync will call Amana when integrated.',
            'data' => ['tracking_number' => $trackingNumber],
        ];
    }

    public function cancelShipment(string $trackingNumber): array
    {
        if (! $this->isConfigured()) {
            return $this->notConfigured();
        }

        return [
            'ok' => false,
            'code' => 'amana_cancel_stub',
            'message' => 'Cancel endpoint not implemented.',
            'data' => [],
        ];
    }

    public function printLabel(string $trackingNumber): array
    {
        if (! $this->isConfigured()) {
            return $this->notConfigured();
        }

        return [
            'ok' => false,
            'code' => 'amana_label_stub',
            'message' => 'Label download not implemented.',
            'data' => [],
        ];
    }

    protected function isConfigured(): bool
    {
        if (! $this->company) {
            return false;
        }

        $url = $this->company->integrationApiUrl();
        $key = $this->company->integrationApiKey();

        return filled($url) && filled($key);
    }

    /**
     * @return array{ok: bool, code: string, message: string, data: array<string, mixed>}
     */
    protected function notConfigured(): array
    {
        return [
            'ok' => false,
            'code' => 'not_configured',
            'message' => 'Amana integration: set api_url and api_key_ref on the delivery company.',
            'data' => [],
        ];
    }
}
