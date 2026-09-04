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

// SMM — TikTok organic performance sync. Same 30 min cadence.
Schedule::command('smm:sync-tiktok-performance --stale-minutes=30 --limit=200')
    ->everyThirtyMinutes()
    ->withoutOverlapping()
    ->runInBackground();

// SMM — RS-01 … RS-24 scheduled automations (spec §11).
// Runs hourly; each rule has its own dedup window so re-runs don't spam.
Schedule::command('smm:run-automations')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

// AM — Alert rules AM-01..AM-25 + derogation expiry.
Schedule::command('am:run-alert-rules')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();

// CM — CM-GEN, CM-CLOSE, CM-A1..A7 (spec §15).
// Runs hourly; each rule has its own dedup, and autoCloseEndOfDay only
// acts on checklists whose date is already past.
Schedule::command('cm:run-automations')
    ->hourly()
    ->withoutOverlapping()
    ->runInBackground();
