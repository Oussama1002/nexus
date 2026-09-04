<?php

namespace App\Console\Commands;

use App\Models\Brand;
use App\Services\AuditLogger;
use App\Services\CmAutomationService;
use Illuminate\Console\Command;
use Throwable;

/**
 * Runs the CM-GEN and CM-A1..A7 automations for every active brand.
 * Called from routes/console.php.
 */
class CmRunAutomationsCommand extends Command
{
    protected $signature = 'cm:run-automations';
    protected $description = 'Execute CM automations (checklist generation, close, late items, signal escalation, publication reminders, rate recalc).';

    public function handle(): int
    {
        $brands = Brand::query()->pluck('id')->all();
        $totals = ['created' => 0, 'closed' => 0, 'late' => 0, 'escalated' => 0, 'archived' => 0, 'deadlines' => 0, 'recalc' => 0, 'resolved' => 0];

        foreach ($brands as $brandId) {
            try {
                $totals['created']   += CmAutomationService::autoCreateDailyChecklists($brandId);
                $totals['closed']    += CmAutomationService::autoCloseEndOfDay($brandId);
                $totals['late']      += CmAutomationService::markLateItems($brandId);
                $totals['escalated'] += CmAutomationService::autoEscalateSignals($brandId);
                $totals['archived']  += CmAutomationService::autoArchiveOldContent($brandId);
                CmAutomationService::checkModerationThreshold($brandId);
                $totals['deadlines'] += CmAutomationService::checkPublicationDeadlines($brandId);
                $totals['recalc']    += CmAutomationService::recalculateRates($brandId);
                $totals['resolved']  += CmAutomationService::autoCloseResolvedComplaints($brandId);
            } catch (Throwable $e) {
                $this->error("Brand {$brandId} : " . $e->getMessage());
            }
        }

        $summary = collect($totals)->map(fn ($v, $k) => "{$k}={$v}")->implode(', ');
        $this->info("CM automations : {$summary}");
        AuditLogger::system('cm.run-automations', null, $totals);

        return self::SUCCESS;
    }
}
