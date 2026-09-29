<?php

namespace App\Services\Meta;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Http;

/**
 * Lecture d'un compte Instagram via son propre jeton (graph.instagram.com),
 * obtenu par la connexion Instagram directe.
 */
class InstagramGraphService
{
    private const BASE = 'https://graph.instagram.com';

    private const PROFILE_FIELDS = 'user_id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website';

    private const MEDIA_FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

    /** Jeton Instagram enregistré pour cette marque. */
    public function tokenFor(int $brandId): ?string
    {
        $token = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', 'instagram_access_token')
            ->value('setting_value');

        $token = is_string($token) ? trim($token) : '';

        return $token !== '' ? $token : null;
    }

    /**
     * @return array{profile: array<string, mixed>, posts: list<array<string, mixed>>, warning: string|null}
     */
    public function overview(int $brandId, int $limit = 24): array
    {
        $token = $this->tokenFor($brandId);
        if ($token === null) {
            throw new MetaApiException('Instagram non connecté. Allez dans Paramètres → Meta et cliquez « Connecter Instagram ».');
        }

        $node = $this->get('me', ['fields' => self::PROFILE_FIELDS], $token);
        $username = (string) ($node['username'] ?? '');

        $profile = [
            'platform' => 'instagram',
            'name' => (string) ($node['name'] ?? $username),
            'handle' => $username,
            'bio' => (string) ($node['biography'] ?? ''),
            'category' => '',
            'url' => $username !== '' ? 'https://instagram.com/'.$username : '',
            'avatar' => $node['profile_picture_url'] ?? null,
            'followers' => (int) ($node['followers_count'] ?? 0),
            'follows' => (int) ($node['follows_count'] ?? 0),
            'media_count' => (int) ($node['media_count'] ?? 0),
            'website' => (string) ($node['website'] ?? ''),
        ];

        $warning = null;
        $posts = [];

        try {
            $rows = $this->get('me/media', [
                'fields' => self::MEDIA_FIELDS,
                'limit' => min($limit, 50),
            ], $token)['data'] ?? [];

            foreach (array_slice(is_array($rows) ? $rows : [], 0, $limit) as $row) {
                $type = (string) ($row['media_type'] ?? 'IMAGE');
                $posts[] = [
                    'id' => (string) ($row['id'] ?? ''),
                    'caption' => (string) ($row['caption'] ?? ''),
                    'published_at' => $row['timestamp'] ?? null,
                    'media_url' => $type === 'VIDEO' ? ($row['thumbnail_url'] ?? $row['media_url'] ?? null) : ($row['media_url'] ?? null),
                    'permalink' => $row['permalink'] ?? null,
                    'media_type' => $type,
                    'likes' => (int) ($row['like_count'] ?? 0),
                    'comments' => (int) ($row['comments_count'] ?? 0),
                    'shares' => 0,
                ];
            }
        } catch (MetaApiException $e) {
            $warning = 'Publications indisponibles : '.$e->getMessage();
        }

        return ['profile' => $profile, 'posts' => $posts, 'warning' => $warning];
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
            $message = is_array($error) ? (string) ($error['message'] ?? $response->body()) : $response->body();
            $code = is_array($error) ? ($error['code'] ?? null) : null;

            throw new MetaApiException(
                MetaErrorTranslator::toFrench($message ?: 'Erreur Instagram.', is_int($code) ? $code : null),
                is_int($code) ? $code : null
            );
        }

        $data = $response->json();

        return is_array($data) ? $data : [];
    }
}
