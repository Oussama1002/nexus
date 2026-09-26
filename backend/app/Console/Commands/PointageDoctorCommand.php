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
    protected $signature = 'hr:pointage-doctor {--test= : E-mail d’un utilisateur — simule une arrivée en retard (notif + message interne)}';

    protected $description = 'Explique pourquoi le pointage n’enregistre rien, et permet de tester un retard.';

    public function handle(): int
    {
        $tz = AttendanceService::TIMEZONE;
        $now = Carbon::now($tz);
        $today = $now->toDateString();
        $this->info("Heure Maroc : {$now->format('Y-m-d H:i')}");

        if ($email = $this->option('test')) {
            return $this->simulateLate($email);
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
                $e->work_days ? implode(',', array_map(fn ($d) => mb_substr($d, 0, 3), (array) $e->work_days)) : 'tous',
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

        $dayEn = strtolower($now->locale('en')->dayName);
        $daysFr = ['monday' => 'lundi', 'tuesday' => 'mardi', 'wednesday' => 'mercredi', 'thursday' => 'jeudi', 'friday' => 'vendredi', 'saturday' => 'samedi', 'sunday' => 'dimanche'];
        if ($e->work_days && is_array($e->work_days)) {
            $days = array_map('strtolower', $e->work_days);
            if (! in_array($dayEn, $days, true) && ! in_array($daysFr[$dayEn], $days, true)) {
                return 'Présent hors planning (jour non travaillé)';
            }
        }

        return $record->was_late ? 'Retard notifié' : 'À l’heure — rien à notifier';
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
