<?php

namespace App\Services\Meta;

use App\Models\Ad;
use App\Models\AdSet;
use App\Models\SystemSetting;

/**
 * Crée une publicité (créatif + annonce) sur Meta depuis le CRM.
 *
 * L'annonce est toujours créée EN PAUSE : elle est relue dans Ads Manager
 * avant diffusion, rien ne peut dépenser par accident depuis le CRM.
 */
class MetaAdPublisher
{
    /** Appels à l'action acceptés par Meta pour une publicité avec lien. */
    public const CALL_TO_ACTIONS = [
        'SHOP_NOW', 'LEARN_MORE', 'SIGN_UP', 'BOOK_TRAVEL', 'CONTACT_US',
        'ORDER_NOW', 'WHATSAPP_MESSAGE', 'MESSAGE_PAGE', 'CALL_NOW', 'GET_OFFER',
    ];

    public function __construct(private readonly MetaGraphClient $graph) {}

    /**
     * @param  array{name: string, message: string, title?: string|null, link?: string|null, call_to_action?: string|null, image_url?: string|null, image_base64?: string|null, image_name?: string|null}  $data
     */
    public function publish(int $brandId, AdSet $adSet, array $data): Ad
    {
        $adSet->loadMissing('campaign.adAccount');

        $externalAdSetId = trim((string) $adSet->external_ad_set_id);
        if ($externalAdSetId === '') {
            throw new MetaApiException('Cet ensemble de publicités n’existe pas sur Meta. Importez d’abord la structure depuis Meta.');
        }

        $account = $adSet->campaign?->adAccount;
        if (! $account || $account->platform !== 'meta' || ! $account->external_account_id) {
            throw new MetaApiException('Aucun compte publicitaire Meta rattaché à cette campagne.');
        }

        $pageId = trim((string) SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', 'meta_page_id')
            ->value('setting_value'));

        if ($pageId === '') {
            throw new MetaApiException('Page Facebook non configurée. Allez dans Paramètres → Meta et lancez « Détecter Page / Instagram / Pixel ».');
        }

        $actId = 'act_'.str_replace('act_', '', (string) $account->external_account_id);

        $linkData = [
            'message' => (string) ($data['message'] ?? ''),
            'link' => (string) ($data['link'] ?? ($adSet->campaign?->landing_url ?: 'https://facebook.com/'.$pageId)),
        ];

        if (! empty($data['title'])) {
            $linkData['name'] = (string) $data['title'];
        }

        $cta = strtoupper((string) ($data['call_to_action'] ?? ''));
        if ($cta !== '' && in_array($cta, self::CALL_TO_ACTIONS, true)) {
            $linkData['call_to_action'] = [
                'type' => $cta,
                'value' => ['link' => $linkData['link']],
            ];
        }

        $imageHash = $this->uploadImage($brandId, $actId, $data);
        if ($imageHash !== null) {
            $linkData['image_hash'] = $imageHash;
        } elseif (! empty($data['image_url'])) {
            $linkData['picture'] = (string) $data['image_url'];
        }

        try {
            $creative = $this->graph->post($brandId, $actId.'/adcreatives', [
                'name' => (string) $data['name'].' — créatif',
                'object_story_spec' => json_encode([
                    'page_id' => $pageId,
                    'link_data' => $linkData,
                ]),
            ]);
        } catch (MetaApiException $e) {
            // Meta deguise un compte bloque en erreur de permission : on lit
            // son etat pour ne pas envoyer l'utilisateur chercher un droit
            // manquant qui n'existe pas.
            throw new MetaApiException($this->explainCreativeRefusal($brandId, $actId, $pageId, $e));
        }

        $creativeId = (string) ($creative['id'] ?? '');
        if ($creativeId === '') {
            throw new MetaApiException('Meta n’a pas renvoyé d’identifiant de créatif.');
        }

        $created = $this->graph->post($brandId, $actId.'/ads', [
            'name' => (string) $data['name'],
            'adset_id' => $externalAdSetId,
            'creative' => json_encode(['creative_id' => $creativeId]),
            'status' => 'PAUSED',
        ]);

        $adId = (string) ($created['id'] ?? '');
        if ($adId === '') {
            throw new MetaApiException('Meta n’a pas renvoyé d’identifiant de publicité.');
        }

        return Ad::query()->updateOrCreate(
            ['ad_set_id' => $adSet->id, 'external_ad_id' => $adId],
            [
                'brand_id' => $brandId,
                'campaign_id' => $adSet->campaign_id,
                'name' => (string) $data['name'],
                'status' => 'PAUSED',
                'effective_status' => 'PAUSED',
                'creative_name' => (string) $data['name'].' — créatif',
                'creative_title' => $data['title'] ?? null,
                'creative_body' => $data['message'] ?? null,
                'creative_thumbnail_url' => $data['image_url'] ?? null,
                'creative_call_to_action' => $cta !== '' ? $cta : null,
                'last_synced_at' => now(),
            ]
        );
    }

    /**
     * Envoie l'image dans la bibliothèque du compte et renvoie son hash.
     *
     * @param  array<string, mixed>  $data
     */
    /** Etats Meta d'un compte publicitaire qui interdisent toute creation. */
    private const BLOCKING_ACCOUNT_STATUS = [
        2 => 'désactivé par Meta',
        3 => 'impayé (solde à régler)',
        7 => 'en revue de risque',
        8 => 'en attente de règlement',
        9 => 'en période de grâce après impayé',
        100 => 'en cours de fermeture',
        101 => 'fermé',
    ];

    /**
     * Pourquoi Meta a refuse le creatif. Le message brut parle de permissions
     * meme quand le compte est simplement bloque pour impaye.
     */
    private function explainCreativeRefusal(int $brandId, string $actId, string $pageId, MetaApiException $e): string
    {
        try {
            $account = $this->graph->get($brandId, $actId, ['fields' => 'account_status']);
            $status = (int) ($account['account_status'] ?? 0);
        } catch (MetaApiException) {
            $status = 0;
        }

        if (isset(self::BLOCKING_ACCOUNT_STATUS[$status])) {
            $label = self::BLOCKING_ACCOUNT_STATUS[$status];

            return "Le compte publicitaire {$actId} est {$label} : Meta y refuse toute création"
                .' (campagne, ensemble, publicité) tant que la situation n’est pas réglée.'
                .' Allez dans business.facebook.com → Paiements pour ce compte.'
                .' Vos autorisations ne sont pas en cause.';
        }

        return $e->getMessage()
            ." (Créatif refusé pour la Page {$pageId} sur le compte {$actId}.)"
            .' Vérifiez dans business.facebook.com que cette Page et ce compte publicitaire'
            .' appartiennent au même Business Manager, et que votre compte a un rôle sur la Page.';
    }

    private function uploadImage(int $brandId, string $actId, array $data): ?string
    {
        $base64 = (string) ($data['image_base64'] ?? '');
        if ($base64 === '') {
            return null;
        }

        // Une data-URL du navigateur : on ne garde que la charge utile.
        if (str_contains($base64, ',')) {
            $base64 = substr($base64, strpos($base64, ',') + 1);
        }

        $response = $this->graph->post($brandId, $actId.'/adimages', [
            'bytes' => $base64,
        ]);

        $images = $response['images'] ?? [];
        if (! is_array($images)) {
            return null;
        }

        foreach ($images as $image) {
            if (is_array($image) && ! empty($image['hash'])) {
                return (string) $image['hash'];
            }
        }

        return null;
    }
}
