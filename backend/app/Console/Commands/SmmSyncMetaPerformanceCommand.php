<?php

namespace App\Console\Commands;

use App\Models\SmmContent;
use App\Services\Meta\MetaContentInsightsService;
use Illuminate\Console\Command;

class SmmSyncMetaPerformanceCommand extends Command
{
    protected $signature = 'smm:sync-meta-performance
        {--brand= : Limit to a single brand id}
        {--content= : Sync a single content id}
        {--stale-minutes=30 : Only sync rows whose last_synced_at is older than this (0 = always)}
        {--limit=200 : Max contents to sync in this run}';

    protected $description = 'Fetch organic performance data from Meta (Instagram/Facebook) for published SMM contents.';

    public function handle(MetaContentInsightsService $svc): int
    {
        $q = SmmContent::query()
            ->where('status', 'publie')
            ->whereIn('platform', ['instagram', 'facebook'])
            ->whereNotNull('published_platform_id');

        if ($contentId = $this->option('content')) {
            $q->where('id', (int) $contentId);
        } else {
            if ($brandId = $this->option('brand')) {
                $q->where('brand_id', (int) $brandId);
            }
            $stale = (int) $this->option('stale-minutes');
            if ($stale > 0) {
                $q->where(function ($qq) use ($stale) {
                    $qq->whereDoesntHave('performances', function ($p) {
                        // If no performance row exists at all, treat as stale
                    })->orWhereHas('performances', function ($p) use ($stale) {
                        $p->where('last_synced_at', '<', now()->subMinutes($stale));
                    });
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
            $this->line("· sync content #{$c->id} ({$c->platform}) — {$c->title}");
            $row = $svc->syncContent($c);
            if ($row && ! $row->sync_failed) {
                $ok++;
            } elseif ($row && $row->sync_failed) {
                $failed++;
            }
        }

        $this->info("Synchronisation terminée: {$ok} OK, {$failed} en échec, " . $contents->count() . " total.");
        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
