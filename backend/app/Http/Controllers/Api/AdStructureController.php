<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ad;
use App\Models\AdAccount;
use App\Models\AdSet;
use App\Models\Campaign;
use App\Services\Meta\MetaAdStructureSyncService;
use App\Services\AuditLogger;
use App\Services\Meta\MetaApiException;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Vue Ads Manager : campagne → ensembles de publicités → publicités.
 */
class AdStructureController extends Controller
{
    public function adSets(Request $request, string $campaignId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $campaign = Campaign::query()->with('adAccount:id,currency')->where('brand_id', $brandId)->findOrFail($campaignId);

        $adSets = AdSet::query()
            ->where('campaign_id', $campaign->id)
            ->orderBy('name')
            ->get();

        $rollups = $this->rollups(
            'ad_set_metrics',
            'ad_set_id',
            $adSets->pluck('id')->all(),
            $request->query('metrics_from'),
            $request->query('metrics_to')
        );

        $adCounts = Ad::query()
            ->whereIn('ad_set_id', $adSets->pluck('id'))
            ->groupBy('ad_set_id')
            ->selectRaw('ad_set_id, COUNT(*) as total')
            ->pluck('total', 'ad_set_id');

        $adSets->each(function (AdSet $adSet) use ($rollups, $adCounts) {
            $adSet->setAttribute('metrics_rollups', $rollups[$adSet->id] ?? null);
            $adSet->setAttribute('ads_count', (int) ($adCounts[$adSet->id] ?? 0));
        });

        return ApiResponse::success([
            'campaign' => $campaign->only(['id', 'name', 'status', 'marketing_objective', 'external_campaign_id']),
            'currency' => $this->currencyFor($campaign),
            'ad_sets' => $adSets,
        ], 'Ensembles de publicités récupérés.');
    }

    public function ads(Request $request, string $adSetId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $adSet = AdSet::query()->where('brand_id', $brandId)->with(['campaign:id,name,campaign_currency,ad_account_id', 'campaign.adAccount:id,currency'])->findOrFail($adSetId);

        $ads = Ad::query()
            ->where('ad_set_id', $adSet->id)
            ->orderBy('name')
            ->get();

        $rollups = $this->rollups(
            'ad_metrics',
            'ad_id',
            $ads->pluck('id')->all(),
            $request->query('metrics_from'),
            $request->query('metrics_to')
        );

        $ads->each(fn (Ad $ad) => $ad->setAttribute('metrics_rollups', $rollups[$ad->id] ?? null));

        return ApiResponse::success([
            'ad_set' => $adSet,
            'currency' => $this->currencyFor($adSet->campaign),
            'ads' => $ads,
        ], 'Publicités récupérées.');
    }

    /** Crée un créatif + une publicité sur Meta, en pause. */
    public function publishAd(Request $request, string $adSetId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $adSet = AdSet::query()->where('brand_id', $brandId)->findOrFail($adSetId);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:2000'],
            'title' => ['nullable', 'string', 'max:255'],
            'link' => ['nullable', 'url', 'max:2048'],
            'call_to_action' => ['nullable', 'string', 'max:40'],
            'image_url' => ['nullable', 'url', 'max:2048'],
            'image_base64' => ['nullable', 'string'],
        ], [
            'name.required' => 'Le nom de la publicité est obligatoire.',
            'message.required' => 'Le texte de la publicité est obligatoire.',
            'link.url' => 'Le lien de destination doit être une URL valide.',
            'image_url.url' => 'L’URL de l’image n’est pas valide.',
        ]);

        try {
            $ad = app(\App\Services\Meta\MetaAdPublisher::class)->publish($brandId, $adSet, $data);
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'ads.publish', $ad, null, $ad->toArray());

        return ApiResponse::success(
            $ad,
            'Publicité créée sur Meta, en pause. Vérifiez-la dans Ads Manager avant de l’activer.',
            201
        );
    }

    /** Importe ensembles, publicités et métriques depuis Meta. */
    public function sync(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $accounts = AdAccount::query()
            ->where('brand_id', $brandId)
            ->where('platform', 'meta')
            ->get();

        if ($accounts->isEmpty()) {
            return ApiResponse::error('Aucun compte publicitaire Meta pour cette marque.', null, 422);
        }

        $service = app(MetaAdStructureSyncService::class);
        $totals = ['ad_sets' => 0, 'ads' => 0, 'ad_set_metrics' => 0, 'ad_metrics' => 0];
        $errors = [];

        foreach ($accounts as $account) {
            try {
                $result = $service->sync($brandId, $account, $request->query('metrics_from'), $request->query('metrics_to'));
                foreach ($totals as $key => $value) {
                    $totals[$key] = $value + ($result[$key] ?? 0);
                }
            } catch (MetaApiException $e) {
                $errors[] = $account->account_name.' : '.$e->getMessage();
            }
        }

        if ($totals['ad_sets'] === 0 && $errors !== []) {
            return ApiResponse::error(implode(' | ', $errors), $totals, 422);
        }

        $message = sprintf(
            '%d ensemble(s), %d publicité(s) importés.',
            $totals['ad_sets'],
            $totals['ads']
        );
        if ($errors !== []) {
            $message .= ' Erreurs : '.implode(' | ', $errors);
        }

        return ApiResponse::success($totals, $message);
    }

    /**
     * Devise des montants publicitaires : celle du compte Meta, qui n'est pas
     * forcément celle des commandes (souvent USD côté régie).
     */
    private function currencyFor(?Campaign $campaign): string
    {
        if (! $campaign) {
            return 'USD';
        }

        $currency = trim((string) $campaign->campaign_currency);
        if ($currency === '') {
            $currency = trim((string) $campaign->adAccount?->currency);
        }

        return $currency !== '' ? strtoupper($currency) : 'USD';
    }

    /**
     * Agrégat des métriques sur la période, par entité.
     *
     * @param  list<int>  $ids
     * @return array<int, array<string, mixed>>
     */
    private function rollups(string $table, string $column, array $ids, ?string $from, ?string $to): array
    {
        if ($ids === [] || ! $from || ! $to) {
            return [];
        }

        $rows = DB::table($table)
            ->whereIn($column, $ids)
            ->whereBetween('metric_date', [$from, $to])
            ->groupBy($column)
            ->selectRaw(
                $column.' as entity_id,
                SUM(spend) as spend,
                SUM(impressions) as impressions,
                SUM(clicks) as clicks,
                SUM(reach) as reach,
                SUM(leads) as leads,
                SUM(messages) as messages'
            )
            ->get();

        $out = [];
        foreach ($rows as $row) {
            $spend = (float) $row->spend;
            $clicks = (int) $row->clicks;
            $impressions = (int) $row->impressions;
            $leads = (int) $row->leads;

            $out[(int) $row->entity_id] = [
                'spend' => round($spend, 2),
                'impressions' => $impressions,
                'clicks' => $clicks,
                'reach' => (int) $row->reach,
                'leads' => $leads,
                'messages' => (int) $row->messages,
                'ctr' => $impressions > 0 ? round($clicks / $impressions * 100, 2) : null,
                'cpc' => $clicks > 0 ? round($spend / $clicks, 2) : null,
                'cpm' => $impressions > 0 ? round($spend / $impressions * 1000, 2) : null,
                'cpl' => $leads > 0 ? round($spend / $leads, 2) : null,
            ];
        }

        return $out;
    }
}
