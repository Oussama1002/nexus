<?php

namespace App\Services\Meta;

use App\Models\SocialAccount;

/**
 * Profil et publications d'un compte social, lus en direct depuis Meta
 * (Page Facebook ou compte Instagram professionnel).
 */
class MetaSocialInsightsService
{
    private const PAGE_FIELDS = 'id,name,username,about,category,link,fan_count,followers_count,picture{url},talking_about_count,were_here_count';

    private const PAGE_POST_FIELDS = 'id,message,created_time,full_picture,permalink_url,shares,likes.summary(true).limit(0),comments.summary(true).limit(0)';

    private const IG_FIELDS = 'id,username,name,biography,profile_picture_url,followers_count,follows_count,media_count,website';

    private const IG_MEDIA_FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

    public function __construct(private readonly MetaGraphClient $graph) {}

    /**
     * @return array{profile: array<string, mixed>, posts: list<array<string, mixed>>, warning: string|null}
     */
    public function overview(SocialAccount $account, int $limit = 24): array
    {
        $externalId = trim((string) $account->credential_ref);
        if ($externalId === '') {
            throw new MetaApiException('Ce compte n’a pas d’identifiant Meta. Relancez « Importer depuis Meta » dans Comptes sociaux.');
        }

        $brandId = (int) $account->brand_id;

        return $account->platform === 'instagram'
            ? $this->instagram($brandId, $externalId, $limit)
            : $this->facebook($brandId, $externalId, $limit);
    }

    /**
     * @return array{profile: array<string, mixed>, posts: list<array<string, mixed>>, warning: string|null}
     */
    private function facebook(int $brandId, string $pageId, int $limit): array
    {
        $node = $this->graph->get($brandId, $pageId, ['fields' => self::PAGE_FIELDS]);

        $profile = [
            'platform' => 'facebook',
            'name' => (string) ($node['name'] ?? ''),
            'handle' => (string) ($node['username'] ?? ''),
            'bio' => (string) ($node['about'] ?? ''),
            'category' => (string) ($node['category'] ?? ''),
            'url' => (string) ($node['link'] ?? 'https://facebook.com/'.$pageId),
            'avatar' => $node['picture']['data']['url'] ?? null,
            'followers' => (int) ($node['followers_count'] ?? $node['fan_count'] ?? 0),
            'likes' => (int) ($node['fan_count'] ?? 0),
            'talking_about' => (int) ($node['talking_about_count'] ?? 0),
        ];

        $warning = null;
        $posts = [];

        try {
            $rows = $this->graph->paginate($brandId, $pageId.'/posts', [
                'fields' => self::PAGE_POST_FIELDS,
                'limit' => min($limit, 50),
            ], 2);

            foreach (array_slice($rows, 0, $limit) as $row) {
                $posts[] = [
                    'id' => (string) ($row['id'] ?? ''),
                    'caption' => (string) ($row['message'] ?? ''),
                    'published_at' => $row['created_time'] ?? null,
                    'media_url' => $row['full_picture'] ?? null,
                    'permalink' => $row['permalink_url'] ?? null,
                    'media_type' => 'POST',
                    'likes' => (int) ($row['likes']['summary']['total_count'] ?? 0),
                    'comments' => (int) ($row['comments']['summary']['total_count'] ?? 0),
                    'shares' => (int) ($row['shares']['count'] ?? 0),
                ];
            }
        } catch (MetaApiException $e) {
            $warning = 'Publications indisponibles : '.$e->getMessage();
        }

        return ['profile' => $profile, 'posts' => $posts, 'warning' => $warning];
    }

    /**
     * @return array{profile: array<string, mixed>, posts: list<array<string, mixed>>, warning: string|null}
     */
    private function instagram(int $brandId, string $igId, int $limit): array
    {
        $node = $this->graph->get($brandId, $igId, ['fields' => self::IG_FIELDS]);
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
            $rows = $this->graph->paginate($brandId, $igId.'/media', [
                'fields' => self::IG_MEDIA_FIELDS,
                'limit' => min($limit, 50),
            ], 2);

            foreach (array_slice($rows, 0, $limit) as $row) {
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
}
