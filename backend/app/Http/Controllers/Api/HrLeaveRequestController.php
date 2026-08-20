<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\HrLeaveRequest;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrLeaveRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrLeaveRequest::query()
            ->with(['employee:id,full_name,department', 'approvedBy:id,name'])
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
        if ($leaveType = $request->query('leave_type')) {
            $q->where('leave_type', $leaveType);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'leave_type' => ['required', 'string', 'max:30'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'days_count' => ['required', 'numeric', 'min:0.5'],
            'reason' => ['nullable', 'string'],
            'attachment_url' => ['nullable', 'string', 'max:500'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = 'en_attente';

        $row = HrLeaveRequest::query()->create($data);

        AuditLogger::log($request, 'hr_leave_requests.create', $row, null, $row->toArray());

        return ApiResponse::success(
            $row->fresh()->load(['employee:id,full_name', 'approvedBy:id,name']),
            'Demande de congé créée.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrLeaveRequest::query()
            ->with(['employee:id,full_name,department,leave_balance_days', 'approvedBy:id,name'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrLeaveRequest::query()->findOrFail($id);

        if ($row->status !== 'en_attente') {
            return ApiResponse::error('Seules les demandes en attente peuvent être modifiées.', null, 422);
        }

        $before = $row->toArray();

        $data = $request->validate([
            'leave_type' => ['nullable', 'string', 'max:30'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'days_count' => ['nullable', 'numeric', 'min:0.5'],
            'reason' => ['nullable', 'string'],
            'attachment_url' => ['nullable', 'string', 'max:500'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_leave_requests.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Demande mise à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrLeaveRequest::query()->findOrFail($id);

        if ($row->status !== 'en_attente') {
            return ApiResponse::error('Seules les demandes en attente peuvent être supprimées.', null, 422);
        }

        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_leave_requests.delete', null, $before, null);

        return ApiResponse::success(null, 'Demande supprimée.');
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $row = HrLeaveRequest::query()->findOrFail($id);

        if ($row->status !== 'en_attente') {
            return ApiResponse::error('Cette demande ne peut plus être approuvée.', null, 422);
        }

        $before = $row->toArray();
        $data = $request->validate([
            'approval_comment' => ['nullable', 'string'],
        ]);

        $row->status = 'approuve';
        $row->approved_by_user_id = $request->user()->id;
        $row->approved_at = now();
        $row->approval_comment = $data['approval_comment'] ?? null;
        $row->save();

        $employee = Employee::query()->find($row->employee_id);
        if ($employee) {
            $employee->decrement('leave_balance_days', $row->days_count);
        }

        AuditLogger::log($request, 'hr_leave_requests.approve', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['employee:id,full_name', 'approvedBy:id,name']), 'Congé approuvé.');
    }

    public function refuse(Request $request, string $id): JsonResponse
    {
        $row = HrLeaveRequest::query()->findOrFail($id);

        if ($row->status !== 'en_attente') {
            return ApiResponse::error('Cette demande ne peut plus être refusée.', null, 422);
        }

        $before = $row->toArray();
        $data = $request->validate([
            'refusal_reason' => ['required', 'string'],
        ]);

        $row->status = 'refuse';
        $row->approved_by_user_id = $request->user()->id;
        $row->approved_at = now();
        $row->refusal_reason = $data['refusal_reason'];
        $row->save();

        AuditLogger::log($request, 'hr_leave_requests.refuse', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Congé refusé.');
    }
}
