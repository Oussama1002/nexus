<?php

namespace App\Console\Commands;

use App\Models\Employee;
use App\Models\EmployeeAttendanceRecord;
use App\Models\User;
use App\Services\AttendanceService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class PointageDoctorCommand extends Command
{
    protected $signature = 'hr:pointage-doctor {--test= : E-mail d’un utilisateur — simule une arrivée en retard (notif + message interne)} {--repair : Corrige les retards du jour marqués sur un jour non travaillé (dimanche, etc.)}';

    protected $description = 'Explique pourquoi le pointage n’enregistre rien, et permet de tester un retard.';

    // Planning par défaut quand la fiche n’a aucun jour configuré (cf. AttendanceService).
    private const DEFAULT_WORK_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];

    public function handle(): int
    {
        $tz = AttendanceService::TIMEZONE;
        $now = Carbon::now($tz);
        $today = $now->toDateString();
        $this->info("Heure Maroc : {$now->format('Y-m-d H:i')}");

        if ($email = $this->option('test')) {
            return $this->simulateLate($email);
        }

        if ($this->option('repair')) {
            return $this->repairToday($now);
        }

        $employees = Employee::query()->with('user')->get();
        $this->line("Employés : {$employees->count()}");

        $rows = [];
        foreach ($employees as $e) {
            $record = EmployeeAttendanceRecord::query()
                ->where('employee_id', $e->id)
                ->where('attendance_date', $today)
                ->first();

            $rows[] = [
                $e->full_name,
                $e->user?->email ?? '— AUCUN COMPTE —',
                $e->work_start_time ?: '— AUCUNE HEURE —',
                $e->work_days ? implode(',', array_map(fn ($d) => mb_substr($d, 0, 3), (array) $e->work_days)) : 'lun-ven (défaut)',
                $record ? ($record->status.' ('.AttendanceService::formatLateness((int) $record->minutes_late).')') : 'aucun pointage',
                $this->reason($e, $record, $now),
            ];
        }

        $this->table(['Employé', 'Compte', 'Début', 'Jours', "Aujourd'hui", 'Diagnostic'], $rows);
        $this->line('Test : php artisan hr:pointage-doctor --test=email@exemple.com');

        return self::SUCCESS;
    }

    private function reason(Employee $e, ?EmployeeAttendanceRecord $record, Carbon $now): string
    {
        if (! $e->user_id) {
            return 'Lier un compte utilisateur (Utilisateurs → créer le compte)';
        }
        if (! $record) {
            return 'Pas encore connecté aujourd’hui';
        }
        if (! $e->work_start_time) {
            return 'Présent — retard non calculé (pas d’heure de début)';
        }

        if (! $this->isWorkingDay($e, $now)) {
            return 'Présent hors planning (jour non travaillé)';
        }

        return $record->was_late ? 'Retard notifié' : 'À l’heure — rien à notifier';
    }

    /** Même logique que AttendanceService : planning de la fiche, sinon lundi→vendredi. */
    private function isWorkingDay(Employee $e, Carbon $now): bool
    {
        $daysFr = ['monday' => 'lundi', 'tuesday' => 'mardi', 'wednesday' => 'mercredi', 'thursday' => 'jeudi', 'friday' => 'vendredi', 'saturday' => 'samedi', 'sunday' => 'dimanche'];
        $days = (is_array($e->work_days) && $e->work_days)
            ? array_map('strtolower', $e->work_days)
            : self::DEFAULT_WORK_DAYS;
        $dayEn = strtolower($now->locale('en')->dayName);

        return in_array($dayEn, $days, true) || in_array($daysFr[$dayEn], $days, true);
    }

    /** Efface le retard des pointages du jour tombant sur un jour non travaillé. */
    private function repairToday(Carbon $now): int
    {
        $today = $now->toDateString();
        $fixed = 0;

        $records = EmployeeAttendanceRecord::query()
            ->with('employee')
            ->where('attendance_date', $today)
            ->where('was_late', true)
            ->get();

        foreach ($records as $record) {
            $employee = $record->employee;
            if (! $employee || $this->isWorkingDay($employee, $now)) {
                continue;
            }
            $record->update(['status' => 'present', 'was_late' => false, 'minutes_late' => 0]);
            $this->line("Corrigé : {$employee->full_name} — retard annulé (jour non travaillé).");
            $fixed++;
        }

        $this->info($fixed > 0 ? "{$fixed} pointage(s) corrigé(s)." : 'Aucun pointage à corriger aujourd’hui.');

        return self::SUCCESS;
    }

    private function simulateLate(string $email): int
    {
        $user = User::query()->where('email', $email)->first();
        if (! $user) {
            $this->error("Aucun utilisateur avec l’e-mail {$email}.");

            return self::FAILURE;
        }

        $employee = Employee::query()->where('user_id', $user->id)->first();
        if (! $employee) {
            $this->error("{$user->name} n’est lié à aucune fiche employé : le pointage est impossible.");

            return self::FAILURE;
        }

        // Backdate the start time so the next clock-in counts as late, then restore it.
        $original = $employee->work_start_time;
        $employee->forceFill(['work_start_time' => Carbon::now(AttendanceService::TIMEZONE)->subMinutes(25)->format('H:i:s')])->save();
        EmployeeAttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->where('attendance_date', Carbon::now(AttendanceService::TIMEZONE)->toDateString())
            ->delete();

        $record = (new AttendanceService())->recordLoginAttendance($user);

        $employee->forceFill(['work_start_time' => $original])->save();

        if (! $record) {
            $this->error('Aucun pointage créé — lancez la commande sans --test pour voir le diagnostic.');

            return self::FAILURE;
        }

        $this->info('Pointage simulé : '.$record->status.' — retard '.AttendanceService::formatLateness((int) $record->minutes_late));
        $this->line("Vérifiez : notification (cloche) pour {$user->name} et pour les admins, + message interne reçu par {$user->name}.");

        return self::SUCCESS;
    }
}
