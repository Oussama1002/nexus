<?php

namespace App\Console\Commands;

use App\Models\SmmAutomation;
use App\Models\SmmContent;
use App\Models\SmmContentPerformance;
use App\Models\SmmEvent;
use App\Models\SmmLearning;
use App\Models\SmmMonthlyPlan;
use App\Models\SmmMonthlyReport;
use App\Models\SmmStrategy;
use App\Services\Smm\SmmNotificationService;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Runs all SMM automation rules RS-01 → RS-24 from the spec §11 that
 * require a scheduled condition check. Event-driven rules (RS-03, RS-07,
 * RS-08, RS-09, RS-11, RS-12, RS-20, RS-24) are fired inline from the
 * controllers when the state transition happens; those are excluded here.
 *
 * Idempotency: each rule writes a rule_id + related_id fingerprint into
 * the CmNotification.data so it only fires once per situation. That way
 * running this hourly doesn't spam the same reminder every hour.
 */
class SmmRunAutomationsCommand extends Command
{
    protected $signature = 'smm:run-automations
        {--rule= : Run a single rule id (RS-01, RS-02, …)}
        {--dry-run : Log what would fire without persisting notifications}';

    protected $description = 'Evaluate all scheduled SMM automation rules and emit notifications.';

    /** In-memory de-dup so a rule fires at most once per (rule_id, related_id) per 24h. */
    private array $recentFingerprints = [];

    public function handle(): int
    {
        $only = $this->option('rule');
        $rules = [
            'RS-01' => fn () => $this->rs01(),
            'RS-02' => fn () => $this->rs02(),
            'RS-04' => fn () => $this->rs04(),
            'RS-05' => fn () => $this->rs05(),
            'RS-06' => fn () => $this->rs06(),
            'RS-10' => fn () => $this->rs10(),
            'RS-13' => fn () => $this->rs13(),
            'RS-16' => fn () => $this->rs16(),
            'RS-17' => fn () => $this->rs17(),
            'RS-18' => fn () => $this->rs18(),
            'RS-19' => fn () => $this->rs19(),
            'RS-21' => fn () => $this->rs21(),
            'RS-22' => fn () => $this->rs22(),
            'RS-23' => fn () => $this->rs23(),
        ];

        $this->loadRecentFingerprints();

        $total = 0;
        foreach ($rules as $id => $fn) {
            if ($only && $only !== $id) continue;
            try {
                $fired = $fn();
                if (is_int($fired) && $fired > 0) {
                    $this->info("· {$id}: {$fired} notification(s)");
                    $total += $fired;
                }
            } catch (\Throwable $e) {
                $this->error("· {$id} failed: " . $e->getMessage());
            }
        }

        $this->info("SMM automations: {$total} notification(s) émise(s).");
        return self::SUCCESS;
    }

    /** RS-01 — Approche fin de trimestre; aucune stratégie en préparation pour le suivant. */
    private function rs01(): int
    {
        $daysAhead = 21; // configurable seuil
        if (! now()->between(now()->endOfQuarter()->subDays($daysAhead), now()->endOfQuarter())) return 0;

        $currentQ = (int) ceil((int) now()->format('n') / 3);
        $currentY = (int) now()->format('Y');
        $nextQ = $currentQ === 4 ? 1 : $currentQ + 1;
        $nextY = $currentQ === 4 ? $currentY + 1 : $currentY;

        $fired = 0;
        foreach ($this->distinctBrandIds() as $brandId) {
            $exists = SmmStrategy::query()->where('brand_id', $brandId)
                ->where('year', $nextY)->where('quarter', $nextQ)->exists();
            if ($exists) continue;
            $fp = "RS-01:{$brandId}:{$nextY}Q{$nextQ}";
            if ($this->dedup($fp)) continue;
            $this->send('manager_ops', $brandId, 'RS-01', 'Stratégie trimestrielle à préparer',
                "La stratégie T{$nextQ} {$nextY} n'a pas encore été démarrée.",
                ['rule_id' => 'RS-01', 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-02 — Plan mensuel non soumis à X jours du début du mois. */
    private function rs02(): int
    {
        $daysAhead = 7; // configurable
        if (! now()->between(now()->endOfMonth()->subDays($daysAhead), now()->endOfMonth())) return 0;

        $nextY = (int) now()->addMonth()->format('Y');
        $nextM = (int) now()->addMonth()->format('m');

        $fired = 0;
        foreach ($this->distinctBrandIds() as $brandId) {
            $plan = SmmMonthlyPlan::query()->where('brand_id', $brandId)
                ->where('year', $nextY)->where('month', $nextM)->first();
            if ($plan && in_array($plan->status, ['soumis', 'valide'], true)) continue;
            $fp = "RS-02:{$brandId}:{$nextY}-{$nextM}";
            if ($this->dedup($fp)) continue;
            $this->send('smm', $brandId, 'RS-02', 'Plan mensuel à soumettre',
                "Le plan " . str_pad((string) $nextM, 2, '0', STR_PAD_LEFT) . "/{$nextY} n'est pas encore soumis.",
                ['rule_id' => 'RS-02', 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-04 — Demande de validation sans réponse depuis X. */
    private function rs04(): int
    {
        $staleHours = 24; // configurable
        $threshold = now()->subHours($staleHours);
        $fired = 0;

        foreach (SmmStrategy::query()->where('status', 'soumise')->where('submitted_at', '<', $threshold)->get() as $s) {
            $fp = "RS-04:strategy:{$s->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('direction', $s->brand_id, 'RS-04', 'Relance validation stratégie',
                "La stratégie T{$s->quarter} {$s->year} attend une décision depuis " . $s->submitted_at->diffForHumans() . ".",
                ['rule_id' => 'RS-04', 'strategy_id' => $s->id, 'fp' => $fp]);
            $fired++;
        }
        foreach (SmmMonthlyPlan::query()->where('status', 'soumis')->where('submitted_at', '<', $threshold)->get() as $p) {
            $fp = "RS-04:plan:{$p->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('manager_ops', $p->brand_id, 'RS-04', 'Relance validation plan mensuel',
                "Le plan " . str_pad((string) $p->month, 2, '0', STR_PAD_LEFT) . "/{$p->year} attend une décision.",
                ['rule_id' => 'RS-04', 'plan_id' => $p->id, 'fp' => $fp]);
            $fired++;
        }
        foreach (SmmContent::query()->where('status', 'a_valider_direction')->where('updated_at', '<', $threshold)->get() as $c) {
            $fp = "RS-04:content:{$c->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('direction', $c->brand_id, 'RS-04', 'Relance validation contenu sensible',
                "Le contenu « {$c->title} » attend la validation Direction.",
                ['rule_id' => 'RS-04', 'content_id' => $c->id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-05 — Échéance de production dépassée. */
    private function rs05(): int
    {
        $fired = 0;
        $rows = SmmContent::query()
            ->whereIn('status', ['a_briefer', 'briefe', 'en_production', 'en_revision'])
            ->whereNotNull('production_due_at')
            ->where('production_due_at', '<', now())
            ->get();
        foreach ($rows as $c) {
            $fp = "RS-05:{$c->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('smm', $c->brand_id, 'RS-05', 'Contenu en retard de production',
                "« {$c->title} » — échéance de production dépassée.",
                ['rule_id' => 'RS-05', 'content_id' => $c->id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-06 — Retard de production persistant (48h). */
    private function rs06(): int
    {
        $fired = 0;
        $rows = SmmContent::query()
            ->whereIn('status', ['a_briefer', 'briefe', 'en_production', 'en_revision'])
            ->whereNotNull('production_due_at')
            ->where('production_due_at', '<', now()->subHours(48))
            ->get();
        foreach ($rows as $c) {
            $fp = "RS-06:{$c->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('manager_ops', $c->brand_id, 'RS-06', 'Retard de production persistant',
                "« {$c->title} » — retard > 48h.",
                ['rule_id' => 'RS-06', 'content_id' => $c->id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-10 — Heure de publication prévue dépassée sans passage en publié. */
    private function rs10(): int
    {
        $graceMin = 30; // configurable
        $threshold = now()->subMinutes($graceMin);
        $fired = 0;
        $rows = SmmContent::query()
            ->where('status', 'transmis_cm')
            ->whereNotNull('scheduled_publish_at')
            ->where('scheduled_publish_at', '<', $threshold)
            ->get();
        foreach ($rows as $c) {
            $fp = "RS-10:{$c->id}:" . $c->scheduled_publish_at->format('YmdHi');
            if ($this->dedup($fp)) continue;
            $this->send('smm', $c->brand_id, 'RS-10', 'Publication en retard',
                "« {$c->title} » n'a pas été publié à l'heure prévue.",
                ['rule_id' => 'RS-10', 'content_id' => $c->id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-13 — Délai de réponse CM dépassé sur les réclamations issues du social. */
    private function rs13(): int
    {
        if (! class_exists(\App\Models\Complaint::class)) return 0;
        $slaHours = 4; // configurable
        $fired = 0;
        $rows = \App\Models\Complaint::query()
            ->whereIn('channel', ['instagram', 'facebook', 'tiktok'])
            ->where('status', 'nouvelle')
            ->where('created_at', '<', now()->subHours($slaHours))
            ->get();
        foreach ($rows as $r) {
            $fp = "RS-13:{$r->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('smm', $r->brand_id, 'RS-13', 'Réponse CM en retard',
                "Réclamation {$r->reference} sans réponse depuis > {$slaHours}h.",
                ['rule_id' => 'RS-13', 'complaint_id' => $r->id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-16 — Contenu dépassant un seuil de performance → proposition de repurposing. */
    private function rs16(): int
    {
        $reachThreshold = 50000; // configurable
        $fired = 0;
        $rows = SmmContentPerformance::query()
            ->where('reach', '>', $reachThreshold)
            ->where('updated_at', '>=', now()->subDay())
            ->get();
        foreach ($rows as $p) {
            $fp = "RS-16:{$p->content_id}:{$p->platform}";
            if ($this->dedup($fp)) continue;
            $this->send('smm', $p->brand_id, 'RS-16', 'Performance élevée — repurposing suggéré',
                "Le contenu #{$p->content_id} ({$p->platform}) a dépassé " . number_format($reachThreshold, 0, ',', ' ') . " de reach.",
                ['rule_id' => 'RS-16', 'content_id' => $p->content_id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-17 — Chute de performance sur plusieurs contenus consécutifs. */
    private function rs17(): int
    {
        $window = 5; // last N published contents per brand
        $fired = 0;
        foreach ($this->distinctBrandIds() as $brandId) {
            $recent = SmmContent::query()->where('brand_id', $brandId)
                ->where('status', 'publie')->orderByDesc('published_at')->limit($window)->pluck('id')->all();
            if (count($recent) < $window) continue;
            $engagements = SmmContentPerformance::query()->whereIn('content_id', $recent)->pluck('engagement_rate');
            if ($engagements->isEmpty()) continue;
            if ($engagements->avg() < 1.0) {
                $fp = "RS-17:{$brandId}:" . now()->format('Y-m-d');
                if ($this->dedup($fp)) continue;
                $this->send('both', $brandId, 'RS-17', 'Chute de performance',
                    "Engagement moyen < 1% sur les {$window} derniers contenus.",
                    ['rule_id' => 'RS-17', 'fp' => $fp]);
                $fired++;
            }
        }
        return $fired;
    }

    /** RS-18 — Approche du délai d'anticipation d'un événement sans plan de contenu. */
    private function rs18(): int
    {
        $fired = 0;
        $events = SmmEvent::query()->whereIn('status', ['planifie', 'retroplanning_a_valider'])->get();
        foreach ($events as $e) {
            $ant = (int) ($e->anticipation_days ?? 14);
            $trigger = $e->start_date->copy()->subDays($ant);
            if (! now()->between($trigger->subDay(), $trigger->addDay())) continue;
            $count = SmmContent::query()->where('event_id', $e->id)->count();
            if ($count > 0) continue;
            $fp = "RS-18:{$e->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('both', $e->brand_id, 'RS-18', 'Événement sans plan de contenu',
                "« {$e->label} » démarre dans {$ant} jours et n'a aucun contenu.",
                ['rule_id' => 'RS-18', 'event_id' => $e->id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-19 — Seuil configurable avant le lancement d'un événement; assets non tous validés. */
    private function rs19(): int
    {
        $seuil = 3; // days configurable
        $fired = 0;
        $events = SmmEvent::query()->whereIn('status', ['en_preparation', 'planifie'])
            ->whereBetween('start_date', [now()->toDateString(), now()->addDays($seuil)->toDateString()])
            ->get();
        foreach ($events as $e) {
            $notReady = SmmContent::query()->where('event_id', $e->id)
                ->whereNotIn('status', ['valide', 'transmis_cm', 'publie'])->count();
            if ($notReady === 0) continue;
            $fp = "RS-19:{$e->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('both', $e->brand_id, 'RS-19', 'Assets d\'événement non prêts',
                "« {$e->label} » — {$notReady} contenu(s) non validé(s) à J-{$seuil}.",
                ['rule_id' => 'RS-19', 'event_id' => $e->id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-21 — Réclamations récurrentes sur un même motif > seuil. */
    private function rs21(): int
    {
        if (! class_exists(\App\Models\Complaint::class)) return 0;
        $seuil = 5; // configurable
        $fired = 0;
        $rows = DB::table('complaints')
            ->where('created_at', '>=', now()->subDays(30))
            ->whereIn('channel', ['instagram', 'facebook', 'tiktok'])
            ->select('brand_id', 'category', DB::raw('COUNT(*) as c'))
            ->groupBy('brand_id', 'category')
            ->having('c', '>=', $seuil)
            ->get();
        foreach ($rows as $r) {
            $fp = "RS-21:{$r->brand_id}:{$r->category}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('both', (int) $r->brand_id, 'RS-21', 'Motif de réclamation récurrent',
                "{$r->c} réclamations « {$r->category} » sur 30 jours.",
                ['rule_id' => 'RS-21', 'category' => $r->category, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-22 — Fin de mois; rapport mensuel non diffusé. */
    private function rs22(): int
    {
        // Only fire in the last 3 days of the month
        if (now()->diffInDays(now()->endOfMonth(), false) > 3) return 0;

        $fired = 0;
        $year = (int) now()->format('Y');
        $month = (int) now()->format('m');
        foreach ($this->distinctBrandIds() as $brandId) {
            $report = SmmMonthlyReport::query()->where('brand_id', $brandId)
                ->where('year', $year)->where('month', $month)->first();
            if ($report && $report->status === 'diffuse') continue;
            $fp = "RS-22:{$brandId}:{$year}-{$month}";
            if ($this->dedup($fp)) continue;
            $this->send('smm', $brandId, 'RS-22', 'Rapport mensuel à diffuser',
                "Le rapport " . str_pad((string) $month, 2, '0', STR_PAD_LEFT) . "/{$year} n'est pas encore diffusé.",
                ['rule_id' => 'RS-22', 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    /** RS-23 — Enseignement enregistré mais aucune communication aux contributeurs. */
    private function rs23(): int
    {
        $staleDays = 3; // configurable
        $fired = 0;
        $rows = SmmLearning::query()
            ->whereNull('communicated_at')
            ->where('created_at', '<', now()->subDays($staleDays))
            ->get();
        foreach ($rows as $l) {
            $fp = "RS-23:{$l->id}:" . now()->format('Y-m-d');
            if ($this->dedup($fp)) continue;
            $this->send('smm', $l->brand_id, 'RS-23', 'Enseignement à communiquer',
                "Un enseignement enregistré il y a > {$staleDays} jours n'a pas été communiqué.",
                ['rule_id' => 'RS-23', 'learning_id' => $l->id, 'fp' => $fp]);
            $fired++;
        }
        return $fired;
    }

    // ─── helpers ───

    /** @return array<int, int> */
    private function distinctBrandIds(): array
    {
        return DB::table('brands')->pluck('id')->all();
    }

    private function send(string $audience, ?int $brandId, string $ruleId, string $title, string $body, array $data): void
    {
        if ($this->option('dry-run')) {
            $this->line("  [DRY] {$ruleId} → {$audience}: {$title}");
            return;
        }
        $data['brand_id'] = $brandId;
        match ($audience) {
            'smm'         => SmmNotificationService::notifySmm($brandId, $ruleId, $title, $body, $data),
            'manager_ops' => SmmNotificationService::notifyManagerOps($brandId, $ruleId, $title, $body, $data),
            'direction'   => SmmNotificationService::notifyDirection($brandId, $ruleId, $title, $body, $data),
            'both'        => SmmNotificationService::notifySmmAndOps($brandId, $ruleId, $title, $body, $data),
        };
        $this->recentFingerprints[$data['fp']] = true;
    }

    /** True → skip, already fired recently. */
    private function dedup(string $fingerprint): bool
    {
        return isset($this->recentFingerprints[$fingerprint]);
    }

    /** Load recent CmNotification data.fp values into memory to dedup this run. */
    private function loadRecentFingerprints(): void
    {
        $rows = DB::table('cm_notifications')
            ->where('created_at', '>=', now()->subDay())
            ->where('type', 'like', 'smm_RS-%')
            ->pluck('data');
        foreach ($rows as $json) {
            $arr = is_string($json) ? json_decode($json, true) : (array) $json;
            if (is_array($arr) && isset($arr['fp'])) {
                $this->recentFingerprints[$arr['fp']] = true;
            }
        }
    }
}
