<?php

namespace App\Console\Commands;

use App\Models\Brand;
use App\Models\Employee;
use App\Models\EmployeeAttendanceRecord;
use App\Services\AttendanceService;
use App\Services\AutomationEngineService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class MarkDailyAbsencesCommand extends Command
{
    protected $signature = 'hr:mark-daily-absences {--date= : Jour à vérifier (YYYY-MM-DD), par défaut aujourd\'hui}';

    protected $description = "Marque 'absent' tout employé actif d'un jour travaillé sans pointage, puis déclenche les règles d'automatisation (dossier disciplinaire, etc.).";

    // work_days sont stockés en français (lundi…), Carbon donne l'anglais.
    private const DAYS_FR = [
        'monday' => 'lundi', 'tuesday' => 'mardi', 'wednesday' => 'mercredi', 'thursday' => 'jeudi',
        'friday' => 'vendredi', 'saturday' => 'samedi', 'sunday' => 'dimanche',
    ];

    public function __construct(
        private readonly AutomationEngineService $automationEngine,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $tz = AttendanceService::TIMEZONE;

        try {
            $day = $this->option('date')
                ? Carbon::parse((string) $this->option('date'), $tz)->startOfDay()
                : Carbon::now($tz)->startOfDay();
        } catch (\Throwable) {
            $this->error('Valeur --date invalide. Format attendu : YYYY-MM-DD.');

            return self::FAILURE;
        }

        $dateStr = $day->toDateString();
        $dayEn = strtolower($day->copy()->locale('en')->dayName);
        $dayFr = self::DAYS_FR[$dayEn] ?? $dayEn;

        $employees = Employee::query()
            ->where('status', 'active')
            ->whereNotNull('work_start_time')
            ->get();

        $created = 0;
        $skipped = 0;

        foreach ($employees as $employee) {
            // Jour non travaillé pour cet employé : pas d'absence possible.
            if (is_array($employee->work_days) && count($employee->work_days) > 0) {
                $days = array_map('strtolower', $employee->work_days);
                if (! in_array($dayEn, $days, true) && ! in_array($dayFr, $days, true)) {
                    $skipped++;
                    continue;
                }
            }

            // Déjà un pointage (présent / retard / absence saisie à la main) : on ne touche à rien.
            $existing = EmployeeAttendanceRecord::query()
                ->where('employee_id', $employee->id)
                ->where('attendance_date', $dateStr)
                ->first();
            if ($existing) {
                $skipped++;
                continue;
            }

            $brandId = $employee->brand_id
                ?? $employee->brands()->value('brands.id')
                ?? Brand::query()->orderBy('id')->value('id');
            if (! $brandId) {
                $skipped++;
                continue;
            }

            $record = EmployeeAttendanceRecord::query()->create([
                'brand_id' => $brandId,
                'employee_id' => $employee->id,
                'user_id' => $employee->user_id,
                'attendance_date' => $dateStr,
                'status' => 'absent',
                'was_late' => false,
                'minutes_late' => 0,
                'justification_status' => 'pending',
            ]);
            $created++;

            try {
                $this->automationEngine->runForEvent((int) $brandId, 'attendance.marked', [
                    'employee_id' => $employee->id,
                    'attendance_record_id' => $record->id,
                    'attendance_date' => $dateStr,
                    'status' => 'absent',
                    'minutes_late' => 0,
                    'was_late' => false,
                    'clock_in_at' => null,
                    'justification_status' => 'pending',
                ]);
            } catch (\Throwable $e) {
                Log::warning('hr.mark_absences.automation_failed', [
                    'record_id' => $record->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Absences du {$dateStr} : créées={$created} / ignorées={$skipped}");

        return self::SUCCESS;
    }
}
