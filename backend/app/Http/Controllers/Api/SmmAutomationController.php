<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmAutomation;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmAutomationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = SmmAutomation::query()->with(['createdBy:id,name', 'testedBy:id,name'])->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($platform = $request->query('platform')) $q->where('platform', $platform);
        return ApiResponse::success($q->paginate((int) $request->query('per_page', 25)));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'objective' => ['nullable', 'string', 'max:40'],
            'platform' => ['required', 'string', 'max:40'],
            'trigger_type' => ['required', 'string', 'max:40'],
            'trigger_config' => ['nullable', 'string'],
            'flow_steps_json' => ['nullable', 'array'],
            'messages_json' => ['nullable', 'array'],
            'call_to_action_links' => ['nullable', 'string'],
            'linked_content_ids_json' => ['nullable', 'array'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()->id;
        $data['status'] = 'brouillon';
        $row = SmmAutomation::query()->create($data);
        AuditLogger::log($request, 'smm_auto.create', $row);
        return ApiResponse::success($row, 'Automatisation créée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = SmmAutomation::query()->with(['createdBy:id,name', 'testedBy:id,name', 'contents:id,title'])->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = SmmAutomation::query()->findOrFail($id);
        if ($row->status === 'active') return ApiResponse::error('Suspendre avant modification.', null, 422);
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'objective' => ['nullable', 'string', 'max:40'],
            'trigger_type' => ['nullable', 'string', 'max:40'],
            'trigger_config' => ['nullable', 'string'],
            'flow_steps_json' => ['nullable', 'array'],
            'messages_json' => ['nullable', 'array'],
            'call_to_action_links' => ['nullable', 'string'],
            'linked_content_ids_json' => ['nullable', 'array'],
        ]);
        $row->fill($data)->save();
        return ApiResponse::success($row->fresh());
    }

    public function recordTest(Request $request, string $id): JsonResponse
    {
        $row = SmmAutomation::query()->findOrFail($id);
        $data = $request->validate(['test_notes' => ['nullable', 'string']]);
        $row->status = 'en_test';
        $row->test_recorded = true;
        $row->tested_at = now();
        $row->tested_by_user_id = $request->user()->id;
        if (!empty($data['test_notes'])) {
            $kpis = $row->kpis_json ?? [];
            $kpis['test_notes'] = $data['test_notes'];
            $row->kpis_json = $kpis;
        }
        $row->save();
        AuditLogger::log($request, 'smm_auto.test', $row);
        return ApiResponse::success($row->fresh(), 'Test enregistré.');
    }

    public function activate(Request $request, string $id): JsonResponse
    {
        $row = SmmAutomation::query()->findOrFail($id);
        if (!$row->test_recorded) return ApiResponse::error('Test requis avant activation.', null, 422);
        $row->status = 'active';
        $row->activated_at = now();
        $row->activated_by_user_id = $request->user()->id;
        $row->save();
        AuditLogger::log($request, 'smm_auto.activate', $row);
        return ApiResponse::success($row->fresh(), 'Automatisation activée.');
    }

    public function suspend(Request $request, string $id): JsonResponse
    {
        $row = SmmAutomation::query()->findOrFail($id);
        $data = $request->validate(['suspension_reason' => ['required', 'string']]);
        $row->status = 'suspendue';
        $row->suspended_at = now();
        $row->suspended_by_user_id = $request->user()->id;
        $row->suspension_reason = $data['suspension_reason'];
        $row->save();
        AuditLogger::log($request, 'smm_auto.suspend', $row);
        return ApiResponse::success($row->fresh(), 'Automatisation suspendue.');
    }

    public function archive(Request $request, string $id): JsonResponse
    {
        $row = SmmAutomation::query()->findOrFail($id);
        $row->status = 'archivee';
        $row->save();
        return ApiResponse::success($row->fresh());
    }
}
