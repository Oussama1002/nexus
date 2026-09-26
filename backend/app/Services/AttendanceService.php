<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\EmployeeAttendanceRecord;
use App\Models\InternalMessage;
use App\Models\User;
use Carbon\Carbon;

class AttendanceService
{
    // The app stores timestamps in UTC, but schedules ("09:00") are Moroccan local time.
    public const TIMEZONE = 'Africa/Casablanca';

    // work_days are saved in French (lundi…), Carbon gives English day names.
    private const DAYS_FR = [
        'monday' => 'lundi', 'tuesday' => 'mardi', 'wednesday' => 'mercredi', 'thursday' => 'jeudi',
        'friday' => 'vendredi', 'saturday' => 'samedi', 'sunday' => 'dimanche',
    ];

    public function recordLoginAttendance(User $user): ?EmployeeAttendanceRecord
    {
        $employee = Employee::query()->where('user_id', $user->id)->first();
        if (! $employee) {
            return null;
        }

        if (! $employee->work_start_time) {
            return null;
        }

        $now = Carbon::now(self::TIMEZONE);
        $today = $now->copy()->startOfDay();

        if ($employee->work_days && is_array($employee->work_days)) {
            $normalizedDays = array_map('strtolower', $employee->work_days);
            $dayEn = strtolower($today->locale('en')->dayName);
            if (! in_array($dayEn, $normalizedDays, true) && ! in_array(self::DAYS_FR[$dayEn], $normalizedDays, true)) {
                return null;
            }
        }

        $existing = EmployeeAttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->where('attendance_date', $today->toDateString())
            ->first();

        if ($existing && $existing->clock_in_at) {
            // Logged out earlier today and back again: the day is open again.
            if ($existing->clock_out_at) {
                $existing->update(['clock_out_at' => null]);
            }

            return $existing;
        }

        $scheduledStart = Carbon::parse($today->toDateString().' '.$employee->work_start_time, self::TIMEZONE);

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

        $clockIn = $now->copy()->utc();

        if ($existing) {
            $existing->update([
                'clock_in_at' => $clockIn,
                'status' => $status,
                'was_late' => $wasLate,
                'minutes_late' => $minutesLate,
            ]);
            if ($wasLate) {
                $this->messageLateEmployee($user, $minutesLate);
            }

            return $existing->fresh();
        }

        $record = EmployeeAttendanceRecord::query()->create([
            'brand_id' => $brandId,
            'employee_id' => $employee->id,
            'user_id' => $user->id,
            'attendance_date' => $today->toDateString(),
            'clock_in_at' => $clockIn,
            'status' => $status,
            'was_late' => $wasLate,
            'minutes_late' => $minutesLate,
        ]);

        // Reached once per employee per day (first clock-in), so the message isn't repeated.
        if ($wasLate) {
            $this->messageLateEmployee($user, $minutesLate);
        }

        return $record;
    }

    public static function formatLateness(int $minutes): string
    {
        return sprintf('%dh%02dmin', intdiv($minutes, 60), $minutes % 60);
    }

    /** Automatic DM from the administrator in Communications internes. */
    private function messageLateEmployee(User $user, int $minutesLate): void
    {
        $admin = User::query()
            ->whereHas('roles', fn ($q) => $q->where('slug', 'admin'))
            ->where('id', '!=', $user->id)
            ->orderBy('id')
            ->first();
        if (! $admin) {
            return;
        }

        try {
            InternalMessage::query()->create([
                'sender_id' => $admin->id,
                'receiver_id' => $user->id,
                'body' => "Bonjour {$user->name}, vous avez pointé aujourd’hui avec un retard de ".self::formatLateness($minutesLate)
                    .'. Merci de respecter vos horaires et de justifier ce retard si nécessaire.',
            ]);
        } catch (\Throwable $e) {
            // Never break the login over a chat message.
            \Illuminate\Support\Facades\Log::warning('attendance.late_message_failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function recordLogout(User $user): void
    {
        $employee = Employee::query()->where('user_id', $user->id)->first();
        if (! $employee) {
            return;
        }

        EmployeeAttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->where('attendance_date', Carbon::now(self::TIMEZONE)->toDateString())
            ->whereNotNull('clock_in_at')
            ->update(['clock_out_at' => Carbon::now()->utc()]);
    }
}
