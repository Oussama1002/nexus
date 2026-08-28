<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmDerogation;
use App\Models\AmGate;
use App\Services\Am\AmDerogationService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AmDerogationController extends Controller
{
    public function __construct(private readonly AmDerogationService $svc) {}

    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmDerogation::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['gate:id,code,brand_id'])
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'gate_id' => 'required|integer|exists:am_gates,id',
            'request_reason' => 'required|string|min:5',
            'identified_risk' => 'required|string|min:5',
            'compensatory_measure' => 'required|string|min:5',
        ]);
        $gate = AmGate::query()->findOrFail($data['gate_id']);
        $der = $this->svc->request($gate, $data, $request->user(), $request);
        return ApiResponse::success($der, 'Dérogation demandée.', 201);
    }

    public function decide(Request $request, int $id)
    {
        $der = AmDerogation::query()->findOrFail($id);
        $data = $request->validate([
            'decision' => 'required|in:accordee,refusee',
            'reason' => 'required|string|min:3',
            'validity_days' => 'nullable|integer|min:1|max:30',
            'lifting_condition' => 'nullable|string',
        ]);
        try {
            $der = $this->svc->decide($der, $data['decision'], $data['reason'], $data['validity_days'] ?? null, $data['lifting_condition'] ?? null, $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($der);
    }

    public function lift(Request $request, int $id)
    {
        $der = AmDerogation::query()->findOrFail($id);
        $data = $request->validate(['lifting_reason' => 'required|string|min:3']);
        try {
            $der = $this->svc->lift($der, $data['lifting_reason'], $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($der);
    }
}
