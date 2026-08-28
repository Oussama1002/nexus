<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmClientInsight;
use App\Services\AuditLogger;
use App\Services\Smm\SmmNotificationService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmClientInsightController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = SmmClientInsight::query()->with(['capturedBy:id,name', 'qualifiedBy:id,name'])->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($source = $request->query('source')) $q->where('source', $source);
        if ($type = $request->query('insight_type')) $q->where('insight_type', $type);
        if ($status = $request->query('status')) $q->where('status', $status);
        return ApiResponse::success($q->paginate((int) $request->query('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'source' => ['required', 'string', 'in:call_center,community_manager,reclamation'],
            'insight_type' => ['required', 'string', 'max:30'],
            'verbatim' => ['required', 'string'],
            'captured_on' => ['nullable', 'date'],
            'observed_frequency' => ['nullable', 'integer', 'min:1'],
            'complaint_id' => ['nullable', 'integer'],
        ]);
        $data['brand_id'] = $brandId;
        $data['captured_by_user_id'] = $request->user()->id;
        $data['status'] = 'nouveau';
        $row = SmmClientInsight::query()->create($data);
        AuditLogger::log($request, 'smm_insight.create', $row);
        SmmNotificationService::notifySmm(
            $row->brand_id, 'insight_captured', 'Insight client enregistré',
            "Nouveau {$row->insight_type} depuis {$row->source} — à qualifier.",
            ['insight_id' => $row->id], 'smm_client_insight', $row->id,
        );
        return ApiResponse::success($row, 'Insight enregistré.', 201);
    }

    public function qualify(Request $request, string $id): JsonResponse
    {
        $row = SmmClientInsight::query()->findOrFail($id);
        $data = $request->validate([
            'status' => ['required', 'string', 'in:exploite,ecarte'],
            'exclusion_reason' => ['nullable', 'string'],
            'produced_content_ids_json' => ['nullable', 'array'],
        ]);
        if ($data['status'] === 'ecarte' && empty($data['exclusion_reason'])) {
            return ApiResponse::error('Motif requis pour écarter un insight.', null, 422);
        }
        $row->fill($data);
        $row->qualified_by_user_id = $request->user()->id;
        $row->qualified_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_insight.qualify', $row);
        return ApiResponse::success($row->fresh(), 'Insight qualifié.');
    }

    public function attachContent(Request $request, string $id): JsonResponse
    {
        $row = SmmClientInsight::query()->findOrFail($id);
        $data = $request->validate(['content_id' => ['required', 'integer', 'exists:smm_contents,id']]);
        $row->contents()->syncWithoutDetaching([$data['content_id']]);
        return ApiResponse::success($row->fresh()->load('contents:id,title'));
    }
}
