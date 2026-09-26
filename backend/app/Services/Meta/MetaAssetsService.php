<?php

namespace App\Services\Meta;

use App\Models\SystemSetting;

/**
 * Détecte les actifs publicitaires du compte Meta connecté (Page Facebook,
 * compte Instagram lié, Pixel) et les enregistre dans Paramètres → Meta.
 */
class MetaAssetsService
{
    public function __construct(
        private readonly MetaAdsConfig $config,
        private readonly MetaGraphClient $graph,
        private readonly MetaSocialSyncService $social,
    ) {}

    /**
     * @return array{
     *   pages: list<array{id: string, name: string, instagram_id: string|null}>,
     *   pixels: list<array{id: string, name: string}>,
     *   saved: array<string, string>
     * }
     */
    public function detect(int $brandId): array
    {
        $cfg = $this->config->forBrand($brandId);
        if ($cfg['access_token'] === '') {
            throw new MetaApiException('Aucun compte Meta connecté. Allez dans Paramètres → Meta et cliquez « Connecter avec Facebook ».');
        }

        $pages = [];
        foreach ($this->social->pagesForBrand($brandId) as $page) {
            $ig = $page['instagram_business_account'] ?? null;
            $pages[] = [
                'id' => (string) ($page['id'] ?? ''),
                'name' => (string) ($page['name'] ?? 'Page'),
                'instagram_id' => is_array($ig) ? (string) ($ig['id'] ?? '') : null,
            ];
        }

        $pixels = $this->fetchPixels($brandId, $cfg['business_id']);

        // On ne remplace jamais un choix déjà fait par l'utilisateur.
        $saved = [];
        if ($pages !== []) {
            $saved += $this->fillIfEmpty($brandId, 'meta_page_id', $pages[0]['id']);
            if (! empty($pages[0]['instagram_id'])) {
                $saved += $this->fillIfEmpty($brandId, 'meta_instagram_id', (string) $pages[0]['instagram_id']);
            }
        }
        if ($pixels !== []) {
            $saved += $this->fillIfEmpty($brandId, 'meta_pixel_id', $pixels[0]['id']);
        }

        return ['pages' => $pages, 'pixels' => $pixels, 'saved' => $saved];
    }

    /** @return list<array{id: string, name: string}> */
    private function fetchPixels(int $brandId, string $businessId): array
    {
        $paths = [];
        if ($businessId !== '') {
            $paths[] = $businessId.'/owned_pixels';
        }
        foreach (\App\Models\AdAccount::query()->where('brand_id', $brandId)->where('platform', 'meta')->pluck('external_account_id') as $actId) {
            if ($actId) {
                $paths[] = 'act_'.str_replace('act_', '', (string) $actId).'/adspixels';
            }
        }

        foreach ($paths as $path) {
            try {
                $rows = $this->graph->paginate($brandId, $path, ['fields' => 'id,name', 'limit' => 50], 3);
                if ($rows !== []) {
                    return array_map(fn ($r) => [
                        'id' => (string) ($r['id'] ?? ''),
                        'name' => (string) ($r['name'] ?? 'Pixel'),
                    ], $rows);
                }
            } catch (MetaApiException) {
                // Droits manquants sur cette source : on essaie la suivante.
            }
        }

        return [];
    }

    /** @return array<string, string> */
    private function fillIfEmpty(int $brandId, string $key, string $value): array
    {
        if ($value === '') {
            return [];
        }

        $current = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', $key)
            ->value('setting_value');

        if (trim((string) $current) !== '') {
            return [];
        }

        SystemSetting::query()->updateOrCreate(
            ['brand_id' => $brandId, 'setting_key' => $key],
            ['setting_group' => 'meta', 'setting_value' => $value, 'is_sensitive' => false]
        );

        return [$key => $value];
    }
}
