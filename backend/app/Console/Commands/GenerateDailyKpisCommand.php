<?php

namespace App\Console\Commands;

use App\Services\DailyKpiGeneratorService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GenerateDailyKpisCommand extends Command
{
    protected $signature = 'kpis:generate-daily {--date= : Date Y-m-d (default yesterday)}';

    protected $description = 'Generate daily_kpis snapshots per brand from operational data';

    public function handle(DailyKpiGeneratorService $generator): int
    {
        $raw = $this->option('date');
        $date = $raw ? Carbon::parse($raw) : Carbon::yesterday();

        $n = $generator->generateForDate($date);

        $this->info("Generated daily KPIs for {$date->toDateString()} ({$n} brands).");

        return self::SUCCESS;
    }
}
