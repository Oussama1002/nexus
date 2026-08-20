<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmContentPerformance;
use App\Models\SmmPerformanceSnapshot;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmPerformanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = SmmContentPerformance::query()
            ->with(['content:id,title,platform,format,pillar_id'])
            ->orderByDesc('last_synced_at');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($platform = $request->query('platform')) $q->where('platform', $platform);
        if ($contentId = $request->query('content_id')) $q->where('content_id', (int) $contentId);
        if ($request->boolean('failed_only')) $q->where('sync_failed', true);
        return ApiResponse::success($q->paginate((int) $request->query('per_page', 50)));
    }

    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'content_id' => ['required', 'integer', 'exists:smm_contents,id'],
            'platform' => ['required', 'string', 'max:40'],
            'reach' => ['nullable', 'integer'],
            'impressions' => ['nullable', 'integer'],
            'views' => ['nullable', 'integer'],
            'engagement_rate' => ['nullable', 'numeric'],
            'shares' => ['nullable', 'integer'],
            'saves' => ['nullable', 'integer'],
            'comments_count' => ['nullable', 'integer'],
            'profile_visits' => ['nullable', 'integer'],
            'followers_gained' => ['nullable', 'integer'],
            'clicks' => ['nullable', 'integer'],
            'conversions' => ['nullable', 'integer'],
        ]);
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $data['brand_id'] = $brandId;
        $data['last_synced_at'] = now();
        $data['sync_failed'] = false;
        $data['sync_error'] = null;
        $row = SmmContentPerformance::query()->updateOrCreate(
            ['content_id' => $data['content_id'], 'platform' => $data['platform']],
            $data,
        );
        // Snapshot for history
        SmmPerformanceSnapshot::query()->create([
            'content_id' => $row->content_id,
            'platform' => $row->platform,
            'snapshot_at' => now(),
            'metrics_json' => collect($data)->only([
                'reach', 'impressions', 'views', 'engagement_rate', 'shares', 'saves',
                'comments_count', 'profile_visits', 'followers_gained', 'clicks', 'conversions',
            ])->toArray(),
        ]);
        AuditLogger::log($request, 'smm_perf.upsert', $row);
        return ApiResponse::success($row->fresh());
    }

    public function snapshots(Request $request, string $contentId): JsonResponse
    {
        $q = SmmPerformanceSnapshot::query()
            ->where('content_id', (int) $contentId)
            ->orderBy('snapshot_at');
        if ($platform = $request->query('platform')) $q->where('platform', $platform);
        return ApiResponse::success($q->get());
    }
}
