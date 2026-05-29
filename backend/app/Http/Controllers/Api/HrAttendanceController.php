<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAttendanceRecord;
use App\Services\AuditService;
use App\Services\AutomationEngineService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class HrAttendanceController extends Controller
{
    public function __construct(
        private readonly AutomationEngineService $automationEngine
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'hr.view');
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);
        $date = $request->query('date');
        $status = $request->query('status');
        $employeeId = $request->query('employee_id');

        $q = EmployeeAttendanceRecord::query()
            ->with(['employee:id,full_name,user_id,salary,status', 'managerMarkedBy:id,name', 'user:id,name'])
            ->where('brand_id', $brandId)
            ->orderByDesc('attendance_date')
            ->orderByDesc('id');

        if ($date) {
            $q->whereDate('attendance_date', (string) $date);
        }
        if ($status) {
            $q->where('status', (string) $status);
        }
        if ($employeeId) {
            $q->where('employee_id', (int) $employeeId);
        }

        return ApiResponse::success($q->paginate($perPage), 'Attendance records retrieved successfully.');
    }

    public function clockIn(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $userId = $request->user()?->id;
        if (! $userId) {
            return ApiResponse::error('Utilisateur introuvable.', null, 401);
        }

        $employee = $this->findEmployeeForUserAndBrand($userId, $brandId);
        if (! $employee) {
            return ApiResponse::error('Aucun dossier employe lie a cet utilisateur pour cette marque.', null, 422);
        }

        $now = now();
        $date = $now->toDateString();
        $start = Carbon::parse($date.' 09:00:00', $now->timezone);
        $minutesLate = max(0, $start->diffInMinutes($now, false) * -1);
        $isLate = $now->gt($start);
        if ($isLate) {
            $minutesLate = $start->diffInMinutes($now);
        } else {
            $minutesLate = 0;
        }

        $record = EmployeeAttendanceRecord::query()->firstOrNew([
            'employee_id' => $employee->id,
            'attendance_date' => $date,
        ]);

        if ($record->exists && $record->clock_in_at) {
            return ApiResponse::error('Pointage deja enregistre pour aujourd hui.', null, 422);
        }

        $record->brand_id = $brandId;
        $record->user_id = $userId;
        $record->clock_in_at = $now;
        $record->status = $isLate ? 'late' : 'present';
        $record->was_late = $isLate;
        $record->minutes_late = $minutesLate;
        $record->justification_status = 'pending';
        $record->save();

        AuditService::log($request, 'attendance.clock_in', $record, null, $record->toArray());
        $this->automationEngine->runForEvent($brandId, 'attendance.marked', [
            'employee_id' => $employee->id,
            'attendance_record_id' => $record->id,
            'attendance_date' => $date,
            'status' => $record->status,
            'minutes_late' => $record->minutes_late,
            'was_late' => (bool) $record->was_late,
            'clock_in_at' => $record->clock_in_at?->toIso8601String(),
        ]);

        return ApiResponse::success(
            $record->fresh(['employee:id,full_name']),
            $isLate
                ? sprintf('Pointage enregistre: retard de %d minute(s).', $minutesLate)
                : 'Pointage enregistre: a l heure.'
        );
    }

    public function managerMark(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'hr.update');
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'attendance_date' => ['required', 'date'],
            'status' => ['required', 'in:present,late,absent'],
            'minutes_late' => ['nullable', 'integer', 'min:0'],
            'justification_reason' => ['nullable', 'string', 'max:4000'],
            'justification_attachment_url' => ['nullable', 'url', 'max:2048'],
            'justification_status' => ['nullable', 'in:pending,justified,unjustified'],
        ]);

        $employee = Employee::query()->where('id', (int) $data['employee_id'])->where('brand_id', $brandId)->first();
        if (! $employee) {
            return ApiResponse::error('Employe invalide pour cette marque.', null, 422);
        }

        $record = EmployeeAttendanceRecord::query()->firstOrNew([
            'employee_id' => $employee->id,
            'attendance_date' => $data['attendance_date'],
        ]);
        $before = $record->exists ? $record->toArray() : null;

        $record->brand_id = $brandId;
        $record->user_id = $employee->user_id;
        $record->status = (string) $data['status'];
        $record->was_late = $record->status === 'late';
        $record->minutes_late = $record->status === 'late' ? (int) ($data['minutes_late'] ?? 0) : 0;
        $record->manager_marked_by_user_id = $request->user()?->id;
        $record->manager_marked_at = now();
        if ($record->status === 'absent') {
            $record->absent_notified_manager_at = now();
        }
        if (array_key_exists('justification_reason', $data)) {
            $record->justification_reason = $data['justification_reason'];
        }
        if (array_key_exists('justification_attachment_url', $data)) {
            $record->justification_attachment_url = $data['justification_attachment_url'];
        }
        if (array_key_exists('justification_status', $data) && $data['justification_status']) {
            $record->justification_status = $data['justification_status'];
        } elseif (! $record->exists && $record->status === 'absent') {
            $record->justification_status = 'pending';
        }
        $record->save();

        AuditService::log($request, 'attendance.manager_mark', $record, $before, $record->fresh()->toArray());
        $this->automationEngine->runForEvent($brandId, 'attendance.marked', [
            'employee_id' => $employee->id,
            'attendance_record_id' => $record->id,
            'attendance_date' => (string) $record->attendance_date?->toDateString(),
            'status' => $record->status,
            'minutes_late' => $record->minutes_late,
            'was_late' => (bool) $record->was_late,
            'clock_in_at' => $record->clock_in_at?->toIso8601String(),
            'manager_marked' => true,
            'justification_status' => $record->justification_status,
        ]);

        $msg = $record->status === 'absent'
            ? 'Absence enregistree. Notification manager creee pour verification.'
            : 'Pointage journalier mis a jour.';

        return ApiResponse::success($record->fresh(['employee:id,full_name']), $msg);
    }

    public function justify(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $record = EmployeeAttendanceRecord::query()
            ->with('employee:id,user_id,brand_id')
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $isManager = $request->user()?->hasPermissionSlug('hr.update') ?? false;
        $isOwner = $record->employee?->user_id === $request->user()?->id;
        if (! $isManager && ! $isOwner) {
            throw new AccessDeniedHttpException('Forbidden.');
        }

        $rules = [
            'justification_reason' => ['required', 'string', 'max:4000'],
            'justification_attachment_url' => ['nullable', 'url', 'max:2048'],
        ];
        if ($isManager) {
            $rules['justification_status'] = ['nullable', 'in:pending,justified,unjustified'];
        }
        $data = $request->validate($rules);
        $before = $record->toArray();

        $record->justification_reason = $data['justification_reason'];
        $record->justification_attachment_url = $data['justification_attachment_url'] ?? null;
        if ($isManager && ! empty($data['justification_status'])) {
            $record->justification_status = $data['justification_status'];
        } else {
            $record->justification_status = 'pending';
        }
        $record->save();

        AuditService::log($request, 'attendance.justify', $record, $before, $record->fresh()->toArray());

        return ApiResponse::success($record->fresh(['employee:id,full_name']), 'Justification enregistree.');
    }

    public function payrollSummary(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'hr.view');
        $brandId = ApiBrandContext::resolveBrandId($request);
        $month = (string) $request->query('month', now()->format('Y-m'));
        $start = Carbon::createFromFormat('Y-m', $month)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        $employees = Employee::query()
            ->where('brand_id', $brandId)
            ->whereIn('status', ['active', 'inactive'])
            ->get(['id', 'full_name', 'salary', 'status']);

        $rows = [];
        foreach ($employees as $employee) {
            $records = EmployeeAttendanceRecord::query()
                ->where('employee_id', $employee->id)
                ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
                ->get(['status', 'justification_status']);

            $present = $records->whereIn('status', ['present', 'late'])->count();
            $late = $records->where('status', 'late')->count();
            $absent = $records->where('status', 'absent')->count();
            $unjustified = $records->filter(
                fn (EmployeeAttendanceRecord $r) => $r->status === 'absent' && $r->justification_status !== 'justified'
            )->count();

            $baseSalary = (float) ($employee->salary ?? 0);
            $dailyRate = $baseSalary > 0 ? round($baseSalary / 26, 2) : 0;
            $absenceDeduction = round($dailyRate * $unjustified, 2);
            $estimatedNet = max(0, round($baseSalary - $absenceDeduction, 2));

            $rows[] = [
                'employee_id' => $employee->id,
                'full_name' => $employee->full_name,
                'base_salary' => $baseSalary,
                'present_days' => $present,
                'late_days' => $late,
                'absent_days' => $absent,
                'unjustified_absences' => $unjustified,
                'absence_deduction' => $absenceDeduction,
                'estimated_net_salary' => $estimatedNet,
            ];
        }

        return ApiResponse::success([
            'month' => $start->format('Y-m'),
            'period' => ['from' => $start->toDateString(), 'to' => $end->toDateString()],
            'employees' => $rows,
        ], 'Payroll summary generated.');
    }

    private function findEmployeeForUserAndBrand(int $userId, int $brandId): ?Employee
    {
        return Employee::query()
            ->where('user_id', $userId)
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->orderByRaw('brand_id IS NULL')
            ->first();
    }

    private function requirePermission(Request $request, string $slug): void
    {
        if (! $request->user()?->hasPermissionSlug($slug)) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
