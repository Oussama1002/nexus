<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrTrainingRecord;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrTrainingRecordController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrTrainingRecord::query()
            ->with(['employee:id,full_name,department', 'requestedBy:id,name'])
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($employeeId = $request->query('employee_id')) {
            $q->where('employee_id', (int) $employeeId);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($type = $request->query('training_type')) {
            $q->where('training_type', $type);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'title' => ['required', 'string', 'max:255'],
            'training_type' => ['nullable', 'string', 'max:30'],
            'provider' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'duration_hours' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'string', 'max:20'],
            'description' => ['nullable', 'string'],
            'needs_identified_by' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'planifiee';
        $data['requested_by_user_id'] = $request->user()->id;

        $row = HrTrainingRecord::query()->create($data);

        AuditLogger::log($request, 'hr_training_records.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('employee:id,full_name'), 'Formation ajoutée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrTrainingRecord::query()
            ->with(['employee:id,full_name,department', 'requestedBy:id,name'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrTrainingRecord::query()->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'training_type' => ['nullable', 'string', 'max:30'],
            'provider' => ['nullable', 'string', 'max:255'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'duration_hours' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', 'string', 'max:20'],
            'result' => ['nullable', 'string', 'max:20'],
            'attestation_url' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_training_records.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Formation mise à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrTrainingRecord::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_training_records.delete', null, $before, null);

        return ApiResponse::success(null, 'Formation supprimée.');
    }
}
