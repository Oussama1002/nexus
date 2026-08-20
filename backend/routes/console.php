<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('orders:verify-bank-transfers')->everyTenMinutes();
Schedule::command('finance:generate-monthly-invoices')->monthlyOn(1, '06:00');
Schedule::command('finance:send-monthly-invoices')->monthlyOn(2, '08:00');

// SMM — Meta (Instagram/Facebook) organic performance sync.
// Runs every 30 min; the command itself only re-fetches rows whose
// last_synced_at is older than --stale-minutes (default 30).
Schedule::command('smm:sync-meta-performance --stale-minutes=30 --limit=200')
    ->everyThirtyMinutes()
    ->withoutOverlapping()
    ->runInBackground();
