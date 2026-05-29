<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCampaignRequest;
use App\Http\Requests\Api\UpdateCampaignRequest;
use App\Models\AdAccount;
use App\Models\Campaign;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $platform = $request->query('platform');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $metricsFrom = $request->query('metrics_from');
        $metricsTo = $request->query('metrics_to');

        $q = Campaign::query()
            ->with([
                'adAccount',
                'brand:id,name',
                'product:id,name',
                'confirmatrice:id,name',
                'influencer:id,full_name,username',
            ])
            ->where('brand_id', $brandId)
            ->orderByDesc('id');
        if ($status) {
            $q->where('status', $status);
        }
        if ($platform) {
            $q->where('source', $platform);
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }

        $paginator = $q->paginate($perPage);

        if ($metricsFrom && $metricsTo && $paginator->count() > 0) {
            $ids = $paginator->getCollection()->pluck('id')->all();
            $rolls = DB::table('campaign_metrics')
                ->whereIn('campaign_id', $ids)
                ->whereBetween('metric_date', [$metricsFrom, $metricsTo])
                ->groupBy('campaign_id')
                ->selectRaw(
                    'campaign_id,
                    SUM(spend) as rollup_spend,
                    SUM(leads) as rollup_leads,
                    SUM(revenue) as rollup_revenue,
                    SUM(messages) as rollup_messages,
                    SUM(confirmed_orders) as rollup_confirmed_orders,
                    SUM(impressions) as rollup_impressions,
                    SUM(clicks) as rollup_clicks'
                )
                ->get()
                ->keyBy('campaign_id');

            $paginator->getCollection()->transform(function (Campaign $c) use ($rolls) {
                $r = $rolls[$c->id] ?? null;
                if (! $r) {
                    $c->setAttribute('metrics_rollups', null);

                    return $c;
                }
                $spend = (float) $r->rollup_spend;
                $rev = (float) $r->rollup_revenue;
                $clicks = (int) $r->rollup_clicks;
                $impressions = (int) $r->rollup_impressions;
                $leads = (int) $r->rollup_leads;
                $confirmed = (int) $r->rollup_confirmed_orders;

                $c->setAttribute('metrics_rollups', [
                    'spend' => round($spend, 2),
                    'leads' => $leads,
                    'revenue' => round($rev, 2),
                    'messages' => (int) $r->rollup_messages,
                    'confirmed_orders' => $confirmed,
                    'impressions' => $impressions,
                    'clicks' => $clicks,
                    'roas' => $spend > 0 ? round($rev / $spend, 4) : null,
                    'cpc' => $clicks > 0 ? round($spend / $clicks, 4) : null,
                    'cpm' => $impressions > 0 ? round($spend / $impressions * 1000, 4) : null,
                    'cpl' => $leads > 0 ? round($spend / $leads, 4) : null,
                    'cpa' => $confirmed > 0 ? round($spend / $confirmed, 4) : null,
                ]);

                return $c;
            });
        }

        return ApiResponse::success($paginator, 'Campaigns retrieved successfully.');
    }

    public function store(StoreCampaignRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        try {
            $this->assertAdAccountBrand($data['ad_account_id'] ?? null, $brandId);
            $campaign = Campaign::query()->create(array_merge($data, [
                'brand_id' => $brandId,
                'spend' => $data['spend'] ?? 0,
                'status' => $data['status'] ?? 'draft',
                'campaign_currency' => $data['campaign_currency'] ?? 'MAD',
            ]));
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'campaigns.create', $campaign, null, $campaign->toArray());

        return ApiResponse::success(
            $campaign->load(['adAccount', 'brand:id,name', 'product:id,name', 'confirmatrice:id,name', 'influencer:id,full_name,username']),
            'Campaign created successfully.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $campaign = Campaign::query()
            ->with([
                'metrics',
                'adAccount.responsible:id,name',
                'brand:id,name',
                'product:id,name,sku',
                'confirmatrice:id,name',
                'influencer:id,full_name,username',
            ])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($campaign, 'Campaign retrieved successfully.');
    }

    public function update(UpdateCampaignRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $campaign = Campaign::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $campaign->toArray();
        $data = $request->validated();

        try {
            if (array_key_exists('ad_account_id', $data)) {
                $this->assertAdAccountBrand($data['ad_account_id'] ?? null, $brandId);
            }
            $campaign->fill($data);
            $campaign->save();
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'campaigns.update', $campaign, $before, $campaign->fresh()->toArray());

        return ApiResponse::success(
            $campaign->fresh()->load(['adAccount', 'brand:id,name', 'product:id,name', 'confirmatrice:id,name', 'influencer:id,full_name,username']),
            'Campaign updated successfully.'
        );
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $campaign = Campaign::query()->where('brand_id', $brandId)->findOrFail($id);

        if (! in_array($campaign->status, ['draft', 'cancelled'], true)) {
            return ApiResponse::error('Only draft or cancelled campaigns can be deleted.', null, 422);
        }

        $before = $campaign->toArray();
        $campaign->metrics()->delete();
        $campaign->delete();

        AuditLogger::log($request, 'campaigns.delete', null, $before, null);

        return ApiResponse::success(null, 'Campaign deleted successfully.');
    }

    protected function assertAdAccountBrand(?int $adAccountId, int $brandId): void
    {
        if (! $adAccountId) {
            return;
        }
        if (! AdAccount::query()->whereKey($adAccountId)->where('brand_id', $brandId)->exists()) {
            throw new RuntimeException('Ad account does not belong to this brand.');
        }
    }
}
