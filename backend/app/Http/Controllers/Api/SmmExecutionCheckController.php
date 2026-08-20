<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmContent;
use App\Models\SmmExecutionCheck;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmExecutionCheckController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);
        $q = SmmExecutionCheck::query()
            ->with(['content:id,title,platform', 'checkedBy:id,name'])
            ->orderByDesc('check_date')->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($date = $request->query('date')) $q->where('check_date', $date);
        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'content_id' => ['nullable', 'integer', 'exists:smm_contents,id'],
            'check_date' => ['required', 'date'],
            'status' => ['required', 'string', 'in:conforme,ecart_constate,ecart_corrige'],
            'deviation_description' => ['nullable', 'string'],
            'has_public_impact' => ['nullable', 'boolean'],
        ]);
        $data['brand_id'] = $brandId;
        $data['checked_by_user_id'] = $request->user()->id;
        $row = SmmExecutionCheck::query()->create($data);
        AuditLogger::log($request, 'smm_exec.create', $row);
        return ApiResponse::success($row, 'Contrôle enregistré.', 201);
    }

    public function correct(Request $request, string $id): JsonResponse
    {
        $row = SmmExecutionCheck::query()->findOrFail($id);
        $data = $request->validate(['correction_note' => ['required', 'string']]);
        $row->status = 'ecart_corrige';
        $row->correction_note = $data['correction_note'];
        $row->corrected_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_exec.correct', $row);
        return ApiResponse::success($row->fresh());
    }

    public function escalate(Request $request, string $id): JsonResponse
    {
        $row = SmmExecutionCheck::query()->findOrFail($id);
        $data = $request->validate(['unpublish' => ['nullable', 'boolean']]);
        $row->has_public_impact = true;
        $row->escalated_to_direction = true;
        if (!empty($data['unpublish'])) {
            $row->unpublished = true;
            // Also flip the content back
            if ($row->content_id) {
                SmmContent::query()->where('id', $row->content_id)->update(['status' => 'non_publie', 'not_published_reason' => 'Dépublié suite à écart à impact public']);
            }
        }
        $row->save();
        AuditLogger::log($request, 'smm_exec.escalate', $row);
        return ApiResponse::success($row->fresh());
    }
}
