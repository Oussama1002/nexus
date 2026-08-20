<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\HrCommunication;
use App\Models\HrCommunicationReceipt;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrCommunicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrCommunication::query()
            ->with(['publishedBy:id,name'])
            ->withCount([
                'receipts',
                'receipts as read_count' => fn ($qq) => $qq->where('is_read', true),
                'receipts as acknowledged_count' => fn ($qq) => $qq->where('is_acknowledged', true),
            ])
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($type = $request->query('comm_type')) {
            $q->where('comm_type', $type);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'comm_type' => ['nullable', 'string', 'max:30'],
            'content' => ['required', 'string'],
            'attachment_url' => ['nullable', 'string', 'max:500'],
            'requires_acknowledgment' => ['nullable', 'boolean'],
            'requires_signature' => ['nullable', 'boolean'],
            'target_audience' => ['nullable', 'string', 'max:30'],
            'target_departments_json' => ['nullable', 'array'],
            'target_employee_ids_json' => ['nullable', 'array'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = 'brouillon';

        $row = HrCommunication::query()->create($data);

        AuditLogger::log($request, 'hr_communications.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh(), 'Communication créée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrCommunication::query()
            ->with(['publishedBy:id,name', 'receipts.employee:id,full_name,department'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrCommunication::query()->findOrFail($id);

        if ($row->status === 'publie') {
            return ApiResponse::error('Une communication publiée ne peut pas être modifiée.', null, 422);
        }

        $before = $row->toArray();

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'comm_type' => ['nullable', 'string', 'max:30'],
            'content' => ['nullable', 'string'],
            'attachment_url' => ['nullable', 'string', 'max:500'],
            'requires_acknowledgment' => ['nullable', 'boolean'],
            'requires_signature' => ['nullable', 'boolean'],
            'target_audience' => ['nullable', 'string', 'max:30'],
            'target_departments_json' => ['nullable', 'array'],
            'target_employee_ids_json' => ['nullable', 'array'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_communications.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Communication mise à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrCommunication::query()->findOrFail($id);

        if ($row->status === 'publie') {
            return ApiResponse::error('Une communication publiée ne peut pas être supprimée.', null, 422);
        }

        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_communications.delete', null, $before, null);

        return ApiResponse::success(null, 'Communication supprimée.');
    }

    public function publish(Request $request, string $id): JsonResponse
    {
        $row = HrCommunication::query()->findOrFail($id);

        if ($row->status === 'publie') {
            return ApiResponse::error('Communication déjà publiée.', null, 422);
        }

        $before = $row->toArray();

        $row->status = 'publie';
        $row->published_by_user_id = $request->user()->id;
        $row->published_at = now();
        $row->save();

        // Generate receipts for target employees
        $employeeIds = $this->resolveTargetEmployees($row);
        foreach ($employeeIds as $empId) {
            HrCommunicationReceipt::query()->updateOrCreate(
                ['communication_id' => $row->id, 'employee_id' => $empId],
                []
            );
        }

        AuditLogger::log($request, 'hr_communications.publish', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->loadCount('receipts'), 'Communication publiée.');
    }

    public function acknowledge(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'signed' => ['nullable', 'boolean'],
        ]);

        $receipt = HrCommunicationReceipt::query()
            ->where('communication_id', $id)
            ->where('employee_id', $data['employee_id'])
            ->firstOrFail();

        $before = $receipt->toArray();

        $receipt->is_read = true;
        $receipt->read_at = $receipt->read_at ?? now();
        $receipt->is_acknowledged = true;
        $receipt->acknowledged_at = now();

        if (! empty($data['signed'])) {
            $receipt->is_signed = true;
            $receipt->signed_at = now();
        }

        $receipt->save();

        AuditLogger::log($request, 'hr_communications.acknowledge', $receipt, $before, $receipt->fresh()->toArray());

        return ApiResponse::success($receipt->fresh(), 'Communication accusée.');
    }

    private function resolveTargetEmployees(HrCommunication $comm): array
    {
        $q = Employee::query()->where('status', 'active');

        if ($comm->brand_id) {
            $q->where(function ($qq) use ($comm) {
                $qq->where('brand_id', $comm->brand_id)
                    ->orWhere('all_brands', true);
            });
        }

        if ($comm->target_audience === 'departments' && ! empty($comm->target_departments_json)) {
            $q->whereIn('department', $comm->target_departments_json);
        } elseif ($comm->target_audience === 'specific' && ! empty($comm->target_employee_ids_json)) {
            $q->whereIn('id', $comm->target_employee_ids_json);
        }

        return $q->pluck('id')->all();
    }
}
