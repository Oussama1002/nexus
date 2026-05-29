<?php

namespace App\Services\Meta;

use App\Models\SystemSetting;

class MetaAdsConfig
{
    public const DEFAULT_GRAPH_VERSION = 'v21.0';

    /** @return array{app_id: string, business_id: string, access_token: string, graph_version: string, base_url: string} */
    public function forBrand(int $brandId): array
    {
        $rows = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->whereIn('setting_key', [
                'meta_app_id',
                'meta_business_id',
                'meta_access_token',
                'meta_graph_api_version',
            ])
            ->pluck('setting_value', 'setting_key')
            ->all();

        $token = trim((string) ($rows['meta_access_token'] ?? ''));
        if ($token === '' || preg_match('/^\*+$/', $token)) {
            $token = '';
        }

        $version = trim((string) ($rows['meta_graph_api_version'] ?? ''));
        if ($version === '') {
            $version = self::DEFAULT_GRAPH_VERSION;
        }
        if (! str_starts_with($version, 'v')) {
            $version = 'v'.$version;
        }

        return [
            'app_id' => trim((string) ($rows['meta_app_id'] ?? '')),
            'business_id' => trim((string) ($rows['meta_business_id'] ?? '')),
            'access_token' => $token,
            'graph_version' => $version,
            'base_url' => 'https://graph.facebook.com/'.$version,
        ];
    }

    public function isComplete(int $brandId): bool
    {
        $c = $this->forBrand($brandId);

        return $c['app_id'] !== '' && $c['business_id'] !== '' && $c['access_token'] !== '';
    }
}
