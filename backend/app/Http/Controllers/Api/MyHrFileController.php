<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeAttendanceRecord;
use App\Models\HrLeaveRequest;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MyHrFileController extends Controller
{
    /**
     * Dossier personnel de l'employé connecté (spec confirmatrice) : sa fiche,
     * sa présence/pointage et ses congés. Accessible sans permission RH : chacun
     * ne voit que ses propres données.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $employee = Employee::query()->where('user_id', $user->id)->first();

        // Présence & pointage (60 derniers enregistrements).
        $records = EmployeeAttendanceRecord::query()
            ->where('user_id', $user->id)
            ->orderByDesc('attendance_date')
            ->limit(60)
            ->get(['id', 'attendance_date', 'clock_in_at', 'clock_out_at', 'status', 'was_late', 'minutes_late', 'justification_status']);

        // Résumé du mois en cours.
        $monthStart = now()->startOfMonth()->toDateString();
        $monthRecords = EmployeeAttendanceRecord::query()
            ->where('user_id', $user->id)
            ->where('attendance_date', '>=', $monthStart)
            ->get(['status', 'was_late']);

        $summary = [
            'present' => $monthRecords->where('status', 'present')->count(),
            'late' => $monthRecords->where('was_late', true)->count(),
            'absent' => $monthRecords->where('status', 'absent')->count(),
            'total' => $monthRecords->count(),
        ];

        // Congés / absences de l'employé.
        $leaves = [];
        if ($employee) {
            $leaves = HrLeaveRequest::query()
                ->where('employee_id', $employee->id)
                ->orderByDesc('id')
                ->limit(30)
                ->get(['id', 'leave_type', 'start_date', 'end_date', 'days_count', 'reason', 'status']);
        }

        return ApiResponse::success([
            'employee' => $employee ? [
                'id' => $employee->id,
                'full_name' => $employee->full_name,
                'role_title' => $employee->role_title,
                'department' => $employee->department,
                'phone' => $employee->phone,
                // Repli sur l'e-mail du compte si la fiche employé n'en a pas.
                'email' => $employee->email ?: $user->email,
                'status' => $employee->status,
            ] : null,
            'attendance' => $records,
            'attendance_summary' => $summary,
            'leaves' => $leaves,
        ], 'Mon dossier.');
    }
}
