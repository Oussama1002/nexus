<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreInfluencerComplaintRequest;
use App\Http\Requests\Api\UpdateInfluencerComplaintRequest;
use App\Models\InfluencerComplaint;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InfluencerComplaintController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = InfluencerComplaint::query()
            ->with(['influencer', 'collaboration']);
        if ($brandId !== null) {
            $q->where(function ($q) use ($brandId) {
                $q->whereHas('collaboration', fn ($c) => $c->where('brand_id', $brandId))
                    ->orWhereHas('influencer', fn ($in) => $in->where('brand_id', $brandId));
            });
        }
        $q->orderByDesc('id');

        if ($status) {
            $q->where('status', $status);
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage), 'Complaints retrieved successfully.');
    }

    public function store(StoreInfluencerComplaintRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['reported_by'] = $request->user()?->id;
        $data['status'] = $data['status'] ?? 'open';

        $this->assertRefs($brandId, $data);

        if (in_array($data['status'], ['resolved', 'closed'], true) && empty($data['resolution_notes'])) {
            abort(422, 'resolution_notes is required when status is resolved or closed.');
        }

        $row = InfluencerComplaint::query()->create($data);

        AuditLogger::log($request, 'influencer_complaints.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer']), 'Complaint created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        ApiBrandContext::resolveBrandId($request);
        $row = InfluencerComplaint::query()->with(['influencer', 'collaboration'])->findOrFail($id);
        $this->assertRowAccess($request, $row);

        return ApiResponse::success($row, 'Complaint retrieved successfully.');
    }

    public function update(UpdateInfluencerComplaintRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerComplaint::query()->findOrFail($id);
        $this->assertRowAccess($request, $row);

        $before = $row->toArray();
        $data = $request->validated();

        if (isset($data['influencer_id']) || isset($data['influencer_collaboration_id'])) {
            $this->assertRefs($brandId, array_merge($row->toArray(), $data));
        }

        $newStatus = $data['status'] ?? $row->status;
        $notes = $data['resolution_notes'] ?? $row->resolution_notes;
        if (in_array($newStatus, ['resolved', 'closed'], true) && empty($notes)) {
            abort(422, 'resolution_notes is required when status is resolved or closed.');
        }

        if (in_array($newStatus, ['resolved', 'closed'], true)) {
            $data['resolved_at'] = $data['resolved_at'] ?? now();
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_complaints.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer']), 'Complaint updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        ApiBrandContext::resolveBrandId($request);
        $row = InfluencerComplaint::query()->findOrFail($id);
        $this->assertRowAccess($request, $row);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_complaints.delete', null, $before, null);

        return ApiResponse::success(null, 'Complaint deleted successfully.');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertRefs(int $brandId, array $data): void
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

    private function assertRowAccess(Request $request, InfluencerComplaint $row): void
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
