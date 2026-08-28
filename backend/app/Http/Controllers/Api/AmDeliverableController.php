<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmDeliverable;
use App\Models\AmDeliverableVersion;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmDeliverableController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmDeliverable::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('chantier_id'), fn ($q) => $q->where('chantier_id', $request->integer('chantier_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['qaCheck'])
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function show(int $id)
    {
        $row = AmDeliverable::query()->with(['versions', 'qaCheck'])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'chantier_id' => 'required|integer|exists:am_chantiers,id',
            'brand_id' => 'required|integer|exists:brands,id',
            'label' => 'required|string|max:255',
            'deliverable_type' => 'required|string|max:60',
            'expected_description' => 'nullable|string',
            'producer_user_id' => 'nullable|integer|exists:users,id',
            'deadline' => 'nullable|date',
            'is_mandatory' => 'nullable|boolean',
        ]);
        $row = AmDeliverable::query()->create($data + ['status' => 'a_produire']);
        AuditLogger::log($request, 'am_deliverable.created', $row, null, $row->toArray());
        return ApiResponse::success($row, 'Livrable créé.', 201);
    }

    public function update(Request $request, int $id)
    {
        $row = AmDeliverable::query()->findOrFail($id);
        $data = $request->validate([
            'label' => 'sometimes|string|max:255',
            'expected_description' => 'nullable|string',
            'producer_user_id' => 'nullable|integer|exists:users,id',
            'deadline' => 'nullable|date',
            'status' => 'sometimes|in:a_produire,en_production,depose,en_controle,valide,a_corriger,refuse,obsolete',
            'refusal_reason' => 'nullable|string',
        ]);
        $before = $row->toArray();
        $row->fill($data)->save();
        AuditLogger::log($request, 'am_deliverable.updated', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    public function uploadVersion(Request $request, int $id)
    {
        $row = AmDeliverable::query()->findOrFail($id);
        $data = $request->validate([
            'version_label' => 'required|string|max:20',
            'asset_url' => 'required|string|max:500',
            'notes' => 'nullable|string',
        ]);
        $ver = AmDeliverableVersion::query()->create([
            'deliverable_id' => $row->id,
            'version_label' => $data['version_label'],
            'asset_url' => $data['asset_url'],
            'uploaded_by_user_id' => $request->user()->id,
            'uploaded_at' => now(),
            'notes' => $data['notes'] ?? null,
        ]);
        $row->update([
            'current_version' => $data['version_label'],
            'current_asset_url' => $data['asset_url'],
            'status' => 'depose',
        ]);
        AuditLogger::log($request, 'am_deliverable.version_uploaded', $row, null, $ver->toArray());
        return ApiResponse::success(['deliverable' => $row->fresh(), 'version' => $ver], null, 201);
    }

    public function validateDeliverable(Request $request, int $id)
    {
        $row = AmDeliverable::query()->findOrFail($id);
        if (! in_array($row->status, ['depose', 'en_controle', 'a_corriger'], true)) {
            return ApiResponse::error('Livrable non validable dans son état actuel.', null, 422);
        }
        $before = $row->only(['status', 'validated_by_user_id', 'validated_at']);
        $row->fill([
            'status' => 'valide',
            'validated_by_user_id' => $request->user()->id,
            'validated_at' => now(),
        ])->save();
        AuditLogger::log($request, 'am_deliverable.validated', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }
}
