<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrCareerEvent;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrCareerEventController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrCareerEvent::query()
            ->with(['employee:id,full_name,department', 'evaluation:id,campaign_id', 'decidedBy:id,name'])
            ->orderByDesc('effective_date')
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($employeeId = $request->query('employee_id')) {
            $q->where('employee_id', (int) $employeeId);
        }
        if ($type = $request->query('event_type')) {
            $q->where('event_type', $type);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'event_type' => ['required', 'string', 'max:30'],
            'effective_date' => ['required', 'date'],
            'old_value' => ['nullable', 'string', 'max:255'],
            'new_value' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'evaluation_id' => ['nullable', 'integer', 'exists:hr_evaluations,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['decided_by_user_id'] = $request->user()->id;

        $row = HrCareerEvent::query()->create($data);

        AuditLogger::log($request, 'hr_career_events.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('employee:id,full_name'), 'Événement de carrière enregistré.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrCareerEvent::query()
            ->with(['employee:id,full_name,department', 'evaluation:id,campaign_id,status', 'decidedBy:id,name'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrCareerEvent::query()->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'event_type' => ['nullable', 'string', 'max:30'],
            'effective_date' => ['nullable', 'date'],
            'old_value' => ['nullable', 'string', 'max:255'],
            'new_value' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'evaluation_id' => ['nullable', 'integer', 'exists:hr_evaluations,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_career_events.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Événement mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrCareerEvent::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_career_events.delete', null, $before, null);

        return ApiResponse::success(null, 'Événement supprimé.');
    }
}
