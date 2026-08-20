<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InfluencerPublishedContent;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InfluencerPublishedContentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = InfluencerPublishedContent::query()
            ->with(['deliverable:id,title,content_type', 'influencer:id,full_name,username', 'recordedByUser:id,name']);
        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        $q->orderByDesc('id');

        if ($collaborationId = $request->query('collaboration_id')) {
            $q->where('collaboration_id', (int) $collaborationId);
        }
        if ($deliverableId = $request->query('deliverable_id')) {
            $q->where('deliverable_id', (int) $deliverableId);
        }
        if ($influencerId = $request->query('influencer_id')) {
            $q->where('influencer_id', (int) $influencerId);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'deliverable_id' => ['required', 'integer', 'exists:influencer_deliverables,id'],
            'collaboration_id' => ['required', 'integer', 'exists:influencer_collaborations,id'],
            'influencer_id' => ['required', 'integer', 'exists:influencers,id'],
            'content_type' => ['required', 'string', 'max:50'],
            'platform' => ['required', 'string', 'max:50'],
            'content_url' => ['nullable', 'string', 'max:500'],
            'screenshot_url' => ['nullable', 'string', 'max:500'],
            'published_at' => ['nullable', 'date'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'archive_url' => ['nullable', 'string', 'max:500'],
            'no_publication' => ['nullable', 'boolean'],
            'no_publication_reason' => ['nullable', 'string'],
            'live_duration_minutes' => ['nullable', 'integer'],
            'live_viewers_count' => ['nullable', 'integer'],
            'views' => ['nullable', 'integer', 'min:0'],
            'reach' => ['nullable', 'integer', 'min:0'],
            'impressions' => ['nullable', 'integer', 'min:0'],
            'likes' => ['nullable', 'integer', 'min:0'],
            'comments_count' => ['nullable', 'integer', 'min:0'],
            'shares' => ['nullable', 'integer', 'min:0'],
            'saves' => ['nullable', 'integer', 'min:0'],
            'clicks' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['recorded_by'] = $request->user()->id;

        $row = InfluencerPublishedContent::query()->create($data);

        AuditLogger::log($request, 'influencer_published_contents.create', $row, null, $row->toArray());

        return ApiResponse::success(
            $row->fresh()->load(['deliverable:id,title', 'influencer:id,full_name']),
            'Contenu publié enregistré.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPublishedContent::query()
            ->with(['deliverable', 'collaboration:id,title', 'influencer:id,full_name,username', 'recordedByUser:id,name'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPublishedContent::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'content_url' => ['nullable', 'string', 'max:500'],
            'screenshot_url' => ['nullable', 'string', 'max:500'],
            'published_at' => ['nullable', 'date'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'is_archived' => ['nullable', 'boolean'],
            'archive_url' => ['nullable', 'string', 'max:500'],
            'no_publication' => ['nullable', 'boolean'],
            'no_publication_reason' => ['nullable', 'string'],
            'live_duration_minutes' => ['nullable', 'integer'],
            'live_viewers_count' => ['nullable', 'integer'],
            'views' => ['nullable', 'integer', 'min:0'],
            'reach' => ['nullable', 'integer', 'min:0'],
            'impressions' => ['nullable', 'integer', 'min:0'],
            'likes' => ['nullable', 'integer', 'min:0'],
            'comments_count' => ['nullable', 'integer', 'min:0'],
            'shares' => ['nullable', 'integer', 'min:0'],
            'saves' => ['nullable', 'integer', 'min:0'],
            'clicks' => ['nullable', 'integer', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_published_contents.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Contenu mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPublishedContent::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_published_contents.delete', null, $before, null);

        return ApiResponse::success(null, 'Contenu supprimé.');
    }
}
