<?php

namespace App\Services\Meta;

use App\Models\AdAccount;
use App\Models\Campaign;
use App\Models\CampaignMetric;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class MetaAdsSyncService
{
    private const AD_ACCOUNT_FIELDS = 'id,account_id,name,currency,timezone_name,account_status,business{id,name}';

    private const CAMPAIGN_FIELDS = 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time';

    private const INSIGHT_FIELDS = 'campaign_id,spend,impressions,clicks,reach,actions,cpc,cpm,date_start,date_stop';

    public function __construct(
        private readonly MetaAdsConfig $config,
        private readonly MetaGraphClient $graph,
    ) {}

    /** @return array{success: bool, message: string, business?: array{id: string, name: string}} */
    public function testConnection(int $brandId): array
    {
        if (! $this->config->isComplete($brandId)) {
            return ['success' => false, 'message' => 'Configuration Meta incomplète (App ID, Business ID, Access Token).'];
        }

        $cfg = $this->config->forBrand($brandId);
        $biz = $this->graph->get($brandId, $cfg['business_id'], ['fields' => 'id,name']);

        return [
            'success' => true,
            'message' => sprintf('Connexion Meta OK — Business « %s ».', (string) ($biz['name'] ?? $cfg['business_id'])),
            'business' => [
                'id' => (string) ($biz['id'] ?? $cfg['business_id']),
                'name' => (string) ($biz['name'] ?? ''),
            ],
        ];
    }

    /**
     * Fetch ad accounts visible to the connected Business Manager.
     *
     * Meta separates accounts the business OWNS (`owned_ad_accounts`) from
     * accounts a CLIENT has shared with the business (`client_ad_accounts`,
     * i.e. agency / partner access). We merge both so client accounts import
     * correctly even when you don't own them.
     *
     * @return list<array<string, mixed>>
     */
    public function fetchAdAccounts(int $brandId): array
    {
        $businessId = $this->config->forBrand($brandId)['business_id'];
        if ($businessId === '') {
            throw new MetaApiException('Meta Business ID manquant. Configurez-le dans Paramètres → Meta.');
        }

        $merged = [];
        $errors = [];

        foreach (['owned_ad_accounts', 'client_ad_accounts'] as $edge) {
            try {
                $rows = $this->graph->paginate($brandId, $businessId.'/'.$edge, [
                    'fields' => self::AD_ACCOUNT_FIELDS,
                    'limit' => 100,
                ]);
                foreach ($rows as $row) {
                    $key = $this->normalizeAdAccountId($row);
                    if ($key !== '') {
                        $merged[$key] = $row;
                    }
                }
            } catch (MetaApiException $e) {
                $errors[] = $e->getMessage();
            }
        }

        // Only surface an error if BOTH edges failed and nothing was collected.
        if ($merged === [] && $errors !== []) {
            throw new MetaApiException($errors[0]);
        }

        return array_values($merged);
    }

    /**
     * @return array{created: int, updated: int, total: int}
     */
    public function syncAdAccounts(int $brandId): array
    {
        $rows = $this->fetchAdAccounts($brandId);
        $created = 0;
        $updated = 0;
        $businessId = $this->config->forBrand($brandId)['business_id'];

        foreach ($rows as $row) {
            $externalId = $this->normalizeAdAccountId($row);
            if ($externalId === '') {
                continue;
            }

            $account = AdAccount::query()
                ->where('brand_id', $brandId)
                ->where('platform', 'meta')
                ->where('external_account_id', $externalId)
                ->first();

            $payload = [
                'brand_id' => $brandId,
                'platform' => 'meta',
                'account_name' => (string) ($row['name'] ?? $externalId),
                'external_account_id' => $externalId,
                'business_manager_id' => $businessId,
                'currency' => strtoupper((string) ($row['currency'] ?? 'MAD')) ?: 'MAD',
                'timezone' => $row['timezone_name'] ?? null,
                'api_connected' => true,
                'status' => $this->mapAdAccountStatus($row['account_status'] ?? null),
                'last_synced_at' => now(),
            ];

            if ($account) {
                $account->update($payload);
                $updated++;
            } else {
                AdAccount::query()->create($payload);
                $created++;
            }
        }

        return ['created' => $created, 'updated' => $updated, 'total' => count($rows)];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function fetchCampaigns(int $brandId, AdAccount $adAccount): array
    {
        $actId = $this->actPathId($adAccount->external_account_id);

        return $this->graph->paginate($brandId, $actId.'/campaigns', [
            'fields' => self::CAMPAIGN_FIELDS,
            'limit' => 100,
        ]);
    }

    /**
     * @return array{created: int, updated: int, total: int}
     */
    public function syncCampaigns(int $brandId, AdAccount $adAccount): array
    {
        if ($adAccount->platform !== 'meta') {
            throw new MetaApiException('Ce compte n’est pas une plateforme Meta.');
        }

        $rows = $this->fetchCampaigns($brandId, $adAccount);
        $created = 0;
        $updated = 0;

        foreach ($rows as $row) {
            $externalId = (string) ($row['id'] ?? '');
            if ($externalId === '') {
                continue;
            }

            $campaign = Campaign::query()
                ->where('brand_id', $brandId)
                ->where('ad_account_id', $adAccount->id)
                ->where('external_campaign_id', $externalId)
                ->first();

            $daily = $this->minorToMajor($row['daily_budget'] ?? null);
            $lifetime = $this->minorToMajor($row['lifetime_budget'] ?? null);
            $start = $this->parseMetaDate($row['start_time'] ?? null) ?? now()->toDateString();

            $payload = [
                'brand_id' => $brandId,
                'ad_account_id' => $adAccount->id,
                'name' => (string) ($row['name'] ?? $externalId),
                'source' => 'meta',
                'external_campaign_id' => $externalId,
                'marketing_objective' => $this->mapObjective($row['objective'] ?? null),
                'objective' => $row['objective'] ?? null,
                'budget' => $lifetime ?? $daily ?? 0,
                'daily_budget' => $daily,
                'campaign_currency' => $adAccount->currency,
                'status' => $this->mapCampaignStatus($row['status'] ?? null),
                'start_date' => $start,
                'end_date' => $this->parseMetaDate($row['stop_time'] ?? null),
                'last_synced_at' => now(),
            ];

            if ($campaign) {
                $campaign->update($payload);
                $updated++;
            } else {
                Campaign::query()->create($payload);
                $created++;
            }
        }

        $adAccount->update(['last_synced_at' => now(), 'api_connected' => true]);

        return ['created' => $created, 'updated' => $updated, 'total' => count($rows)];
    }

    /**
     * @return array{upserted: int, campaigns: int}
     */
    public function syncInsights(int $brandId, AdAccount $adAccount, string $from, string $to): array
    {
        if ($adAccount->platform !== 'meta') {
            throw new MetaApiException('Ce compte n’est pas une plateforme Meta.');
        }

        $actId = $this->actPathId($adAccount->external_account_id);
        $rows = $this->graph->paginate($brandId, $actId.'/insights', [
            'level' => 'campaign',
            'fields' => self::INSIGHT_FIELDS,
            'time_range' => json_encode(['since' => $from, 'until' => $to]),
            'time_increment' => 1,
            'limit' => 500,
        ], 50);

        $byExternal = Campaign::query()
            ->where('brand_id', $brandId)
            ->where('ad_account_id', $adAccount->id)
            ->whereNotNull('external_campaign_id')
            ->pluck('id', 'external_campaign_id');

        $upserted = 0;
        $touchedCampaigns = [];

        DB::transaction(function () use ($rows, $byExternal, &$upserted, &$touchedCampaigns) {
            foreach ($rows as $row) {
                $extId = (string) ($row['campaign_id'] ?? '');
                $campaignId = $byExternal[$extId] ?? null;
                if (! $campaignId) {
                    continue;
                }

                $date = (string) ($row['date_start'] ?? $row['date_stop'] ?? '');
                if ($date === '') {
                    continue;
                }

                $spend = (float) ($row['spend'] ?? 0);
                $impressions = (int) ($row['impressions'] ?? 0);
                $clicks = (int) ($row['clicks'] ?? 0);
                $reach = (int) ($row['reach'] ?? 0);
                $leads = $this->countAction($row['actions'] ?? [], ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']);
                $messages = $this->countAction($row['actions'] ?? [], ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply']);

                CampaignMetric::query()->updateOrCreate(
                    [
                        'campaign_id' => $campaignId,
                        'metric_date' => $date,
                    ],
                    [
                        'spend' => $spend,
                        'impressions' => $impressions,
                        'clicks' => $clicks,
                        'reach' => $reach,
                        'leads' => $leads,
                        'messages' => $messages,
                        'cpc' => isset($row['cpc']) ? (float) $row['cpc'] : ($clicks > 0 ? round($spend / $clicks, 4) : null),
                        'cpm' => isset($row['cpm']) ? (float) $row['cpm'] : ($impressions > 0 ? round($spend / $impressions * 1000, 4) : null),
                        'cpl' => $leads > 0 ? round($spend / $leads, 4) : null,
                    ]
                );

                $upserted++;
                $touchedCampaigns[$campaignId] = true;
            }
        });

        foreach (array_keys($touchedCampaigns) as $campaignId) {
            $totalSpend = CampaignMetric::query()->where('campaign_id', $campaignId)->sum('spend');
            Campaign::query()->where('id', $campaignId)->update(['spend' => $totalSpend]);
        }

        $adAccount->update(['last_synced_at' => now()]);

        return ['upserted' => $upserted, 'campaigns' => count($touchedCampaigns)];
    }

    /** @param  array<string, mixed>  $row */
    private function normalizeAdAccountId(array $row): string
    {
        $id = (string) ($row['account_id'] ?? $row['id'] ?? '');
        $id = str_replace('act_', '', $id);

        return $id;
    }

    private function actPathId(?string $externalAccountId): string
    {
        $id = str_replace('act_', '', trim((string) $externalAccountId));
        if ($id === '') {
            throw new MetaApiException('ID compte publicitaire Meta manquant.');
        }

        return 'act_'.$id;
    }

    private function mapAdAccountStatus(mixed $status): string
    {
        $code = is_numeric($status) ? (int) $status : null;
        if ($code === 1) {
            return 'active';
        }
        if ($code === 2) {
            return 'inactive';
        }

        return 'active';
    }

    private function mapCampaignStatus(?string $status): string
    {
        return match (strtoupper((string) $status)) {
            'ACTIVE' => 'active',
            'PAUSED' => 'paused',
            'DELETED', 'ARCHIVED' => 'ended',
            default => 'draft',
        };
    }

    private function mapObjective(?string $objective): ?string
    {
        return match (strtoupper((string) $objective)) {
            'OUTCOME_LEADS', 'LEAD_GENERATION' => 'lead_gen',
            'MESSAGES' => 'messages',
            'OUTCOME_SALES', 'CONVERSIONS' => 'conversions',
            'OUTCOME_TRAFFIC', 'LINK_CLICKS' => 'traffic',
            'POST_ENGAGEMENT', 'OUTCOME_ENGAGEMENT' => 'engagement',
            'OUTCOME_AWARENESS', 'BRAND_AWARENESS', 'REACH' => 'awareness',
            default => null,
        };
    }

    private function minorToMajor(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return round(((float) $value) / 100, 2);
    }

    private function parseMetaDate(mixed $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  list<mixed>  $actions
     * @param  list<string>  $types
     */
    private function countAction(array $actions, array $types): int
    {
        $sum = 0;
        foreach ($actions as $action) {
            if (! is_array($action)) {
                continue;
            }
            $type = (string) ($action['action_type'] ?? '');
            if (in_array($type, $types, true)) {
                $sum += (int) ($action['value'] ?? 0);
            }
        }

        return $sum;
    }
}
