<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmComplianceCheck;
use App\Models\AmDiffusionSuspension;
use App\Services\Am\AmComplianceService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use RuntimeException;

class AmComplianceCheckController extends Controller
{
    public function __construct(private readonly AmComplianceService $svc) {}

    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmComplianceCheck::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'brand_id' => 'required|integer|exists:brands,id',
            'product_id' => 'nullable|integer',
            'market' => 'required|string|max:50',
            'product_type' => 'nullable|in:complement,cosmetique',
            'checkpoints_json' => 'nullable|array',
            'responsible_user_id' => 'nullable|integer|exists:users,id',
            'review_due_date' => 'nullable|date',
        ]);
        $row = AmComplianceCheck::query()->updateOrCreate(
            ['brand_id' => $data['brand_id'], 'product_id' => $data['product_id'] ?? null, 'market' => $data['market']],
            array_merge($data, ['status' => 'a_verifier']),
        );
        return ApiResponse::success($row, 'Contrôle de conformité créé.', 201);
    }

    public function update(Request $request, int $id)
    {
        $row = AmComplianceCheck::query()->findOrFail($id);
        $data = $request->validate([
            'status' => 'sometimes|in:a_verifier,en_verification,conforme,non_conforme,suspendu',
            'checkpoints_json' => 'nullable|array',
            'responsible_user_id' => 'nullable|integer|exists:users,id',
            'last_verified_at' => 'nullable|date',
            'review_due_date' => 'nullable|date',
        ]);
        $row = $this->svc->update($row, $data, $request->user(), $request);
        return ApiResponse::success($row);
    }

    public function suspend(Request $request, int $id)
    {
        $row = AmComplianceCheck::query()->findOrFail($id);
        $data = $request->validate(['reason' => 'required|string|min:3']);
        $sus = $this->svc->suspend($row, $data['reason'], $request->user(), $request);
        return ApiResponse::success($sus, 'Diffusion suspendue.', 201);
    }

    public function lift(Request $request, int $suspensionId)
    {
        $sus = AmDiffusionSuspension::query()->findOrFail($suspensionId);
        $data = $request->validate(['lifting_reason' => 'required|string|min:3']);
        try {
            $sus = $this->svc->lift($sus, $data['lifting_reason'], $request->user(), $request);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }
        return ApiResponse::success($sus);
    }
}
