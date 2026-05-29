<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdAccount;
use App\Services\Meta\MetaAdsSyncService;
use App\Services\Meta\MetaApiException;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MetaAdsController extends Controller
{
    public function __construct(
        private readonly MetaAdsSyncService $sync,
    ) {}

    public function previewAdAccounts(Request $request): JsonResponse
    {
        try {
            $brandId = ApiBrandContext::resolveBrandId($request);
            $rows = $this->sync->fetchAdAccounts($brandId);

            return ApiResponse::success(['accounts' => $rows], 'Comptes publicitaires Meta récupérés.');
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }

    public function syncAdAccounts(Request $request): JsonResponse
    {
        try {
            $brandId = ApiBrandContext::resolveBrandId($request);
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
            $brandId = ApiBrandContext::resolveBrandId($request);
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
            $brandId = ApiBrandContext::resolveBrandId($request);
            $account = AdAccount::query()
                ->where('brand_id', $brandId)
                ->where('platform', 'meta')
                ->findOrFail($request->integer('ad_account_id'));

            $to = $validated['to'] ?? now()->toDateString();
            $from = $validated['from'] ?? now()->subDays(30)->toDateString();

            $stats = $this->sync->syncInsights($brandId, $account, $from, $to);

            return ApiResponse::success(
                array_merge($stats, ['from' => $from, 'to' => $to]),
                sprintf('%d ligne(s) de métriques importée(s) pour %d campagne(s).', $stats['upserted'], $stats['campaigns'])
            );
        } catch (MetaApiException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
    }
}
