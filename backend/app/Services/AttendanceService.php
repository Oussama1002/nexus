<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeAttendanceRecord;
use App\Models\User;
use Carbon\Carbon;

class AttendanceService
{
    public function recordLoginAttendance(User $user): ?EmployeeAttendanceRecord
    {
        $employee = Employee::query()->where('user_id', $user->id)->first();
        if (! $employee) {
            return null;
        }

        if (! $employee->work_start_time) {
            return null;
        }

        $today = Carbon::today();
        $dayName = strtolower($today->locale('en')->dayName);

        if ($employee->work_days && is_array($employee->work_days)) {
            $normalizedDays = array_map('strtolower', $employee->work_days);
            if (! in_array($dayName, $normalizedDays, true)) {
                return null;
            }
        }

        $existing = EmployeeAttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->where('attendance_date', $today->toDateString())
            ->first();

        if ($existing && $existing->clock_in_at) {
            return $existing;
        }

        $now = Carbon::now();
        $scheduledStart = Carbon::parse($today->toDateString().' '.$employee->work_start_time);

        $minutesLate = 0;
        $wasLate = false;
        $status = 'present';

        if ($now->greaterThan($scheduledStart)) {
            $minutesLate = (int) $scheduledStart->diffInMinutes($now);
            if ($minutesLate >= 1) {
                $wasLate = true;
                $status = 'late';
            }
        }

        $brandId = $employee->brand_id;
        if (! $brandId) {
            $firstBrand = $employee->brands()->first();
            $brandId = $firstBrand?->id;
        }
        if (! $brandId) {
            $firstBrand = $user->brands()->first();
            $brandId = $firstBrand?->id;
        }
        if (! $brandId) {
            return null;
        }

        if ($existing) {
            $existing->update([
                'clock_in_at' => $now,
                'status' => $status,
                'was_late' => $wasLate,
                'minutes_late' => $minutesLate,
            ]);

            return $existing->fresh();
        }

        return EmployeeAttendanceRecord::query()->create([
            'brand_id' => $brandId,
            'employee_id' => $employee->id,
            'user_id' => $user->id,
            'attendance_date' => $today->toDateString(),
            'clock_in_at' => $now,
            'status' => $status,
            'was_late' => $wasLate,
            'minutes_late' => $minutesLate,
        ]);
    }
}
