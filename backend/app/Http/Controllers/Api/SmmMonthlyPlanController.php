<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmMonthlyPlan;
use App\Models\SmmStrategy;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmMonthlyPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = SmmMonthlyPlan::query()
            ->with(['author:id,name', 'validatedBy:id,name', 'strategy:id,year,quarter'])
            ->withCount('contents')
            ->orderByDesc('year')->orderByDesc('month');

        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'year' => ['required', 'integer'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'strategy_id' => ['required', 'integer', 'exists:smm_strategies,id'],
            'volume_by_platform_json' => ['nullable', 'array'],
            'split_by_format_json' => ['nullable', 'array'],
            'split_by_pillar_json' => ['nullable', 'array'],
            'split_by_finality_json' => ['nullable', 'array'],
            'declared_capacity' => ['nullable', 'integer'],
        ]);
        // Enforce strategy validated
        $strat = SmmStrategy::query()->findOrFail($data['strategy_id']);
        if ($strat->status !== 'validee') {
            return ApiResponse::error('La stratégie liée doit être validée.', null, 422);
        }
        $data['brand_id'] = $brandId;
        $data['author_user_id'] = $request->user()->id;
        $data['status'] = 'brouillon';
        $row = SmmMonthlyPlan::query()->create($data);
        AuditLogger::log($request, 'smm_plan.create', $row);
        return ApiResponse::success($row, 'Plan créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyPlan::query()
            ->with(['author:id,name', 'validatedBy:id,name', 'strategy', 'contents'])
            ->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyPlan::query()->findOrFail($id);
        if ($row->status === 'valide') return ApiResponse::error('Plan validé, non modifiable.', null, 422);
        $data = $request->validate([
            'volume_by_platform_json' => ['nullable', 'array'],
            'split_by_format_json' => ['nullable', 'array'],
            'split_by_pillar_json' => ['nullable', 'array'],
            'split_by_finality_json' => ['nullable', 'array'],
            'declared_capacity' => ['nullable', 'integer'],
        ]);
        $row->fill($data)->save();
        return ApiResponse::success($row->fresh());
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyPlan::query()->with('contents')->findOrFail($id);
        // Each planned content must have concept + assigned_user_id
        foreach ($row->contents as $c) {
            if (empty($c->concept) || empty($c->assigned_user_id)) {
                return ApiResponse::error("Contenu #{$c->id} sans concept ou sans responsable assigné.", null, 422);
            }
        }
        $row->status = 'soumis';
        $row->submitted_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_plan.submit', $row);
        return ApiResponse::success($row->fresh(), 'Plan soumis.');
    }

    public function validateAction(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyPlan::query()->findOrFail($id);
        if ($row->status !== 'soumis') return ApiResponse::error('Non validable.', null, 422);
        if ($row->author_user_id === $request->user()->id) {
            return ApiResponse::error('Auteur ne peut pas être validateur.', null, 422);
        }
        $data = $request->validate(['validation_comment' => ['nullable', 'string']]);
        $row->status = 'valide';
        $row->validated_by_user_id = $request->user()->id;
        $row->validated_at = now();
        $row->validation_comment = $data['validation_comment'] ?? null;
        $row->save();
        AuditLogger::log($request, 'smm_plan.validate', $row);
        return ApiResponse::success($row->fresh(), 'Plan validé.');
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyPlan::query()->findOrFail($id);
        if ($row->status !== 'soumis') return ApiResponse::error('Non rejetable.', null, 422);
        $data = $request->validate(['rejection_reason' => ['required', 'string']]);
        $row->status = 'rejete';
        $row->rejection_reason = $data['rejection_reason'];
        $row->save();
        AuditLogger::log($request, 'smm_plan.reject', $row);
        return ApiResponse::success($row->fresh());
    }

    public function requestModification(Request $request, string $id): JsonResponse
    {
        $row = SmmMonthlyPlan::query()->findOrFail($id);
        if ($row->status !== 'soumis') return ApiResponse::error('Non modifiable.', null, 422);
        $data = $request->validate(['rejection_reason' => ['required', 'string']]);
        $row->status = 'modification_demandee';
        $row->rejection_reason = $data['rejection_reason'];
        $row->save();
        return ApiResponse::success($row->fresh());
    }
}
