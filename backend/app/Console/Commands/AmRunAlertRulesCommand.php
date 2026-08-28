<?php

namespace App\Console\Commands;

use App\Models\AmAlert;
use App\Models\AmAlertRuleTemplate;
use App\Models\AmBrandEconomics;
use App\Models\AmDeliverable;
use App\Models\AmDerogation;
use App\Models\AmRoadmap;
use App\Services\Am\AmDerogationService;
use App\Services\Am\AmNotificationService;
use App\Services\AuditLogger;
use Illuminate\Console\Command;

/**
 * Runs the AM-01…AM-25 alert rules. Idempotent per (rule_code, brand_id, day)
 * — the fingerprint prevents duplicate alerts on the same rule+brand+day.
 */
class AmRunAlertRulesCommand extends Command
{
    protected $signature = 'am:run-alert-rules';
    protected $description = 'Evaluate AM alert rules (AM-01..AM-25) and open alerts + notifications.';

    public function __construct(
        private readonly AmNotificationService $notify,
        private readonly AmDerogationService $derogations,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $today = now()->toDateString();

        // Expire dérogations first — a lot of rules depend on this state.
        $expired = $this->derogations->expireDue();
        if ($expired > 0) $this->info("Dérogations expirées : {$expired}");

        $rules = AmAlertRuleTemplate::query()->where('is_active', true)->get()->keyBy('code');
        $count = 0;

        // AM-16 : ratio LTV/CAC sous seuil
        foreach (AmBrandEconomics::query()->whereNotNull('ltv_cac_ratio')->get() as $eco) {
            if ((float) $eco->ltv_cac_ratio < (float) $eco->ltv_cac_threshold) {
                $count += (int) $this->openAlert('AM-16', $eco->brand_id, $today, $rules->get('AM-16'), [
                    'label' => 'Ratio LTV/CAC sous seuil',
                    'trigger_value' => (string) $eco->ltv_cac_ratio,
                    'severity' => 'high',
                    'description' => "Observé {$eco->ltv_cac_ratio} < seuil {$eco->ltv_cac_threshold}.",
                ]);
            }
        }

        // AM-17 : livrable en retard
        AmDeliverable::query()
            ->whereIn('status', ['a_produire', 'en_production', 'depose', 'en_controle', 'a_corriger'])
            ->whereNotNull('deadline')
            ->whereDate('deadline', '<', now())
            ->chunkById(200, function ($rows) use ($today, $rules, &$count) {
                foreach ($rows as $del) {
                    $count += (int) $this->openAlert('AM-17', $del->brand_id, $today, $rules->get('AM-17'), [
                        'label' => "Livrable en retard : {$del->label}",
                        'severity' => 'medium',
                        'trigger_value' => (string) $del->deadline,
                    ], suffix: (string) $del->id);
                }
            });

        // AM-18 : feuille de route sans avancement > 15j
        AmRoadmap::query()
            ->whereIn('status', ['en_cours'])
            ->where(function ($q) {
                $q->whereNull('last_gate_transit_at')->orWhere('last_gate_transit_at', '<', now()->subDays(15));
            })
            ->chunkById(200, function ($rows) use ($today, $rules, &$count) {
                foreach ($rows as $rm) {
                    $count += (int) $this->openAlert('AM-18', $rm->brand_id, $today, $rules->get('AM-18'), [
                        'label' => 'Feuille de route sans avancement > 15 jours',
                        'severity' => 'medium',
                    ]);
                }
            });

        // AM-19 : dérogation qui expire dans les 3 jours
        AmDerogation::query()
            ->where('status', 'accordee')
            ->whereBetween('expires_at', [now(), now()->addDays(3)])
            ->chunkById(200, function ($rows) use ($today, $rules, &$count) {
                foreach ($rows as $der) {
                    $count += (int) $this->openAlert('AM-19', $der->brand_id, $today, $rules->get('AM-19'), [
                        'label' => 'Dérogation arrive à expiration',
                        'severity' => 'high',
                        'trigger_value' => (string) $der->expires_at,
                    ], suffix: (string) $der->id);
                }
            });

        $this->info("Alertes AM ouvertes : {$count}");
        AuditLogger::system('am_alerts.run', null, ['opened' => $count, 'date' => $today]);
        return self::SUCCESS;
    }

    private function openAlert(string $code, int $brandId, string $day, ?AmAlertRuleTemplate $rule, array $override, string $suffix = ''): bool
    {
        $fp = "am:{$code}:{$brandId}:{$day}" . ($suffix !== '' ? ":{$suffix}" : '');
        $exists = AmAlert::query()
            ->where('brand_id', $brandId)
            ->where('rule_code', $code)
            ->where('opened_at', '>=', now()->startOfDay())
            ->exists();
        if ($exists) return false;

        $alert = AmAlert::query()->create(array_merge([
            'brand_id' => $brandId,
            'rule_code' => $code,
            'severity' => $rule?->severity ?? 'medium',
            'label' => $override['label'] ?? ($rule?->label ?? $code),
            'description' => $override['description'] ?? null,
            'trigger_value' => $override['trigger_value'] ?? null,
            'opened_at' => now(),
            'target_resolution_minutes' => $rule?->target_resolution_minutes,
            'status' => 'ouverte',
        ], array_intersect_key($override, array_flip(['severity']))));

        $role = $rule?->default_recipient_role ?? 'manager_operationnel';
        $this->notify->notifyRole($role, $brandId, 'am.alert', $alert->label, $alert->description ?? '', ['alert_id' => $alert->id, 'fp' => $fp]);
        AuditLogger::system('am_alert.opened', $alert, ['fp' => $fp]);
        return true;
    }
}
