<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmLearning;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmLearningController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = SmmLearning::query()->with('author:id,name')->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($dim = $request->query('dimension')) $q->where('dimension', $dim);
        if ($period = $request->query('period')) $q->where('period', $period);
        return ApiResponse::success($q->paginate((int) $request->query('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'period' => ['nullable', 'string', 'max:40'],
            'finding' => ['required', 'string'],
            'dimension' => ['nullable', 'string', 'max:30'],
            'justifying_data' => ['nullable', 'string'],
            'recommendation' => ['required', 'string'],
            'recipient_user_ids_json' => ['nullable', 'array'],
        ]);
        $data['brand_id'] = $brandId;
        $data['author_user_id'] = $request->user()->id;
        $row = SmmLearning::query()->create($data);
        AuditLogger::log($request, 'smm_learning.create', $row);
        return ApiResponse::success($row, 'Enseignement enregistré.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = SmmLearning::query()->findOrFail($id);
        $data = $request->validate([
            'finding' => ['nullable', 'string'],
            'recommendation' => ['nullable', 'string'],
            'justifying_data' => ['nullable', 'string'],
            'next_cycle_effect' => ['nullable', 'string'],
            'recipient_user_ids_json' => ['nullable', 'array'],
        ]);
        $row->fill($data)->save();
        return ApiResponse::success($row->fresh());
    }

    public function markCommunicated(Request $request, string $id): JsonResponse
    {
        $row = SmmLearning::query()->findOrFail($id);
        $row->communicated_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_learning.communicated', $row);
        return ApiResponse::success($row->fresh(), 'Recommandation communiquée.');
    }
}
