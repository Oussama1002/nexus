<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdAccount;
use App\Models\Brand;
use App\Services\Meta\MetaAdsSyncService;
use App\Services\Meta\MetaApiException;
use App\Services\Meta\MetaCampaignPublisher;
use App\Services\Meta\MetaSocialSyncService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MetaAdsController extends Controller
{
    public function __construct(
        private readonly MetaAdsSyncService $sync,
    ) {}

    private function resolveSettingsBrand(Request $request): int
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        if ($brandId !== null) {
            return $brandId;
        }

        return (int) Brand::query()->orderBy('id')->value('id');
    }

    /** Crée sur Meta une campagne saisie dans le CRM (toujours en pause). */
    public function publishCampaign(Request $request, string $id, MetaCampaignPublisher $publisher): JsonResponse
    {
        try {
            $brandId = $this->resolveSettingsBrand($request);
            $campaign = \App\Models\Campaign::query()->where('brand_id', $brandId)->findOrFail((int) $id);
            $result = $publisher->publish($brandId, $campaign);

            return ApiResponse::success(
                $result,
                'Campagne créée sur Meta (en pause) — ajustez audience et visuels dans Ads Manager avant activation.'
            );
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }

    /** Importe les Pages Facebook (et Instagram lié) dans « Comptes sociaux ». */
    public function syncSocialAccounts(Request $request, MetaSocialSyncService $social): JsonResponse
    {
        try {
            $brandId = $this->resolveSettingsBrand($request);
            $stats = $social->syncPages($brandId);

            return ApiResponse::success($stats, sprintf(
                '%d compte(s) social(aux) importé(s), %d mis à jour.',
                $stats['created'],
                $stats['updated']
            ));
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }

    public function previewAdAccounts(Request $request): JsonResponse
    {
        try {
            $brandId = $this->resolveSettingsBrand($request);
            $rows = $this->sync->fetchAdAccounts($brandId);

            return ApiResponse::success(['accounts' => $rows], 'Comptes publicitaires Meta récupérés.');
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }

    public function syncAdAccounts(Request $request): JsonResponse
    {
        try {
            $brandId = $this->resolveSettingsBrand($request);
            $stats = $this->sync->syncAdAccounts($brandId);

            return ApiResponse::success($stats, sprintf(
                'Synchronisation terminée — %d créé(s), %d mis à jour (%d sur Meta).',
                $stats['created'],
                $stats['updated'],
                $stats['total']
            ));
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }

    public function syncCampaigns(Request $request): JsonResponse
    {
        $request->validate([
            'ad_account_id' => ['required', 'integer'],
        ]);

        try {
            $brandId = $this->resolveSettingsBrand($request);
            $account = AdAccount::query()
                ->where('brand_id', $brandId)
                ->where('platform', 'meta')
                ->findOrFail($request->integer('ad_account_id'));

            $stats = $this->sync->syncCampaigns($brandId, $account);

            return ApiResponse::success($stats, sprintf(
                'Campagnes synchronisées — %d créée(s), %d mise(s) à jour.',
                $stats['created'],
                $stats['updated']
            ));
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }

    public function syncInsights(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ad_account_id' => ['required', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        try {
            $brandId = $this->resolveSettingsBrand($request);
            $account = AdAccount::query()
                ->where('brand_id', $brandId)
                ->where('platform', 'meta')
                ->findOrFail($request->integer('ad_account_id'));

            // Pas de période fournie = tout l'historique (date_preset=maximum).
            $from = $validated['from'] ?? null;
            $to = $validated['to'] ?? null;

            $stats = $this->sync->syncInsights($brandId, $account, $from, $to);

            return ApiResponse::success(
                array_merge($stats, ['from' => $from ?? 'origine', 'to' => $to ?? 'aujourd’hui']),
                sprintf('%d ligne(s) de métriques importée(s) pour %d campagne(s).', $stats['upserted'], $stats['campaigns'])
            );
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }
}
