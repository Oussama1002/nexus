<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmBrandObjective;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmBrandObjectiveController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmBrandObjective::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('period'), fn ($q) => $q->where('period', $request->string('period')))
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'brand_id' => 'required|integer|exists:brands,id',
            'period' => 'required|string|max:20',
            'metric_code' => 'required|string|max:60',
            'target_value' => 'required|numeric',
        ]);
        $row = AmBrandObjective::query()->updateOrCreate(
            ['brand_id' => $data['brand_id'], 'period' => $data['period'], 'metric_code' => $data['metric_code']],
            $data + ['set_by_user_id' => $request->user()->id],
        );
        AuditLogger::log($request, 'am_brand_objective.set', $row, null, $row->toArray());
        return ApiResponse::success($row, 'Objectif défini.', 201);
    }

    public function update(Request $request, int $id)
    {
        $row = AmBrandObjective::query()->findOrFail($id);
        $data = $request->validate([
            'target_value' => 'sometimes|numeric',
            'observed_value' => 'nullable|numeric',
        ]);
        $before = $row->toArray();
        $row->fill($data)->save();
        AuditLogger::log($request, 'am_brand_objective.updated', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }
}
