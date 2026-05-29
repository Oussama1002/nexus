<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreInfluencerMessageRequest;
use App\Http\Requests\Api\UpdateInfluencerMessageRequest;
use App\Models\InfluencerMessage;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InfluencerMessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $platform = $request->query('platform');

        $q = InfluencerMessage::query()
            ->with(['influencer', 'collaboration'])
            ->where(function ($q) use ($brandId) {
                $q->whereHas('collaboration', fn ($c) => $c->where('brand_id', $brandId))
                    ->orWhereHas('influencer', fn ($in) => $in->where('brand_id', $brandId));
            })
            ->orderByDesc('message_at');

        if ($from) {
            $q->whereDate('message_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('message_at', '<=', $to);
        }
        if ($platform) {
            $q->whereHas('influencer', fn ($in) => $in->where('platform', $platform));
        }

        return ApiResponse::success($q->paginate($perPage), 'Messages retrieved successfully.');
    }

    public function store(StoreInfluencerMessageRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $this->assertRefsForBrand($brandId, $data);

        $row = InfluencerMessage::query()->create($data);

        AuditLogger::log($request, 'influencer_messages.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer']), 'Message logged.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        ApiBrandContext::resolveBrandId($request);
        $row = InfluencerMessage::query()->with(['influencer', 'collaboration'])->findOrFail($id);
        $this->assertRowBrand($request, $row);

        return ApiResponse::success($row, 'Message retrieved successfully.');
    }

    public function update(UpdateInfluencerMessageRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerMessage::query()->findOrFail($id);
        $this->assertRowBrand($request, $row);
        $before = $row->toArray();
        $data = $request->validated();
        $this->assertRefsForBrand($brandId, array_merge($row->toArray(), $data));

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_messages.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Message updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        ApiBrandContext::resolveBrandId($request);
        $row = InfluencerMessage::query()->findOrFail($id);
        $this->assertRowBrand($request, $row);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_messages.delete', null, $before, null);

        return ApiResponse::success(null, 'Message deleted successfully.');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertRefsForBrand(int $brandId, array $data): void
    {
        if (! empty($data['influencer_collaboration_id'])) {
            $ok = \App\Models\InfluencerCollaboration::query()->where('brand_id', $brandId)->whereKey($data['influencer_collaboration_id'])->exists();
            if (! $ok) {
                abort(422, 'Invalid collaboration.');
            }
        }
        $inf = \App\Models\Influencer::query()->findOrFail($data['influencer_id']);
        if ($inf->brand_id !== null && (int) $inf->brand_id !== $brandId) {
            abort(422, 'Influencer out of brand scope.');
        }
    }

    private function assertRowBrand(Request $request, InfluencerMessage $row): void
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row->loadMissing(['influencer', 'collaboration']);
        if ($row->collaboration && (int) $row->collaboration->brand_id !== $brandId) {
            abort(404);
        }
        if ($row->influencer && $row->influencer->brand_id !== null && (int) $row->influencer->brand_id !== $brandId) {
            abort(404);
        }
    }
}
