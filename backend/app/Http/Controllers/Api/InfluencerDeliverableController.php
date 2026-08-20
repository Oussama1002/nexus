<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InfluencerDeliverable;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InfluencerDeliverableController extends Controller
{
    private const STATUSES = ['a_produire', 'en_cours', 'livre', 'valide', 'refuse'];

    private const CONTENT_TYPES = ['story', 'reel', 'post', 'video', 'live', 'carousel', 'article', 'autre'];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = InfluencerDeliverable::query()->with(['collaboration:id,title,influencer_id', 'collaboration.influencer:id,full_name']);
        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        $q->orderByDesc('id');

        if ($collaborationId = $request->query('collaboration_id')) {
            $q->where('collaboration_id', (int) $collaborationId);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'collaboration_id' => ['required', 'integer', 'exists:influencer_collaborations,id'],
            'title' => ['required', 'string', 'max:255'],
            'content_type' => ['required', Rule::in(self::CONTENT_TYPES)],
            'platform' => ['nullable', 'string', 'max:50'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'due_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'brief_notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'a_produire';

        $row = InfluencerDeliverable::query()->create($data);

        AuditLogger::log($request, 'influencer_deliverables.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['collaboration:id,title']), 'Livrable créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerDeliverable::query()
            ->with(['collaboration.influencer:id,full_name', 'publishedContents', 'validatedByUser:id,name'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerDeliverable::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'content_type' => ['nullable', Rule::in(self::CONTENT_TYPES)],
            'platform' => ['nullable', 'string', 'max:50'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'due_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'brief_notes' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        if (isset($data['status']) && $data['status'] === 'valide') {
            $data['validated_by_user_id'] = $request->user()->id;
            $data['validated_at'] = now();
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_deliverables.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Livrable mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerDeliverable::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_deliverables.delete', null, $before, null);

        return ApiResponse::success(null, 'Livrable supprimé.');
    }
}
