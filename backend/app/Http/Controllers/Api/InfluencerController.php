<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreInfluencerRequest;
use App\Http\Requests\Api\UpdateInfluencerRequest;
use App\Models\Influencer;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InfluencerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $platform = $request->query('platform');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = Influencer::query();
        if ($brandId !== null) {
            $q->where(function ($q2) use ($brandId) {
                $q2->where('brand_id', $brandId)->orWhereNull('brand_id');
            });
        }
        $q
            ->orderByDesc('id');

        if ($status) {
            $q->where('status', $status);
        }
        if ($platform) {
            $q->where('platform', $platform);
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage), 'Influencers retrieved successfully.');
    }

    public function store(StoreInfluencerRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $data['brand_id'] ?? $brandId;
        $data['status'] = $data['status'] ?? 'new';

        $row = Influencer::query()->create($data);

        AuditLogger::log($request, 'influencers.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh(), 'Influencer created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->findOrFail($id);

        return ApiResponse::success($row->load(['collaborations', 'performance']), 'Influencer retrieved successfully.');
    }

    public function update(UpdateInfluencerRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->findOrFail($id);

        $before = $row->toArray();
        $row->fill($request->validated());
        $row->save();

        AuditLogger::log($request, 'influencers.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Influencer updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencers.delete', null, $before, null);

        return ApiResponse::success(null, 'Influencer deleted successfully.');
    }
}
