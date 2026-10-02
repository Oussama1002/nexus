<?php

namespace App\Services\Meta;

use App\Models\SocialAccount;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Publication et modération sur une Page Facebook ou un compte Instagram,
 * depuis le CRM.
 *
 * Facebook passe par le jeton de la Page ; Instagram par le jeton de sa
 * connexion directe (graph.instagram.com).
 */
class SocialPagePublisher
{
    private const FB_BASE = 'https://graph.facebook.com/v21.0';

    private const IG_BASE = 'https://graph.instagram.com/v23.0';

    public function __construct(
        private readonly MetaGraphClient $graph,
        private readonly InstagramGraphService $instagram,
    ) {}

    /**
     * Publie un message (et une image facultative) sur le compte.
     *
     * @return array{id: string, permalink: string|null}
     */
    public function publish(SocialAccount $account, string $message, ?string $imageUrl = null, ?string $link = null): array
    {
        return $account->platform === 'instagram'
            ? $this->publishInstagram($account, $message, $imageUrl)
            : $this->publishFacebook($account, $message, $imageUrl, $link);
    }

    /**
     * @return array{id: string, permalink: string|null}
     */
    private function publishFacebook(SocialAccount $account, string $message, ?string $imageUrl, ?string $link): array
    {
        $pageId = trim((string) $account->credential_ref);
        $token = $this->pageToken((int) $account->brand_id, $pageId);

        if ($token === null) {
            throw new MetaApiException('Jeton de Page introuvable. Reconnectez Meta en sélectionnant cette Page.');
        }

        if ($imageUrl) {
            $response = Http::timeout(60)->asForm()->post(self::FB_BASE.'/'.$pageId.'/photos', [
                'url' => $imageUrl,
                'caption' => $message,
                'access_token' => $token,
            ]);
        } else {
            $payload = ['message' => $message, 'access_token' => $token];
            if ($link) {
                $payload['link'] = $link;
            }
            $response = Http::timeout(60)->asForm()->post(self::FB_BASE.'/'.$pageId.'/feed', $payload);
        }

        $data = $this->decode($response, 'Publication Facebook refusée.');
        $postId = (string) ($data['post_id'] ?? $data['id'] ?? '');

        if ($postId === '') {
            throw new MetaApiException('Facebook n’a pas renvoyé d’identifiant de publication.');
        }

        Log::info('social.published', ['platform' => 'facebook', 'account_id' => $account->id, 'post_id' => $postId]);

        return ['id' => $postId, 'permalink' => 'https://www.facebook.com/'.$postId];
    }

    /**
     * Instagram publie en deux temps : conteneur puis publication.
     *
     * @return array{id: string, permalink: string|null}
     */
    private function publishInstagram(SocialAccount $account, string $message, ?string $imageUrl): array
    {
        $brandId = (int) $account->brand_id;
        $token = $this->instagram->tokenFor($brandId);

        if ($token === null) {
            throw new MetaApiException('Instagram non connecté. Allez dans Paramètres → Meta et cliquez « Connecter Instagram ».');
        }

        if (! $imageUrl) {
            throw new MetaApiException('Instagram exige une image ou une vidéo : ajoutez un visuel au contenu.');
        }

        $container = Http::timeout(60)->asForm()->post(self::IG_BASE.'/me/media', [
            'image_url' => $imageUrl,
            'caption' => $message,
            'access_token' => $token,
        ]);

        $creationId = (string) ($this->decode($container, 'Instagram a refusé le visuel.')['id'] ?? '');
        if ($creationId === '') {
            throw new MetaApiException('Instagram n’a pas renvoyé de conteneur de publication.');
        }

        $published = Http::timeout(60)->asForm()->post(self::IG_BASE.'/me/media_publish', [
            'creation_id' => $creationId,
            'access_token' => $token,
        ]);

        $mediaId = (string) ($this->decode($published, 'Publication Instagram refusée.')['id'] ?? '');
        if ($mediaId === '') {
            throw new MetaApiException('Instagram n’a pas renvoyé d’identifiant de publication.');
        }

        $permalink = null;
        try {
            $node = Http::timeout(20)->get(self::IG_BASE.'/'.$mediaId, [
                'fields' => 'permalink',
                'access_token' => $token,
            ]);
            $permalink = $node->successful() ? $node->json('permalink') : null;
        } catch (\Throwable) {
            // Le lien n'est pas indispensable.
        }

        Log::info('social.published', ['platform' => 'instagram', 'account_id' => $account->id, 'media_id' => $mediaId]);

        return ['id' => $mediaId, 'permalink' => $permalink];
    }

    /**
     * Commentaires d'une publication.
     *
     * @return list<array<string, mixed>>
     */
    /**
     * Retire une publication de la Page. Instagram ne l'autorise pas par
     * l'API : seul Facebook peut etre nettoye depuis le CRM.
     */
    public function deletePost(SocialAccount $account, string $postId): void
    {
        if ($account->platform === 'instagram') {
            throw new MetaApiException(
                'Instagram ne permet pas de supprimer une publication par l’API. '
                .'Retirez-la depuis l’application Instagram.'
            );
        }

        $pageId = trim((string) $account->credential_ref);
        $token = $this->pageToken((int) $account->brand_id, $pageId);

        if ($token === null) {
            throw new MetaApiException('Jeton de Page introuvable. Reconnectez Meta en sélectionnant cette Page.');
        }

        $response = Http::timeout(30)->delete(self::FB_BASE.'/'.$postId, ['access_token' => $token]);

        if (! $response->successful()) {
            $err = (array) ($response->json('error') ?? []);
            throw new MetaApiException(MetaErrorTranslator::toFrench(
                (string) ($err['message'] ?? $response->body()),
                is_int($err['code'] ?? null) ? $err['code'] : null
            ));
        }
    }

    public function comments(SocialAccount $account, string $postId, int $limit = 50): array
    {
        if ($account->platform === 'instagram') {
            $token = $this->instagram->tokenFor((int) $account->brand_id);
            if ($token === null) {
                throw new MetaApiException('Instagram non connecté.');
            }

            $response = Http::timeout(30)->get(self::IG_BASE.'/'.$postId.'/comments', [
                'fields' => 'id,text,username,timestamp,like_count,hidden',
                'limit' => $limit,
                'access_token' => $token,
            ]);

            return $this->normalizeComments($this->decode($response, 'Lecture des commentaires refusée.')['data'] ?? [], 'instagram');
        }

        $token = $this->pageToken((int) $account->brand_id, (string) $account->credential_ref);
        if ($token === null) {
            throw new MetaApiException('Jeton de Page introuvable.');
        }

        $response = Http::timeout(30)->get(self::FB_BASE.'/'.$postId.'/comments', [
            'fields' => 'id,message,created_time,like_count,is_hidden,from{name}',
            'limit' => $limit,
            'access_token' => $token,
        ]);

        return $this->normalizeComments($this->decode($response, 'Lecture des commentaires refusée.')['data'] ?? [], 'facebook');
    }

    /** Répond à un commentaire. */
    public function reply(SocialAccount $account, string $commentId, string $message): string
    {
        $token = $this->tokenFor($account);
        $base = $account->platform === 'instagram' ? self::IG_BASE : self::FB_BASE;

        $response = Http::timeout(30)->asForm()->post($base.'/'.$commentId.'/replies', [
            'message' => $message,
            'access_token' => $token,
        ]);

        // Facebook accepte aussi /comments sur un commentaire.
        if (! $response->successful() && $account->platform !== 'instagram') {
            $response = Http::timeout(30)->asForm()->post($base.'/'.$commentId.'/comments', [
                'message' => $message,
                'access_token' => $token,
            ]);
        }

        return (string) ($this->decode($response, 'Réponse refusée.')['id'] ?? '');
    }

    /** Masque ou réaffiche un commentaire. */
    public function setHidden(SocialAccount $account, string $commentId, bool $hidden): void
    {
        $token = $this->tokenFor($account);
        $base = $account->platform === 'instagram' ? self::IG_BASE : self::FB_BASE;

        $response = Http::timeout(30)->asForm()->post($base.'/'.$commentId, [
            'hide' => $hidden ? 'true' : 'false',
            'access_token' => $token,
        ]);

        $this->decode($response, $hidden ? 'Masquage refusé.' : 'Réaffichage refusé.');
    }

    /** Supprime un commentaire. */
    public function deleteComment(SocialAccount $account, string $commentId): void
    {
        $token = $this->tokenFor($account);
        $base = $account->platform === 'instagram' ? self::IG_BASE : self::FB_BASE;

        $response = Http::timeout(30)->delete($base.'/'.$commentId, ['access_token' => $token]);

        $this->decode($response, 'Suppression refusée.');
    }

    private function tokenFor(SocialAccount $account): string
    {
        if ($account->platform === 'instagram') {
            $token = $this->instagram->tokenFor((int) $account->brand_id);
            if ($token === null) {
                throw new MetaApiException('Instagram non connecté.');
            }

            return $token;
        }

        $token = $this->pageToken((int) $account->brand_id, (string) $account->credential_ref);
        if ($token === null) {
            throw new MetaApiException('Jeton de Page introuvable.');
        }

        return $token;
    }

    /**
     * @param  array<int, mixed>  $rows
     * @return list<array<string, mixed>>
     */
    private function normalizeComments(array $rows, string $platform): array
    {
        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }

            $out[] = [
                'id' => (string) ($row['id'] ?? ''),
                'author' => $platform === 'instagram'
                    ? (string) ($row['username'] ?? '')
                    : (string) ($row['from']['name'] ?? ''),
                'message' => (string) ($row['text'] ?? $row['message'] ?? ''),
                'created_at' => $row['timestamp'] ?? $row['created_time'] ?? null,
                'likes' => (int) ($row['like_count'] ?? 0),
                'hidden' => (bool) ($row['hidden'] ?? $row['is_hidden'] ?? false),
            ];
        }

        return $out;
    }

    /** Jeton de la Page, lu sur son nœud puis dans la liste des Pages. */
    private function pageToken(int $brandId, string $pageId): ?string
    {
        if ($pageId === '') {
            return null;
        }

        try {
            $node = $this->graph->get($brandId, $pageId, ['fields' => 'access_token']);
            $token = trim((string) ($node['access_token'] ?? ''));
            if ($token !== '') {
                return $token;
            }
        } catch (MetaApiException) {
            // On tente la liste ci-dessous.
        }

        try {
            $pages = $this->graph->paginate($brandId, 'me/accounts', ['fields' => 'id,access_token', 'limit' => 100], 3);
        } catch (MetaApiException) {
            return null;
        }

        foreach ($pages as $page) {
            if ((string) ($page['id'] ?? '') === $pageId && ! empty($page['access_token'])) {
                return (string) $page['access_token'];
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    private function decode(\Illuminate\Http\Client\Response $response, string $fallback): array
    {
        if (! $response->successful()) {
            $error = $response->json('error') ?? [];
            $message = is_array($error) ? (string) ($error['error_user_msg'] ?? $error['message'] ?? $fallback) : $fallback;
            $code = is_array($error) ? ($error['code'] ?? null) : null;

            Log::warning('social.api_error', ['message' => $message, 'body' => mb_substr($response->body(), 0, 500)]);

            throw new MetaApiException(
                MetaErrorTranslator::toFrench($message, is_int($code) ? $code : null),
                is_int($code) ? $code : null
            );
        }

        $data = $response->json();

        return is_array($data) ? $data : [];
    }

    /** Compte social par défaut d'une plateforme, pour publier sans choix explicite. */
    public function defaultAccount(int $brandId, string $platform): ?SocialAccount
    {
        return SocialAccount::query()
            ->where('brand_id', $brandId)
            ->where('platform', $platform)
            ->where('status', 'active')
            ->orderByDesc('api_connected')
            ->first();
    }

    /** Valeur brute d'un réglage, utilisée par les appelants. */
    public function setting(int $brandId, string $key): string
    {
        return trim((string) SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', $key)
            ->value('setting_value'));
    }
}
