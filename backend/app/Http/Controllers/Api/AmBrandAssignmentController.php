<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmBrandAssignment;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmBrandAssignmentController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmBrandAssignment::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['user:id,name'])
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'brand_id' => 'required|integer|exists:brands,id',
            'user_id' => 'required|integer|exists:users,id',
            'role_on_brand' => 'required|string|max:40',
            'quotity_percent' => 'nullable|numeric|between:0,100',
            'quotity_hours_per_week' => 'nullable|integer|min:0',
            'starts_at' => 'required|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
        ]);
        $row = AmBrandAssignment::query()->create($data + ['status' => 'active']);
        AuditLogger::log($request, 'am_brand_assignment.created', $row, null, $row->toArray());
        return ApiResponse::success($row, 'Rattachement créé.', 201);
    }

    public function update(Request $request, int $id)
    {
        $row = AmBrandAssignment::query()->findOrFail($id);
        $data = $request->validate([
            'quotity_percent' => 'nullable|numeric|between:0,100',
            'quotity_hours_per_week' => 'nullable|integer|min:0',
            'ends_at' => 'nullable|date',
            'status' => 'sometimes|in:active,terminee',
        ]);
        $before = $row->toArray();
        $row->fill($data)->save();
        AuditLogger::log($request, 'am_brand_assignment.updated', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }
}
