<?php

namespace App\Services\Meta;

use App\Models\AdSet;
use App\Models\Campaign;

/**
 * Crée sur Meta un ensemble de publicités rattaché à une campagne du CRM.
 *
 * Comme la campagne et la publicité, il est toujours créé EN PAUSE : le
 * ciblage fin se règle dans Ads Manager, et rien ne peut dépenser par
 * accident depuis le CRM.
 */
class MetaAdSetPublisher
{
    /** Objectif de campagne Meta → optimisation et facturation par défaut. */
    private const OPTIMIZATION = [
        'OUTCOME_LEADS' => 'LEAD_GENERATION',
        'OUTCOME_SALES' => 'OFFSITE_CONVERSIONS',
        'OUTCOME_TRAFFIC' => 'LINK_CLICKS',
        'OUTCOME_ENGAGEMENT' => 'POST_ENGAGEMENT',
        'OUTCOME_AWARENESS' => 'REACH',
    ];

    public function __construct(private readonly MetaGraphClient $graph) {}

    /**
     * @param  array{name: string, daily_budget?: float|null, optimization_goal?: string|null, countries?: array<int, string>|null, age_min?: int|null, age_max?: int|null}  $data
     */
    public function publish(int $brandId, Campaign $campaign, array $data): AdSet
    {
        $campaign->loadMissing('adAccount');

        $externalCampaignId = trim((string) $campaign->external_campaign_id);
        if ($externalCampaignId === '') {
            throw new MetaApiException('Cette campagne n’existe pas encore sur Meta. Créez-la d’abord avec « Créer sur Meta ».');
        }

        $account = $campaign->adAccount;
        if (! $account || $account->platform !== 'meta' || ! $account->external_account_id) {
            throw new MetaApiException('Aucun compte publicitaire Meta rattaché à cette campagne.');
        }

        $remote = $this->graph->get($brandId, $externalCampaignId, [
            'fields' => 'objective,daily_budget,lifetime_budget',
        ]);
        $objective = (string) ($remote['objective'] ?? '');
        $goal = ($data['optimization_goal'] ?? null) ?: (self::OPTIMIZATION[$objective] ?? 'LINK_CLICKS');

        // Budget porte par la campagne (CBO) : l'ensemble n'a alors ni budget
        // ni strategie d'enchere propres, il herite de la campagne.
        $campaignBudget = (int) ($remote['daily_budget'] ?? 0) + (int) ($remote['lifetime_budget'] ?? 0);
        $campaignHoldsBudget = $campaignBudget > 0;

        $dailyBudget = (float) ($data['daily_budget'] ?? 0);
        if (! $campaignHoldsBudget && $dailyBudget <= 0) {
            throw new MetaApiException('Indiquez un budget quotidien supérieur à 0 pour cet ensemble.');
        }

        $countries = ($data['countries'] ?? null) ?: ['MA'];
        $targeting = [
            'geo_locations' => ['countries' => array_values($countries)],
            'age_min' => (int) ($data['age_min'] ?? 18),
            'age_max' => (int) ($data['age_max'] ?? 65),
        ];

        $actId = 'act_'.str_replace('act_', '', (string) $account->external_account_id);

        $payload = [
            'name' => (string) $data['name'],
            'campaign_id' => $externalCampaignId,
            'status' => 'PAUSED',
            'billing_event' => 'IMPRESSIONS',
            'optimization_goal' => $goal,
            'targeting' => json_encode($targeting),
        ];

        if (! $campaignHoldsBudget) {
            $payload['daily_budget'] = (int) round($dailyBudget * 100);
            // Sans strategie explicite, Meta reclame un bid_amount que le CRM
            // ne demande pas : le cout le plus bas n'en exige aucun.
            $payload['bid_strategy'] = 'LOWEST_COST_WITHOUT_CAP';
        }

        $created = $this->graph->post($brandId, $actId.'/adsets', $payload);

        $externalId = (string) ($created['id'] ?? '');
        if ($externalId === '') {
            throw new MetaApiException('Meta n’a pas renvoyé d’identifiant pour cet ensemble de publicités.');
        }

        return AdSet::query()->create([
            'brand_id' => $brandId,
            'campaign_id' => $campaign->id,
            'external_ad_set_id' => $externalId,
            'name' => (string) $data['name'],
            'status' => 'PAUSED',
            'effective_status' => 'PAUSED',
            'optimization_goal' => $goal,
            'billing_event' => 'IMPRESSIONS',
            'bid_strategy' => $campaignHoldsBudget ? null : 'LOWEST_COST_WITHOUT_CAP',
            'daily_budget' => $campaignHoldsBudget ? null : $dailyBudget,
            'targeting_summary' => implode(', ', $countries).' · '.$targeting['age_min'].'-'.$targeting['age_max'].' ans',
            'last_synced_at' => now(),
        ]);
    }
}
