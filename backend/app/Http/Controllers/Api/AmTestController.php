<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmTest;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmTestController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmTest::query()
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
            'chantier_id' => 'nullable|integer|exists:am_chantiers,id',
            'hypothesis' => 'required|string|min:5',
            'tested_variable' => 'required|string|max:100',
            'population_or_channel' => 'nullable|string|max:100',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'budget_engaged' => 'nullable|numeric|min:0',
            'success_metric' => 'required|string|max:60',
            'success_threshold' => 'required|numeric',
            'parent_test_id' => 'nullable|integer|exists:am_tests,id',
        ]);
        $row = AmTest::query()->create($data + ['status' => 'planifie']);
        AuditLogger::log($request, 'am_test.created', $row, null, $row->toArray());
        return ApiResponse::success($row, 'Test planifié.', 201);
    }

    public function update(Request $request, int $id)
    {
        $row = AmTest::query()->findOrFail($id);
        $data = $request->validate([
            'status' => 'sometimes|in:planifie,en_cours,termine_sans_verdict,coupe,itere,scale',
            'observed_result' => 'nullable|numeric',
            'end_date' => 'nullable|date',
        ]);
        $before = $row->toArray();
        $row->fill($data)->save();
        AuditLogger::log($request, 'am_test.updated', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    public function verdict(Request $request, int $id)
    {
        $row = AmTest::query()->findOrFail($id);
        $data = $request->validate([
            'verdict' => 'required|in:couper,iterer,scaler',
            'reusable_asset_notes' => 'nullable|string',
        ]);
        $before = $row->only(['verdict', 'status']);
        $row->fill([
            'verdict' => $data['verdict'],
            'reusable_asset_notes' => $data['reusable_asset_notes'] ?? $row->reusable_asset_notes,
            'verdict_at' => now(),
            'verdict_author_user_id' => $request->user()->id,
            'status' => match ($data['verdict']) { 'couper' => 'coupe', 'iterer' => 'itere', 'scaler' => 'scale' },
        ])->save();
        AuditLogger::log($request, 'am_test.verdict', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }
}
