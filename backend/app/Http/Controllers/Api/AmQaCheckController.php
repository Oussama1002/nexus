<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmDeliverable;
use App\Models\AmQaCheck;
use App\Models\AmQaGridTemplate;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmQaCheckController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'deliverable_id' => 'required|integer|exists:am_deliverables,id',
            'grid_template_id' => 'required|integer|exists:am_qa_grid_templates,id',
            'criteria_scores_json' => 'required|array',
            'verdict' => 'required|in:valide,a_corriger,refuse',
            'score' => 'nullable|numeric|between:0,100',
            'comment' => 'nullable|string',
        ]);

        $row = AmQaCheck::query()->create($data + [
            'checked_by_user_id' => $request->user()->id,
            'checked_at' => now(),
        ]);

        // Reflect verdict onto the deliverable
        $del = AmDeliverable::query()->find($data['deliverable_id']);
        $newStatus = match ($data['verdict']) {
            'valide' => 'valide',
            'a_corriger' => 'a_corriger',
            'refuse' => 'refuse',
        };
        $del->fill(['status' => $newStatus])->save();
        AuditLogger::log($request, 'am_qa_check.recorded', $row, null, $row->toArray());
        return ApiResponse::success(['qa_check' => $row, 'deliverable' => $del->fresh()], 'Contrôle qualité enregistré.', 201);
    }

    public function grids(Request $request)
    {
        $type = $request->string('deliverable_type')->toString();
        $rows = AmQaGridTemplate::query()->where('is_active', true)
            ->when($type !== '', fn ($q) => $q->where('deliverable_type', $type))
            ->get();
        return ApiResponse::success($rows);
    }
}
