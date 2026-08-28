<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmChantier;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmChantierController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmChantier::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('roadmap_id'), fn ($q) => $q->where('roadmap_id', $request->integer('roadmap_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->with(['template:id,code,label', 'owner:id,name'])
            ->orderBy('code')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function show(int $id)
    {
        $row = AmChantier::query()->with(['template', 'owner:id,name', 'gates', 'deliverables'])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function update(Request $request, int $id)
    {
        $row = AmChantier::query()->findOrFail($id);
        $data = $request->validate([
            'status' => 'sometimes|in:verrouille,ouvert,en_cours,en_validation,franchi,bloque,abandonne',
            'owner_user_id' => 'nullable|integer|exists:users,id',
            'deadline' => 'nullable|date',
            'steps_state_json' => 'nullable|array',
            'lock_reason' => 'nullable|string',
        ]);
        $before = $row->toArray();
        $row->fill($data)->save();
        AuditLogger::log($request, 'am_chantier.updated', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }
}
