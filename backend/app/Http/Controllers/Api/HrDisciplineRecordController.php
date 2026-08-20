<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrDisciplineRecord;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrDisciplineRecordController extends Controller
{
    private const STATUS_FLOW = [
        'signale', 'instruction', 'entretien', 'decision', 'notification', 'accuse',
    ];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrDisciplineRecord::query()
            ->with(['employee:id,full_name,department', 'decidedBy:id,name'])
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

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'incident_type' => ['required', 'string', 'max:30'],
            'incident_date' => ['required', 'date'],
            'incident_description' => ['required', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = 'signale';

        $row = HrDisciplineRecord::query()->create($data);

        AuditLogger::log($request, 'hr_discipline_records.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('employee:id,full_name'), 'Incident signalé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrDisciplineRecord::query()
            ->with(['employee:id,full_name,department', 'decidedBy:id,name', 'cancelledBy:id,name'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrDisciplineRecord::query()->findOrFail($id);

        if ($row->is_cancelled) {
            return ApiResponse::error('Un dossier annulé ne peut pas être modifié.', null, 422);
        }
        if ($row->status === 'accuse') {
            return ApiResponse::error('Un dossier avec accusé ne peut plus être modifié.', null, 422);
        }

        $before = $row->toArray();

        $data = $request->validate([
            'incident_type' => ['nullable', 'string', 'max:30'],
            'incident_date' => ['nullable', 'date'],
            'incident_description' => ['nullable', 'string'],
            'sanction_type' => ['nullable', 'string', 'max:30'],
            'sanction_description' => ['nullable', 'string'],
            'interview_at' => ['nullable', 'date'],
            'interview_notes' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_discipline_records.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Dossier mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrDisciplineRecord::query()->findOrFail($id);

        if (! in_array($row->status, ['signale', 'instruction'], true)) {
            return ApiResponse::error('Seuls les dossiers en phase initiale peuvent être supprimés.', null, 422);
        }

        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_discipline_records.delete', null, $before, null);

        return ApiResponse::success(null, 'Dossier supprimé.');
    }

    public function transition(Request $request, string $id): JsonResponse
    {
        $row = HrDisciplineRecord::query()->findOrFail($id);

        if ($row->is_cancelled) {
            return ApiResponse::error('Un dossier annulé ne peut pas avancer.', null, 422);
        }

        $before = $row->toArray();

        $data = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', self::STATUS_FLOW)],
            'sanction_type' => ['nullable', 'string', 'max:30'],
            'sanction_description' => ['nullable', 'string'],
            'interview_at' => ['nullable', 'date'],
            'interview_notes' => ['nullable', 'string'],
        ]);

        $row->status = $data['status'];

        if (isset($data['sanction_type'])) {
            $row->sanction_type = $data['sanction_type'];
        }
        if (isset($data['sanction_description'])) {
            $row->sanction_description = $data['sanction_description'];
        }
        if (isset($data['interview_at'])) {
            $row->interview_at = $data['interview_at'];
        }
        if (isset($data['interview_notes'])) {
            $row->interview_notes = $data['interview_notes'];
        }

        if ($data['status'] === 'decision') {
            $row->decided_by_user_id = $request->user()->id;
            $row->decided_at = now();
        }
        if ($data['status'] === 'notification') {
            $row->notified_at = now();
        }
        if ($data['status'] === 'accuse') {
            $row->acknowledged_at = now();
        }

        $row->save();

        AuditLogger::log($request, 'hr_discipline_records.transition', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Statut mis à jour.');
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $row = HrDisciplineRecord::query()->findOrFail($id);

        if ($row->is_cancelled) {
            return ApiResponse::error('Dossier déjà annulé.', null, 422);
        }

        $before = $row->toArray();

        $data = $request->validate([
            'cancellation_reason' => ['required', 'string'],
        ]);

        $row->is_cancelled = true;
        $row->cancellation_reason = $data['cancellation_reason'];
        $row->cancelled_by_user_id = $request->user()->id;
        $row->cancelled_at = now();
        $row->save();

        AuditLogger::log($request, 'hr_discipline_records.cancel', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Dossier annulé.');
    }
}
