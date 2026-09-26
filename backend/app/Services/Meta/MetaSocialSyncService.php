<?php

namespace App\Services\Meta;

use App\Models\SocialAccount;
use Illuminate\Support\Facades\DB;

/**
 * Importe les Pages Facebook du Business Manager (et leur compte Instagram lié)
 * dans « Comptes sociaux », avec le jeton Meta déjà connecté.
 */
class MetaSocialSyncService
{
    public function __construct(
        private readonly MetaAdsConfig $config,
        private readonly MetaGraphClient $graph,
    ) {}

    /** @return array{created: int, updated: int, total: int} */
    public function syncPages(int $brandId): array
    {
        $cfg = $this->config->forBrand($brandId);
        if ($cfg['access_token'] === '') {
            throw new MetaApiException('Aucun compte Meta connecté. Allez dans Paramètres → Meta et cliquez « Connecter avec Facebook ».');
        }

        $pages = $this->fetchPages($brandId, $cfg['business_id']);
        if ($pages === []) {
            throw new MetaApiException('Aucune Page Facebook trouvée sur ce compte Meta. Vérifiez que vos Pages appartiennent bien au Business Manager connecté.');
        }

        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($brandId, $pages, &$created, &$updated) {
            foreach ($pages as $page) {
                $pageId = (string) ($page['id'] ?? '');
                if ($pageId === '') {
                    continue;
                }

                $this->upsert($brandId, [
                    'platform' => 'facebook',
                    'account_name' => (string) ($page['name'] ?? 'Page Facebook'),
                    'handle' => (string) ($page['username'] ?? ''),
                    'profile_url' => (string) ($page['link'] ?? 'https://facebook.com/'.$pageId),
                    'credential_ref' => $pageId,
                    'follower_count' => (int) ($page['followers_count'] ?? $page['fan_count'] ?? 0),
                ], $created, $updated);

                $ig = $page['instagram_business_account'] ?? null;
                if (is_array($ig) && ! empty($ig['id'])) {
                    $username = (string) ($ig['username'] ?? '');
                    $this->upsert($brandId, [
                        'platform' => 'instagram',
                        'account_name' => $username !== '' ? '@'.$username : 'Instagram',
                        'handle' => $username,
                        'profile_url' => $username !== '' ? 'https://instagram.com/'.$username : '',
                        'credential_ref' => (string) $ig['id'],
                        'follower_count' => (int) ($ig['followers_count'] ?? 0),
                    ], $created, $updated);
                }
            }
        });

        return ['created' => $created, 'updated' => $updated, 'total' => $created + $updated];
    }

    /**
     * Pages visibles pour cette marque (réutilisé par MetaAssetsService).
     *
     * @return list<array<string, mixed>>
     */
    public function pagesForBrand(int $brandId): array
    {
        return $this->fetchPages($brandId, $this->config->forBrand($brandId)['business_id']);
    }

    /**
     * Pages du Business Manager ; à défaut, Pages de l'utilisateur connecté.
     *
     * @return list<array<string, mixed>>
     */
    private function fetchPages(int $brandId, string $businessId): array
    {
        $fields = 'id,name,username,link,followers_count,fan_count,instagram_business_account{id,username,followers_count}';

        if ($businessId !== '') {
            foreach (['owned_pages', 'client_pages'] as $edge) {
                try {
                    $pages = $this->graph->paginate($brandId, $businessId.'/'.$edge, ['fields' => $fields, 'limit' => 100], 5);
                    if ($pages !== []) {
                        return $pages;
                    }
                } catch (MetaApiException) {
                    // Edge indisponible (droits) : on tente la suivante.
                }
            }
        }

        try {
            return $this->graph->paginate($brandId, 'me/accounts', ['fields' => $fields, 'limit' => 100], 5);
        } catch (MetaApiException) {
            return [];
        }
    }

    /** @param array<string, mixed> $data */
    private function upsert(int $brandId, array $data, int &$created, int &$updated): void
    {
        $existing = SocialAccount::query()
            ->where('brand_id', $brandId)
            ->where('platform', $data['platform'])
            ->where(fn ($q) => $q->where('credential_ref', $data['credential_ref'])
                ->orWhere(fn ($w) => $w->whereNull('credential_ref')->where('account_name', $data['account_name'])))
            ->first();

        if ($existing) {
            $existing->fill($data + ['api_connected' => true])->save();
            $updated++;

            return;
        }

        SocialAccount::query()->create($data + [
            'brand_id' => $brandId,
            'api_connected' => true,
            'status' => 'active',
        ]);
        $created++;
    }
}
