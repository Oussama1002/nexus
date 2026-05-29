<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreInfluencerPerformanceRequest;
use App\Http\Requests\Api\UpdateInfluencerPerformanceRequest;
use App\Models\Influencer;
use App\Models\InfluencerCollaboration;
use App\Models\InfluencerPerformance;
use App\Services\AuditLogger;
use App\Services\InfluencerPerformanceCalculator;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InfluencerPerformanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $influencerId = $request->query('influencer_id');

        $q = InfluencerPerformance::query()
            ->with(['influencer', 'collaboration'])
            ->where(function ($q) use ($brandId) {
                $q->whereHas('collaboration', fn ($c) => $c->where('brand_id', $brandId))
                    ->orWhereHas('influencer', fn ($in) => $in->where('brand_id', $brandId));
            })
            ->orderByDesc('metric_date');

        if ($influencerId) {
            $q->where('influencer_id', (int) $influencerId);
        }
        if ($from) {
            $q->whereDate('metric_date', '>=', $from);
        }
        if ($to) {
            $q->whereDate('metric_date', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage), 'Performance metrics retrieved successfully.');
    }

    public function store(StoreInfluencerPerformanceRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        $this->assertBrandScopedRefs($request, $data);
        $this->assertInfluencerForBrand($brandId, (int) $data['influencer_id']);
        $this->normalizeDeliveryFields($data);

        $collab = ! empty($data['influencer_collaboration_id'])
            ? InfluencerCollaboration::query()->find($data['influencer_collaboration_id'])
            : null;

        $exists = InfluencerPerformance::query()
            ->where('influencer_id', $data['influencer_id'])
            ->where('metric_date', $data['metric_date'])
            ->when(! empty($data['influencer_collaboration_id']), fn ($q) => $q->where('influencer_collaboration_id', $data['influencer_collaboration_id']))
            ->when(empty($data['influencer_collaboration_id']), fn ($q) => $q->whereNull('influencer_collaboration_id'))
            ->exists();

        if ($exists) {
            abort(422, 'A metric already exists for this influencer, collaboration and date.');
        }

        $row = new InfluencerPerformance;
        $row->fill($data);
        $ratios = InfluencerPerformanceCalculator::computeRatios($row, $collab, $data);
        $row->fill($ratios);
        $row->save();

        AuditLogger::log($request, 'influencer_performance.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer', 'collaboration']), 'Performance metric created.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPerformance::query()->with(['influencer', 'collaboration'])->findOrFail($id);
        $this->assertMetricBrandAccess($request, $row);

        return ApiResponse::success($row, 'Performance metric retrieved successfully.');
    }

    public function update(UpdateInfluencerPerformanceRequest $request, string $id): JsonResponse
    {
        ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPerformance::query()->findOrFail($id);
        $this->assertMetricBrandAccess($request, $row);

        $before = $row->toArray();
        $data = $request->validated();
        $this->normalizeDeliveryFields($data);

        $collabId = $data['influencer_collaboration_id'] ?? $row->influencer_collaboration_id;
        $collab = $collabId ? InfluencerCollaboration::query()->find($collabId) : null;

        $row->fill($data);
        $ratios = InfluencerPerformanceCalculator::computeRatios($row, $collab, $data);
        $row->fill($ratios);
        $row->save();

        AuditLogger::log($request, 'influencer_performance.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer', 'collaboration']), 'Performance metric updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPerformance::query()->findOrFail($id);
        $this->assertMetricBrandAccess($request, $row);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_performance.delete', null, $before, null);

        return ApiResponse::success(null, 'Performance metric deleted successfully.');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertBrandScopedRefs(Request $request, array $data): void
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        if (! empty($data['influencer_collaboration_id'])) {
            $c = InfluencerCollaboration::query()->where('brand_id', $brandId)->whereKey($data['influencer_collaboration_id'])->exists();
            if (! $c) {
                abort(422, 'Invalid collaboration for brand.');
            }
        }
    }

    private function assertMetricBrandAccess(Request $request, InfluencerPerformance $row): void
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row->loadMissing(['influencer', 'collaboration']);
        if ($row->collaboration && (int) $row->collaboration->brand_id !== $brandId) {
            abort(404);
        }
        $inf = $row->influencer;
        if ($inf && $inf->brand_id !== null && (int) $inf->brand_id !== $brandId) {
            abort(404);
        }
    }

    private function assertInfluencerForBrand(int $brandId, int $influencerId): void
    {
        $inf = Influencer::query()->findOrFail($influencerId);
        if ($inf->brand_id !== null && (int) $inf->brand_id !== $brandId) {
            abort(422, 'Influencer is not in scope for this brand.');
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function normalizeDeliveryFields(array &$data): void
    {
        if (! array_key_exists('planned_actions', $data) || $data['planned_actions'] === null) {
            $data['planned_actions'] = 1;
        }

        if (! array_key_exists('completed_actions', $data) || $data['completed_actions'] === null) {
            $data['completed_actions'] = 0;
        }

        $planned = max(1, (int) $data['planned_actions']);
        $completed = max(0, (int) $data['completed_actions']);
        $data['planned_actions'] = $planned;
        $data['completed_actions'] = min($completed, $planned);
    }
}
