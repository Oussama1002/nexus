<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrEvaluation;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrEvaluationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrEvaluation::query()
            ->with(['employee:id,full_name,department', 'campaign:id,title,year', 'evaluator:id,name'])
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($campaignId = $request->query('campaign_id')) {
            $q->where('campaign_id', (int) $campaignId);
        }
        if ($employeeId = $request->query('employee_id')) {
            $q->where('employee_id', (int) $employeeId);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'campaign_id' => ['nullable', 'integer', 'exists:hr_evaluation_campaigns,id'],
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'evaluator_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'objectives_json' => ['nullable', 'array'],
            'interview_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = 'en_preparation';

        $row = HrEvaluation::query()->create($data);

        AuditLogger::log($request, 'hr_evaluations.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['employee:id,full_name', 'campaign:id,title']), 'Évaluation créée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluation::query()
            ->with(['employee:id,full_name,department', 'campaign:id,title,year', 'evaluator:id,name', 'careerEvents'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluation::query()->findOrFail($id);

        if ($row->status === 'finalise') {
            return ApiResponse::error('Une évaluation finalisée ne peut pas être modifiée.', null, 422);
        }

        $before = $row->toArray();

        $data = $request->validate([
            'evaluator_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'objectives_json' => ['nullable', 'array'],
            'results_json' => ['nullable', 'array'],
            'manager_appreciation' => ['nullable', 'string'],
            'overall_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'employee_comment' => ['nullable', 'string'],
            'recommendation' => ['nullable', 'string', 'max:30'],
            'status' => ['nullable', 'string', 'max:20'],
            'interview_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_evaluations.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Évaluation mise à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluation::query()->findOrFail($id);

        if ($row->status === 'finalise') {
            return ApiResponse::error('Une évaluation finalisée ne peut pas être supprimée.', null, 422);
        }

        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_evaluations.delete', null, $before, null);

        return ApiResponse::success(null, 'Évaluation supprimée.');
    }

    public function signEmployee(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluation::query()->findOrFail($id);
        $before = $row->toArray();

        $row->signed_by_employee_at = now();
        $row->save();

        AuditLogger::log($request, 'hr_evaluations.sign_employee', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Signature employé enregistrée.');
    }

    public function signManager(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluation::query()->findOrFail($id);
        $before = $row->toArray();

        $row->signed_by_manager_at = now();
        $row->save();

        AuditLogger::log($request, 'hr_evaluations.sign_manager', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Signature manager enregistrée.');
    }

    public function finalize(Request $request, string $id): JsonResponse
    {
        $row = HrEvaluation::query()->findOrFail($id);

        if ($row->status === 'finalise') {
            return ApiResponse::error('Évaluation déjà finalisée.', null, 422);
        }

        $before = $row->toArray();

        $row->status = 'finalise';
        $row->finalized_at = now();
        $row->save();

        AuditLogger::log($request, 'hr_evaluations.finalize', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Évaluation finalisée.');
    }
}
