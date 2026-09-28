<?php

namespace App\Services\Meta;

use App\Models\Ad;
use App\Models\AdAccount;
use App\Models\AdMetric;
use App\Models\AdSet;
use App\Models\AdSetMetric;
use App\Models\Campaign;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\DB;

/**
 * Importe la structure Ads Manager sous chaque campagne : ensembles de
 * publicités, publicités (créatifs) et leurs métriques quotidiennes.
 */
class MetaAdStructureSyncService
{
    private const AD_SET_FIELDS = 'id,name,status,effective_status,campaign_id,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,start_time,end_time,targeting';

    private const AD_FIELDS = 'id,name,status,effective_status,adset_id,campaign_id,creative{id,name,title,body,thumbnail_url,effective_object_story_id,object_story_spec}';

    private const INSIGHT_FIELDS = 'spend,impressions,clicks,reach,actions,ctr,frequency,cpc,cpm,date_start,date_stop';

    public function __construct(private readonly MetaGraphClient $graph) {}

    /**
     * @return array{ad_sets: int, ads: int, ad_set_metrics: int, ad_metrics: int}
     */
    public function sync(int $brandId, AdAccount $adAccount, ?string $from = null, ?string $to = null): array
    {
        if ($adAccount->platform !== 'meta') {
            throw new MetaApiException('Ce compte n’est pas une plateforme Meta.');
        }

        $actId = $this->actPathId($adAccount->external_account_id);

        $campaignsByExternal = Campaign::query()
            ->where('brand_id', $brandId)
            ->where('ad_account_id', $adAccount->id)
            ->whereNotNull('external_campaign_id')
            ->pluck('id', 'external_campaign_id');

        if ($campaignsByExternal->isEmpty()) {
            throw new MetaApiException('Aucune campagne Meta importée : lancez d’abord la synchronisation des campagnes.');
        }

        $adSets = $this->syncAdSets($brandId, $actId, $campaignsByExternal);
        $ads = $this->syncAds($brandId, $actId, $campaignsByExternal, $adSets);

        $period = ($from && $to)
            ? ['time_range' => json_encode(['since' => $from, 'until' => $to])]
            : ['date_preset' => 'maximum'];

        $adSetMetrics = $this->syncInsights($brandId, $actId, $period, 'adset', 'adset_id', $adSets, AdSetMetric::class, 'ad_set_id');
        $adMetrics = $this->syncInsights($brandId, $actId, $period, 'ad', 'ad_id', $ads, AdMetric::class, 'ad_id');

        return [
            'ad_sets' => count($adSets),
            'ads' => count($ads),
            'ad_set_metrics' => $adSetMetrics,
            'ad_metrics' => $adMetrics,
        ];
    }

    /**
     * @param  \Illuminate\Support\Collection<string, int>  $campaignsByExternal
     * @return array<string, int>  external ad set id => local id
     */
    private function syncAdSets(int $brandId, string $actId, $campaignsByExternal): array
    {
        $rows = $this->graph->paginate($brandId, $actId.'/adsets', [
            'fields' => self::AD_SET_FIELDS,
            'limit' => 200,
        ]);

        $map = [];

        foreach ($rows as $row) {
            $externalId = (string) ($row['id'] ?? '');
            $campaignId = $campaignsByExternal[(string) ($row['campaign_id'] ?? '')] ?? null;
            if ($externalId === '' || ! $campaignId) {
                continue;
            }

            $adSet = AdSet::query()->updateOrCreate(
                ['campaign_id' => $campaignId, 'external_ad_set_id' => $externalId],
                [
                    'brand_id' => $brandId,
                    'name' => (string) ($row['name'] ?? $externalId),
                    'status' => $row['status'] ?? null,
                    'effective_status' => $row['effective_status'] ?? null,
                    'optimization_goal' => $row['optimization_goal'] ?? null,
                    'billing_event' => $row['billing_event'] ?? null,
                    'bid_strategy' => $row['bid_strategy'] ?? null,
                    'daily_budget' => $this->minorToMajor($row['daily_budget'] ?? null),
                    'lifetime_budget' => $this->minorToMajor($row['lifetime_budget'] ?? null),
                    'start_time' => $row['start_time'] ?? null,
                    'stop_time' => $row['end_time'] ?? null,
                    'targeting_summary' => $this->summarizeTargeting($row['targeting'] ?? null),
                    'last_synced_at' => now(),
                ]
            );

            $map[$externalId] = $adSet->id;
        }

        return $map;
    }

    /**
     * @param  \Illuminate\Support\Collection<string, int>  $campaignsByExternal
     * @param  array<string, int>  $adSets
     * @return array<string, int>  external ad id => local id
     */
    private function syncAds(int $brandId, string $actId, $campaignsByExternal, array $adSets): array
    {
        $rows = $this->graph->paginate($brandId, $actId.'/ads', [
            'fields' => self::AD_FIELDS,
            'limit' => 200,
        ]);

        $map = [];

        foreach ($rows as $row) {
            $externalId = (string) ($row['id'] ?? '');
            $adSetId = $adSets[(string) ($row['adset_id'] ?? '')] ?? null;
            $campaignId = $campaignsByExternal[(string) ($row['campaign_id'] ?? '')] ?? null;
            if ($externalId === '' || ! $adSetId || ! $campaignId) {
                continue;
            }

            $creative = is_array($row['creative'] ?? null) ? $row['creative'] : [];
            $storyId = (string) ($creative['effective_object_story_id'] ?? '');

            $ad = Ad::query()->updateOrCreate(
                ['ad_set_id' => $adSetId, 'external_ad_id' => $externalId],
                [
                    'brand_id' => $brandId,
                    'campaign_id' => $campaignId,
                    'name' => (string) ($row['name'] ?? $externalId),
                    'status' => $row['status'] ?? null,
                    'effective_status' => $row['effective_status'] ?? null,
                    'creative_name' => $creative['name'] ?? null,
                    'creative_title' => $creative['title'] ?? null,
                    'creative_body' => $creative['body'] ?? null,
                    'creative_thumbnail_url' => $creative['thumbnail_url'] ?? null,
                    'creative_permalink' => $storyId !== '' ? 'https://www.facebook.com/'.$storyId : null,
                    'creative_call_to_action' => $this->callToAction($creative),
                    'last_synced_at' => now(),
                ]
            );

            $map[$externalId] = $ad->id;
        }

        return $map;
    }

    /**
     * @param  array<string, mixed>  $period
     * @param  array<string, int>  $entities  external id => local id
     * @param  class-string  $metricModel
     */
    private function syncInsights(
        int $brandId,
        string $actId,
        array $period,
        string $level,
        string $idField,
        array $entities,
        string $metricModel,
        string $foreignKey
    ): int {
        if ($entities === []) {
            return 0;
        }

        $rows = $this->graph->paginate($brandId, $actId.'/insights', array_merge([
            'level' => $level,
            'fields' => $idField.','.self::INSIGHT_FIELDS,
            'time_increment' => 1,
            'limit' => 500,
        ], $period), 100);

        $leadTypes = $this->leadActionTypes($brandId);
        $upserted = 0;

        DB::transaction(function () use ($rows, $entities, $idField, $metricModel, $foreignKey, $leadTypes, &$upserted) {
            foreach ($rows as $row) {
                $localId = $entities[(string) ($row[$idField] ?? '')] ?? null;
                $date = (string) ($row['date_start'] ?? $row['date_stop'] ?? '');
                if (! $localId || $date === '') {
                    continue;
                }

                $spend = (float) ($row['spend'] ?? 0);
                $impressions = (int) ($row['impressions'] ?? 0);
                $clicks = (int) ($row['clicks'] ?? 0);
                $leads = $this->countAction($row['actions'] ?? [], $leadTypes);

                $metricModel::query()->updateOrCreate(
                    [$foreignKey => $localId, 'metric_date' => $date],
                    [
                        'spend' => $spend,
                        'impressions' => $impressions,
                        'clicks' => $clicks,
                        'reach' => (int) ($row['reach'] ?? 0),
                        'leads' => $leads,
                        'messages' => $this->countAction($row['actions'] ?? [], [
                            'onsite_conversion.messaging_conversation_started_7d',
                            'onsite_conversion.messaging_first_reply',
                        ]),
                        'ctr' => isset($row['ctr']) ? (float) $row['ctr'] : null,
                        'frequency' => isset($row['frequency']) ? (float) $row['frequency'] : null,
                        'cpc' => isset($row['cpc']) ? (float) $row['cpc'] : ($clicks > 0 ? round($spend / $clicks, 4) : null),
                        'cpm' => isset($row['cpm']) ? (float) $row['cpm'] : ($impressions > 0 ? round($spend / $impressions * 1000, 4) : null),
                        'cpl' => $leads > 0 ? round($spend / $leads, 4) : null,
                    ]
                );

                $upserted++;
            }
        });

        return $upserted;
    }

    /** Résumé lisible du ciblage : « Maroc · 18-45 ans · Femmes ». */
    private function summarizeTargeting(mixed $targeting): ?string
    {
        if (! is_array($targeting)) {
            return null;
        }

        $parts = [];

        $geo = $targeting['geo_locations'] ?? [];
        if (is_array($geo)) {
            $places = [];
            foreach ((array) ($geo['countries'] ?? []) as $country) {
                $places[] = (string) $country;
            }
            foreach ((array) ($geo['cities'] ?? []) as $city) {
                if (is_array($city) && ! empty($city['name'])) {
                    $places[] = (string) $city['name'];
                }
            }
            if ($places !== []) {
                $parts[] = implode(', ', array_slice($places, 0, 5));
            }
        }

        $ageMin = $targeting['age_min'] ?? null;
        $ageMax = $targeting['age_max'] ?? null;
        if ($ageMin || $ageMax) {
            $parts[] = trim(($ageMin ?? '?').'-'.($ageMax ?? '?').' ans');
        }

        $genders = (array) ($targeting['genders'] ?? []);
        if ($genders !== []) {
            $parts[] = in_array(1, array_map('intval', $genders), true) ? 'Hommes' : 'Femmes';
        }

        return $parts !== [] ? implode(' · ', $parts) : null;
    }

    /** @param  array<string, mixed>  $creative */
    private function callToAction(array $creative): ?string
    {
        $spec = $creative['object_story_spec'] ?? null;
        if (! is_array($spec)) {
            return null;
        }

        foreach (['link_data', 'video_data', 'photo_data'] as $key) {
            $data = $spec[$key] ?? null;
            if (is_array($data) && is_array($data['call_to_action'] ?? null)) {
                $type = (string) ($data['call_to_action']['type'] ?? '');
                if ($type !== '') {
                    return $type;
                }
            }
        }

        return null;
    }

    /** @return list<string> */
    private function leadActionTypes(int $brandId): array
    {
        $configured = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->where('setting_key', 'meta_lead_action_types')
            ->value('setting_value');

        $types = array_values(array_filter(array_map('trim', explode(',', (string) $configured))));

        return $types !== [] ? $types : [
            'lead',
            'onsite_conversion.lead_grouped',
            'offsite_conversion.fb_pixel_lead',
        ];
    }

    /** @param  array<int, mixed>  $actions */
    private function countAction(array $actions, array $types): int
    {
        $sum = 0;
        foreach ($actions as $action) {
            if (is_array($action) && in_array((string) ($action['action_type'] ?? ''), $types, true)) {
                $sum += (int) ($action['value'] ?? 0);
            }
        }

        return $sum;
    }

    private function minorToMajor(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return round(((float) $value) / 100, 2);
    }

    private function actPathId(?string $externalAccountId): string
    {
        $id = str_replace('act_', '', trim((string) $externalAccountId));
        if ($id === '') {
            throw new MetaApiException('ID compte publicitaire Meta manquant.');
        }

        return 'act_'.$id;
    }
}
