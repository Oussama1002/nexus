<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmGate;
use App\Models\AmGateCriterion;
use App\Services\Am\AmGateService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AmGateController extends Controller
{
    public function __construct(private readonly AmGateService $svc) {}

    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmGate::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('roadmap_id'), fn ($q) => $q->where('roadmap_id', $request->integer('roadmap_id')))
            ->with(['template', 'criteria.template', 'derogations'])
            ->orderBy('code')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function show(int $id)
    {
        $row = AmGate::query()->with(['template', 'criteria.template', 'derogations'])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function updateCriterion(Request $request, int $criterionId)
    {
        $crit = AmGateCriterion::query()->findOrFail($criterionId);
        $data = $request->validate([
            'status' => 'required|in:satisfait,non_satisfait,indisponible',
            'observed_value' => 'nullable|numeric',
            'attestation_comment' => 'nullable|string',
        ]);
        $before = $crit->only(['status', 'observed_value']);
        $crit->fill(array_merge($data, [
            'evaluated_at' => now(),
            'attested_by_user_id' => $request->user()->id,
            'attested_at' => now(),
        ]))->save();
        \App\Services\AuditLogger::log($request, 'am_gate_criterion.updated', $crit, $before, $crit->fresh()->toArray());
        return ApiResponse::success($crit->fresh());
    }

    public function requestTransit(Request $request, int $id)
    {
        $gate = AmGate::query()->findOrFail($id);
        try {
            $gate = $this->svc->requestTransit($gate, $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($gate);
    }

    public function validateTransit(Request $request, int $id)
    {
        $gate = AmGate::query()->findOrFail($id);
        try {
            $gate = $this->svc->validateTransit($gate, $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($gate);
    }

    public function refuseTransit(Request $request, int $id)
    {
        $gate = AmGate::query()->findOrFail($id);
        $data = $request->validate(['reason' => 'required|string|min:3']);
        try {
            $gate = $this->svc->refuseTransit($gate, $request->user(), $data['reason'], $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($gate);
    }
}
