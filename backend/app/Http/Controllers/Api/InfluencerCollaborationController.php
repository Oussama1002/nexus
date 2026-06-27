<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreInfluencerCollaborationRequest;
use App\Http\Requests\Api\UpdateInfluencerCollaborationRequest;
use App\Models\Influencer;
use App\Models\InfluencerCollaboration;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class InfluencerCollaborationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $platform = $request->query('platform');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = InfluencerCollaboration::query()
            ->with(['influencer', 'campaign', 'owner']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('id');

        if ($status) {
            $q->where('status', $status);
        }
        if ($platform) {
            $q->whereHas('influencer', fn ($in) => $in->where('platform', $platform));
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage), 'Collaborations retrieved successfully.');
    }

    public function store(StoreInfluencerCollaborationRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'draft';

        $this->assertInfluencerBrandScope($brandId, (int) $data['influencer_id']);

        if ($data['status'] === 'active') {
            $this->assertActivationRules($data);
        }

        if (in_array($data['status'], ['approved', 'active'], true) && ! UserRoleHelper::canApproveCollaborations($request->user())) {
            throw new AccessDeniedHttpException('Only Influence Manager, SMM or Admin can approve or activate collaborations.');
        }

        $row = InfluencerCollaboration::query()->create($data);

        AuditLogger::log($request, 'influencer_collaborations.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer', 'campaign']), 'Collaboration created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->with(['influencer', 'campaign', 'owner'])->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($row, 'Collaboration retrieved successfully.');
    }

    public function update(UpdateInfluencerCollaborationRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $data = $request->validated();

        if (isset($data['influencer_id'])) {
            $this->assertInfluencerBrandScope($brandId, (int) $data['influencer_id']);
        }

        $newStatus = $data['status'] ?? $row->status;
        $merged = array_merge($row->toArray(), $data);

        if ($newStatus === 'active') {
            $this->assertActivationRules($merged);
        }

        if (in_array($newStatus, ['approved', 'active'], true) && ! UserRoleHelper::canApproveCollaborations($request->user())) {
            throw new AccessDeniedHttpException('Only Influence Manager, SMM or Admin can approve or activate collaborations.');
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_collaborations.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer', 'campaign']), 'Collaboration updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_collaborations.delete', null, $before, null);

        return ApiResponse::success(null, 'Collaboration deleted successfully.');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertActivationRules(array $data): void
    {
        if (empty($data['contract_url'])) {
            abort(422, 'contract_url is required before status can be active.');
        }
        if ((float) ($data['agreed_amount'] ?? 0) < 0) {
            abort(422, 'agreed_amount cannot be negative.');
        }
    }

    private function assertInfluencerBrandScope(int $brandId, int $influencerId): void
    {
        $inf = Influencer::query()->findOrFail($influencerId);
        if ($inf->brand_id !== null && (int) $inf->brand_id !== $brandId) {
            abort(422, 'Influencer does not belong to this brand.');
        }
    }
}
