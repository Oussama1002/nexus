<?php

namespace App\Services\Meta;

use App\Models\Campaign;

/**
 * Crée sur Meta (Marketing API) une campagne saisie dans le CRM.
 *
 * La campagne est toujours créée EN PAUSE : les audiences, le budget quotidien
 * de l'ad set et les visuels se règlent ensuite dans Ads Manager avant
 * activation. Rien ne peut donc dépenser par accident depuis le CRM.
 */
class MetaCampaignPublisher
{
    /** Objectif CRM → objectif Meta (API v21 « Outcome-Driven Ad Experiences »). */
    private const OBJECTIVES = [
        'lead_gen' => 'OUTCOME_LEADS',
        'messages' => 'OUTCOME_ENGAGEMENT',
        'conversions' => 'OUTCOME_SALES',
        'sales' => 'OUTCOME_SALES',
        'traffic' => 'OUTCOME_TRAFFIC',
        'engagement' => 'OUTCOME_ENGAGEMENT',
        'awareness' => 'OUTCOME_AWARENESS',
    ];

    public function __construct(
        private readonly MetaGraphClient $graph,
    ) {}

    /** @return array{id: string, objective: string} */
    public function publish(int $brandId, Campaign $campaign): array
    {
        if ($campaign->external_campaign_id) {
            throw new MetaApiException('Cette campagne existe déjà sur Meta (id '.$campaign->external_campaign_id.').');
        }

        $campaign->loadMissing('adAccount');
        $account = $campaign->adAccount;
        if (! $account || $account->platform !== 'meta' || ! $account->external_account_id) {
            throw new MetaApiException('Choisissez d’abord un compte publicitaire Meta pour cette campagne.');
        }

        $objective = self::OBJECTIVES[(string) $campaign->marketing_objective] ?? null;
        if (! $objective) {
            throw new MetaApiException('Renseignez un objectif marketing reconnu par Meta (lead generation, messages, conversions, trafic, engagement, notoriété, ventes).');
        }

        $actId = 'act_'.str_replace('act_', '', (string) $account->external_account_id);

        $payload = [
            'name' => (string) $campaign->name,
            'objective' => $objective,
            'status' => 'PAUSED',
            'special_ad_categories' => json_encode([]),
        ];

        // Budget quotidien au niveau campagne (CBO), en centimes.
        if ($campaign->daily_budget && (float) $campaign->daily_budget > 0) {
            $payload['daily_budget'] = (int) round((float) $campaign->daily_budget * 100);
        } elseif ($campaign->budget && (float) $campaign->budget > 0) {
            $payload['lifetime_budget'] = (int) round((float) $campaign->budget * 100);
            $payload['bid_strategy'] = 'LOWEST_COST_WITHOUT_CAP';
            if ($campaign->end_date) {
                $payload['stop_time'] = $campaign->end_date->toIso8601String();
            }
        }

        $created = $this->graph->post($brandId, $actId.'/campaigns', $payload);
        $id = (string) ($created['id'] ?? '');
        if ($id === '') {
            throw new MetaApiException('Meta n’a pas renvoyé d’identifiant de campagne.');
        }

        $campaign->forceFill([
            'external_campaign_id' => $id,
            'status' => 'paused',
        ])->save();

        return ['id' => $id, 'objective' => $objective];
    }
}
