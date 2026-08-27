<?php

namespace App\Console\Commands;

use App\Models\SmmContent;
use App\Services\Tiktok\TiktokContentInsightsService;
use Illuminate\Console\Command;

class SmmSyncTiktokPerformanceCommand extends Command
{
    protected $signature = 'smm:sync-tiktok-performance
        {--brand= : Limit to a single brand id}
        {--content= : Sync a single content id}
        {--stale-minutes=30 : Only sync rows whose last_synced_at is older than this (0 = always)}
        {--limit=200 : Max contents to sync in this run}';

    protected $description = 'Fetch organic performance data from TikTok Business API for published SMM contents.';

    public function handle(TiktokContentInsightsService $svc): int
    {
        $q = SmmContent::query()
            ->where('status', 'publie')
            ->where('platform', 'tiktok')
            ->whereNotNull('published_platform_id');

        if ($contentId = $this->option('content')) {
            $q->where('id', (int) $contentId);
        } else {
            if ($brandId = $this->option('brand')) $q->where('brand_id', (int) $brandId);
            $stale = (int) $this->option('stale-minutes');
            if ($stale > 0) {
                $q->where(function ($qq) use ($stale) {
                    $qq->whereDoesntHave('performances', fn ($p) => $p->where('platform', 'tiktok'))
                        ->orWhereHas('performances', fn ($p) => $p->where('platform', 'tiktok')->where('last_synced_at', '<', now()->subMinutes($stale)));
                });
            }
            $q->limit((int) $this->option('limit'));
        }

        $contents = $q->get();
        if ($contents->isEmpty()) {
            $this->info('Rien à synchroniser.');
            return self::SUCCESS;
        }

        $ok = 0; $failed = 0;
        foreach ($contents as $c) {
            $this->line("· sync content #{$c->id} — {$c->title}");
            $row = $svc->syncContent($c);
            if ($row && ! $row->sync_failed) $ok++;
            elseif ($row && $row->sync_failed) $failed++;
        }

        $this->info("Terminé: {$ok} OK, {$failed} en échec, " . $contents->count() . " total.");
        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
