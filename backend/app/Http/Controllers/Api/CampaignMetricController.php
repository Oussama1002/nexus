<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCampaignMetricRequest;
use App\Http\Requests\Api\UpdateCampaignMetricRequest;
use App\Models\Campaign;
use App\Models\CampaignMetric;
use App\Services\AuditLogger;
use App\Services\CampaignMetricCalculator;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CampaignMetricController extends Controller
{
    public function __construct(
        protected CampaignMetricCalculator $calculator
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $campaignId = $request->query('campaign_id');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = CampaignMetric::query()
            ->with('campaign');
        if ($brandId !== null) {
            $q->whereHas('campaign', fn ($c) => $c->where('brand_id', $brandId));
        }
        $q->orderByDesc('metric_date');

        if ($campaignId) {
            $campaignQuery = Campaign::query()->whereKey($campaignId);
            if ($brandId !== null) {
                $campaignQuery->where('brand_id', $brandId);
            }
            $campaignQuery->firstOrFail();
            $q->where('campaign_id', (int) $campaignId);
        }
        if ($from) {
            $q->whereDate('metric_date', '>=', $from);
        }
        if ($to) {
            $q->whereDate('metric_date', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage), 'Campaign metrics retrieved successfully.');
    }

    public function store(StoreCampaignMetricRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        $campaign = Campaign::query()->where('brand_id', $brandId)->whereKey($data['campaign_id'])->firstOrFail();

        $metric = new CampaignMetric($data);
        $metric->campaign_id = $campaign->id;
        $this->calculator->apply($metric);

        try {
            $metric->save();
        } catch (\Illuminate\Database\QueryException $e) {
            if (str_contains($e->getMessage(), 'UNIQUE') || str_contains($e->getMessage(), 'unique')) {
                throw ValidationException::withMessages([
                    'metric_date' => ['A metric for this campaign and date already exists.'],
                ]);
            }
            throw $e;
        }

        AuditLogger::log($request, 'campaign_metrics.create', $metric, null, $metric->toArray());

        return ApiResponse::success($metric->fresh(), 'Campaign metric created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $metric = CampaignMetric::query()
            ->whereKey($id)
            ->whereHas('campaign', fn ($c) => $c->where('brand_id', $brandId))
            ->with('campaign')
            ->firstOrFail();

        return ApiResponse::success($metric, 'Campaign metric retrieved successfully.');
    }

    public function update(UpdateCampaignMetricRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $metric = CampaignMetric::query()
            ->whereKey($id)
            ->whereHas('campaign', fn ($c) => $c->where('brand_id', $brandId))
            ->firstOrFail();

        $before = $metric->toArray();
        $metric->fill($request->validated());
        $this->calculator->apply($metric);
        $metric->save();

        AuditLogger::log($request, 'campaign_metrics.update', $metric, $before, $metric->fresh()->toArray());

        return ApiResponse::success($metric->fresh(), 'Campaign metric updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $metric = CampaignMetric::query()
            ->whereKey($id)
            ->whereHas('campaign', fn ($c) => $c->where('brand_id', $brandId))
            ->firstOrFail();

        $before = $metric->toArray();
        $metric->delete();

        AuditLogger::log($request, 'campaign_metrics.delete', null, $before, null);

        return ApiResponse::success(null, 'Campaign metric deleted successfully.');
    }
}
