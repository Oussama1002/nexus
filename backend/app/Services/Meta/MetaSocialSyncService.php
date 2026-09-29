<?php

namespace App\Services\Meta;

use App\Models\SocialAccount;
use App\Models\SystemSetting;
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

        // Un compte Instagram professionnel peut appartenir au Business sans
        // être rattaché à une Page : il faut le lire sur ses propres arêtes.
        $instagram = $this->fetchInstagramAccounts($brandId, $cfg['business_id']);

        if ($pages === [] && $instagram === []) {
            throw new MetaApiException('Aucune Page Facebook ni compte Instagram trouvé sur ce compte Meta. Vérifiez qu’ils appartiennent bien au Business Manager connecté.');
        }

        $created = 0;
        $updated = 0;

        DB::transaction(function () use ($brandId, $pages, $instagram, &$created, &$updated) {
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
                    $this->upsertInstagram($brandId, [
                        'id' => (string) $ig['id'],
                        'username' => (string) ($ig['username'] ?? ''),
                        'followers_count' => (int) ($ig['followers_count'] ?? 0),
                    ], $created, $updated);
                }
            }

            foreach ($instagram as $account) {
                $this->upsertInstagram($brandId, $account, $created, $updated);
            }

            // Connexion Instagram directe : la seule source qui connaisse le
            // pseudo et les abonnés, Facebook ne les donne pas.
            foreach ($this->instagramFromDirectConnection($brandId) as $account) {
                $this->upsertInstagram($brandId, $account, $created, $updated);
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

    /**
     * Comptes Instagram professionnels du Business Manager, y compris ceux
     * qui ne sont rattachés à aucune Page.
     *
     * @return list<array{id: string, username: string, followers_count: int}>
     */
    private function fetchInstagramAccounts(int $brandId, string $businessId): array
    {
        if ($businessId === '') {
            return [];
        }

        foreach (['owned_instagram_accounts', 'instagram_accounts', 'client_instagram_accounts'] as $edge) {
            try {
                $rows = $this->graph->paginate($brandId, $businessId.'/'.$edge, [
                    'fields' => 'id,username,followers_count',
                    'limit' => 50,
                ], 3);
            } catch (MetaApiException) {
                continue;
            }

            if ($rows === []) {
                continue;
            }

            return array_values(array_filter(array_map(function ($row) use ($brandId) {
                $id = (string) ($row['id'] ?? '');
                if ($id === '') {
                    return null;
                }

                $username = (string) ($row['username'] ?? '');
                $followers = (int) ($row['followers_count'] ?? 0);

                // Certaines arêtes ne renvoient que l'ID : on lit le nœud.
                if ($username === '') {
                    try {
                        $node = $this->graph->get($brandId, $id, ['fields' => 'username,name,followers_count']);
                        $username = (string) ($node['username'] ?? $node['name'] ?? '');
                        $followers = $followers ?: (int) ($node['followers_count'] ?? 0);
                    } catch (MetaApiException) {
                        // Droits Instagram manquants : on garde l'ID seul.
                    }
                }

                return ['id' => $id, 'username' => $username, 'followers_count' => $followers];
            }, $rows)));
        }

        return [];
    }

    /**
     * Compte Instagram issu de sa propre connexion, quand elle existe.
     *
     * @return list<array{id: string, username: string, followers_count: int}>
     */
    private function instagramFromDirectConnection(int $brandId): array
    {
        $service = app(InstagramGraphService::class);
        if ($service->tokenFor($brandId) === null) {
            return [];
        }

        try {
            $profile = $service->overview($brandId, 1)['profile'];
        } catch (MetaApiException) {
            return [];
        }

        $username = (string) ($profile['handle'] ?? '');
        if ($username === '') {
            return [];
        }

        $id = trim((string) SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', 'instagram_user_id')
            ->value('setting_value'));

        return [[
            'id' => $id !== '' ? $id : $username,
            'username' => $username,
            'followers_count' => (int) ($profile['followers'] ?? 0),
        ]];
    }

    /** @param array{id: string, username: string, followers_count: int} $account */
    private function upsertInstagram(int $brandId, array $account, int &$created, int &$updated): void
    {
        $username = $account['username'];

        $this->upsert($brandId, [
            'platform' => 'instagram',
            'account_name' => $username !== '' ? '@'.$username : 'Instagram '.$account['id'],
            'handle' => $username,
            'profile_url' => $username !== '' ? 'https://instagram.com/'.$username : '',
            'credential_ref' => $account['id'],
            'follower_count' => $account['followers_count'],
        ], $created, $updated);
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
