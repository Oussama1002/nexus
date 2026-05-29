<?php

namespace App\Services\Delivery;

use App\Models\DeliveryCompany;
use App\Models\SystemSetting;

class DeliveryCarrierResolver
{
    /**
     * Active carrier row + API credentials from brand settings or .env fallback.
     */
    public function resolve(string $code, int $brandId): ?DeliveryCompany
    {
        $defaults = match ($code) {
            'sendit' => [
                'name' => 'Sendit',
                'api_url' => (string) config('delivery.sendit.api_url'),
                'tracking_base_url' => 'https://app.sendit.ma',
                'avg_delivery_days' => 2,
                'public_key' => 'carrier_sendit_public_key',
                'secret_key' => 'carrier_sendit_secret_key',
                'api_url_key' => 'carrier_sendit_api_url',
                'env_public' => 'SENDIT_PUBLIC_KEY',
                'env_secret' => 'SENDIT_SECRET_KEY',
            ],
            'ameex' => [
                'name' => 'Ameex',
                'api_url' => (string) config('delivery.ameex.api_url'),
                'tracking_base_url' => 'https://www.ameex.ma/en/delivery',
                'avg_delivery_days' => 3,
                'public_key' => null,
                'secret_key' => 'carrier_ameex_api_key',
                'api_url_key' => 'carrier_ameex_api_url',
                'env_public' => null,
                'env_secret' => 'AMEEX_API_KEY',
            ],
            default => null,
        };

        if ($defaults === null) {
            return null;
        }

        /** @var DeliveryCompany $company */
        $company = DeliveryCompany::query()->firstOrCreate(
            ['code' => $code],
            [
                'name' => $defaults['name'],
                'api_url' => $defaults['api_url'],
                'tracking_base_url' => $defaults['tracking_base_url'],
                'avg_delivery_days' => $defaults['avg_delivery_days'],
                'status' => 'active',
            ]
        );

        if ($company->status !== 'active') {
            $company->status = 'active';
            $company->save();
        }

        if ($defaults['api_url_key']) {
            $apiUrl = $this->brandSetting($brandId, $defaults['api_url_key']);
            if ($apiUrl !== '') {
                $company->api_url = $apiUrl;
            }
        }

        if ($defaults['public_key']) {
            $public = $this->brandSetting($brandId, $defaults['public_key'])
                ?: trim((string) env($defaults['env_public'], ''));
            if ($public !== '') {
                $company->api_key_ref = $public;
            }
        }

        if ($defaults['secret_key']) {
            $secret = $this->brandSetting($brandId, $defaults['secret_key'])
                ?: trim((string) env($defaults['env_secret'], ''));
            if ($secret !== '') {
                if ($code === 'ameex') {
                    $company->api_key_ref = $secret;
                } else {
                    $company->api_key = $secret;
                }
            }
        }

        return $company;
    }

    protected function brandSetting(int $brandId, string $key): string
    {
        $value = trim((string) (SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', $key)
            ->value('setting_value') ?? ''));

        if ($value === '' || preg_match('/^\*+$/', $value)) {
            return '';
        }

        return $value;
    }
}
