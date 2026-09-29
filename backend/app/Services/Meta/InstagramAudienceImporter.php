<?php

namespace App\Services\Meta;

use App\Models\Influencer;
use Illuminate\Support\Facades\Http;

/**
 * Importe comme influenceurs les comptes Instagram qui interagissent avec les
 * publications de la marque.
 *
 * Meta n'expose la liste des abonnés d'aucun compte : les commentateurs sont
 * la seule audience nominative accessible — et la plus pertinente, puisqu'ils
 * sont déjà engagés.
 */
class InstagramAudienceImporter
{
    private const BASE = 'https://graph.instagram.com/v23.0';

    public function __construct(
        private readonly InstagramGraphService $instagram,
        private readonly MetaGraphClient $graph,
    ) {}

    /**
     * Fiche d'un compte Instagram par son pseudo.
     *
     * Cette application Meta utilise « Instagram API with Instagram Login »,
     * qui ne donne acces qu'au compte connecte : un compte tiers ne peut pas
     * etre consulte (il faudrait le mode « API setup with Facebook login »).
     *
     * @return array{username: string, name: string, followers: int, media_count: int, biography: string, website: string, avatar: string|null, found: bool, warning: string|null}
     */
    public function lookupAccount(int $brandId, string $username): array
    {
        $username = ltrim(trim($username), '@');
        if ($username === '') {
            throw new MetaApiException('Indiquez un pseudo Instagram.');
        }

        $empty = [
            'username' => $username,
            'name' => '',
            'followers' => 0,
            'media_count' => 0,
            'biography' => '',
            'website' => '',
            'avatar' => null,
            'found' => false,
            'warning' => 'Compte non lisible : Instagram ne renseigne que les comptes Business ou Créateur, '
                .'et seulement si l’autorisation instagram_basic est accordée. Saisissez le nom, les abonnés et les publications à la main.',
        ];

        try {
            $profile = $this->instagram->overview($brandId, 1)['profile'];
        } catch (MetaApiException $e) {
            return array_merge($empty, ['warning' => $e->getMessage()]);
        }

        $connected = mb_strtolower((string) ($profile['handle'] ?? ''));
        if ($connected === '' || $connected !== mb_strtolower($username)) {
            // Compte tiers : passe par le referentiel Instagram rattache a la
            // Page Facebook, disponible seulement avec instagram_basic.
            $discovered = $this->discover($brandId, $username);

            return $discovered ?? $empty;
        }

        return [
            'username' => (string) $profile['handle'],
            'name' => (string) ($profile['name'] ?? ''),
            'followers' => (int) ($profile['followers'] ?? 0),
            'media_count' => (int) ($profile['media_count'] ?? 0),
            'biography' => (string) ($profile['bio'] ?? ''),
            'website' => (string) ($profile['website'] ?? ''),
            'avatar' => $profile['avatar'] ?? null,
            'found' => true,
            'warning' => null,
        ];
    }

    /**
     * Fiche publique d'un compte Business ou Createur, via business_discovery.
     *
     * Necessite instagram_basic et un compte Instagram rattache a une Page :
     * renvoie null quand l'un des deux manque.
     *
     * @return array<string, mixed>|null
     */
    private function discover(int $brandId, string $username): ?array
    {
        $igId = trim((string) \App\Models\SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', 'meta_instagram_id')
            ->value('setting_value'));

        if ($igId === '') {
            return null;
        }

        $fields = sprintf(
            'business_discovery.username(%s){username,name,biography,website,followers_count,media_count,profile_picture_url}',
            $username
        );

        try {
            $data = $this->graph->get($brandId, $igId, ['fields' => $fields]);
        } catch (MetaApiException) {
            return null;
        }

        $found = $data['business_discovery'] ?? null;
        if (! is_array($found)) {
            return null;
        }

        return [
            'username' => (string) ($found['username'] ?? $username),
            'name' => (string) ($found['name'] ?? ''),
            'followers' => (int) ($found['followers_count'] ?? 0),
            'media_count' => (int) ($found['media_count'] ?? 0),
            'biography' => (string) ($found['biography'] ?? ''),
            'website' => (string) ($found['website'] ?? ''),
            'avatar' => $found['profile_picture_url'] ?? null,
            'found' => true,
            'warning' => null,
        ];
    }

    /**
     * Comptes candidats, sans rien créer : sert à proposer des pseudos dans le
     * formulaire « Nouvelle influenceuse ».
     *
     * @return array{scanned_posts: int, candidates: list<array{username: string, interactions: int, existing: bool}>}
     */
    public function suggestCommenters(int $brandId, int $postLimit = 25): array
    {
        [$usernames, $posts] = $this->collectCommenters($brandId, $postLimit);

        $known = Influencer::query()
            ->where('brand_id', $brandId)
            ->whereNotNull('username')
            ->pluck('username')
            ->map(fn ($u) => mb_strtolower((string) $u))
            ->all();

        $candidates = [];
        foreach ($usernames as $username => $interactions) {
            $candidates[] = [
                'username' => (string) $username,
                'interactions' => $interactions,
                'existing' => in_array(mb_strtolower((string) $username), $known, true),
            ];
        }

        return ['scanned_posts' => $posts, 'candidates' => $candidates];
    }

    /**
     * @return array{created: int, updated: int, scanned_posts: int, accounts: list<string>}
     */
    public function importCommenters(int $brandId, int $postLimit = 25): array
    {
        [$usernames, $postCount] = $this->collectCommenters($brandId, $postLimit);

        $created = 0;
        $updated = 0;

        foreach ($usernames as $username => $interactions) {
            $existing = Influencer::query()
                ->where('brand_id', $brandId)
                ->where('username', $username)
                ->first();

            if ($existing) {
                // On n'écrase pas un profil déjà qualifié par l'équipe.
                if (! $existing->bio) {
                    $existing->bio = $this->note($interactions);
                    $existing->save();
                    $updated++;
                }

                continue;
            }

            Influencer::query()->create([
                'brand_id' => $brandId,
                'full_name' => '@'.$username,
                'username' => $username,
                'platform' => 'instagram',
                'bio' => $this->note($interactions),
                'social_links_json' => json_encode(['instagram' => 'https://instagram.com/'.$username]),
                'status' => 'prospect',
            ]);
            $created++;
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'scanned_posts' => $postCount,
            'accounts' => array_slice(array_keys($usernames), 0, 20),
        ];
    }

    /**
     * Comptes ayant commenté les dernières publications, par fréquence.
     *
     * @return array{0: array<string, int>, 1: int}
     */
    private function collectCommenters(int $brandId, int $postLimit): array
    {
        $token = $this->instagram->tokenFor($brandId);
        if ($token === null) {
            throw new MetaApiException('Instagram non connecté. Allez dans Paramètres → Meta et cliquez « Connecter Instagram ».');
        }

        $media = $this->get('me/media', ['fields' => 'id', 'limit' => min($postLimit, 50)], $token);
        $posts = is_array($media['data'] ?? null) ? $media['data'] : [];

        $usernames = [];
        foreach ($posts as $post) {
            $postId = (string) ($post['id'] ?? '');
            if ($postId === '') {
                continue;
            }

            try {
                $comments = $this->get($postId.'/comments', [
                    'fields' => 'username,text,like_count',
                    'limit' => 100,
                ], $token);
            } catch (MetaApiException) {
                continue;
            }

            foreach (($comments['data'] ?? []) as $comment) {
                $username = trim((string) ($comment['username'] ?? ''));
                if ($username === '') {
                    continue;
                }
                $usernames[$username] = ($usernames[$username] ?? 0) + 1;
            }
        }

        // Le compte de la marque n'est pas un influenceur.
        $self = $this->selfUsername($brandId);
        if ($self !== '') {
            unset($usernames[$self]);
        }

        arsort($usernames);

        return [$usernames, count($posts)];
    }

    private function note(int $interactions): string
    {
        return $interactions > 1
            ? 'Importé depuis Instagram : '.$interactions.' commentaires sur vos publications.'
            : 'Importé depuis Instagram : 1 commentaire sur vos publications.';
    }

    private function selfUsername(int $brandId): string
    {
        try {
            return (string) ($this->instagram->overview($brandId, 1)['profile']['handle'] ?? '');
        } catch (MetaApiException) {
            return '';
        }
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    private function get(string $path, array $query, string $token): array
    {
        $query['access_token'] = $token;
        $response = Http::timeout(30)->acceptJson()->get(self::BASE.'/'.ltrim($path, '/'), $query);

        if (! $response->successful()) {
            $error = $response->json('error') ?? [];
            $message = is_array($error) ? (string) ($error['message'] ?? 'Erreur Instagram.') : 'Erreur Instagram.';
            $code = is_array($error) ? ($error['code'] ?? null) : null;

            throw new MetaApiException(
                MetaErrorTranslator::toFrench($message, is_int($code) ? $code : null),
                is_int($code) ? $code : null
            );
        }

        $data = $response->json();

        return is_array($data) ? $data : [];
    }
}
