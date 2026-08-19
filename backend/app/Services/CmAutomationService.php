<?php

namespace App\Services;

use App\Models\ChecklistTemplate;
use App\Models\CmDecisionPoint;
use App\Models\Complaint;
use App\Models\ContentCalendar;
use App\Models\DailyChecklist;
use App\Models\DailyChecklistItem;
use App\Models\InfluencerContentLog;
use App\Models\InfluencerSignal;
use App\Models\ModerationAction;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class CmAutomationService
{
    /**
     * CM-GEN-1: Auto-create daily checklists from default template.
     * Called by scheduler each morning for each active CM.
     */
    public static function autoCreateDailyChecklists(int $brandId): int
    {
        $today = Carbon::today()->toDateString();
        $template = ChecklistTemplate::query()
            ->where('brand_id', $brandId)
            ->where('is_default', true)
            ->where('is_active', true)
            ->first();

        if (! $template) {
            return 0;
        }

        $cmUsers = \App\Models\User::query()
            ->whereHas('roles', fn ($q) => $q->where('slug', 'community_manager'))
            ->get();

        $created = 0;
        foreach ($cmUsers as $user) {
            $exists = DailyChecklist::query()
                ->where('brand_id', $brandId)
                ->where('cm_user_id', $user->id)
                ->where('work_date', $today)
                ->exists();

            if ($exists) {
                continue;
            }

            $checklist = DailyChecklist::create([
                'brand_id' => $brandId,
                'cm_user_id' => $user->id,
                'work_date' => $today,
                'status' => 'en_cours',
                'template_id' => $template->id,
            ]);

            $items = $template->items_json ?? [];
            foreach ($items as $item) {
                $checklist->items()->create([
                    'label' => $item['label'] ?? 'Tâche',
                    'category' => $item['category'] ?? null,
                    'task_type' => $item['task_type'] ?? 'custom',
                    'scheduled_time' => $item['scheduled_time'] ?? null,
                    'platform' => $item['platform'] ?? null,
                    'status' => 'pending',
                ]);
            }

            $created++;
        }

        return $created;
    }

    /**
     * CM-GEN-2: Auto-close checklists at end of day if not submitted.
     * Called by scheduler each evening.
     */
    public static function autoCloseEndOfDay(int $brandId): int
    {
        $today = Carbon::today()->toDateString();

        $checklists = DailyChecklist::query()
            ->where('brand_id', $brandId)
            ->where('work_date', $today)
            ->where('status', 'en_cours')
            ->get();

        $closed = 0;
        foreach ($checklists as $checklist) {
            $checklist->recalculateRates();
            $checklist->status = 'soumis';
            $checklist->closed_at = now();
            $checklist->closed_automatically = true;
            $checklist->save();

            CmNotificationService::checklistAutoClosedIncomplete(
                $brandId,
                $checklist->cm_user_id,
                $checklist->id,
                (float) $checklist->completion_rate,
            );

            self::logDecision($brandId, $checklist->cm_user_id, 'CM-GEN-2', 'Clôture automatique de checklist', 'daily_checklist', $checklist->id, ['completion_rate' => $checklist->completion_rate], 'auto_closed');

            $closed++;
        }

        return $closed;
    }

    /**
     * CM-GEN-3: Check for late checklist items and mark delays.
     */
    public static function markLateItems(int $brandId): int
    {
        $now = Carbon::now()->format('H:i:s');

        $items = DailyChecklistItem::query()
            ->whereHas('checklist', fn ($q) => $q->where('brand_id', $brandId)->where('work_date', Carbon::today()->toDateString())->where('status', 'en_cours'))
            ->where('status', 'pending')
            ->whereNotNull('scheduled_time')
            ->where('scheduled_time', '<', $now)
            ->where('is_completed', false)
            ->get();

        $marked = 0;
        foreach ($items as $item) {
            $scheduledMinutes = Carbon::parse($item->scheduled_time)->diffInMinutes(Carbon::now(), false);
            if ($scheduledMinutes > 0) {
                $item->status = 'late';
                $item->delay_minutes = (int) $scheduledMinutes;
                $item->save();
                $marked++;
            }
        }

        return $marked;
    }

    /**
     * CM-A1: Auto-escalate signals unresolved after configurable days.
     */
    public static function autoEscalateSignals(int $brandId, int $daysThreshold = 3): int
    {
        $cutoff = Carbon::now()->subDays($daysThreshold);

        $signals = InfluencerSignal::query()
            ->where('brand_id', $brandId)
            ->where('status', 'ouvert')
            ->where('created_at', '<', $cutoff)
            ->get();

        $escalated = 0;
        foreach ($signals as $signal) {
            $signal->status = 'escaladé';
            $signal->save();

            CmNotificationService::signalEscalated(
                $brandId,
                $signal->id,
                $signal->influencer?->full_name ?? "Influenceur #{$signal->influencer_id}",
                $signal->signal_type,
            );

            self::logDecision($brandId, $signal->cm_user_id, 'CM-A1', 'Escalade automatique de signalement', 'influencer_signal', $signal->id, ['days_open' => $daysThreshold], 'auto_escalated');

            $escalated++;
        }

        return $escalated;
    }

    /**
     * CM-A2: Auto-archive old content logs.
     */
    public static function autoArchiveOldContent(int $brandId, int $daysThreshold = 90): int
    {
        $cutoff = Carbon::now()->subDays($daysThreshold);

        $logs = InfluencerContentLog::query()
            ->where('brand_id', $brandId)
            ->where('is_archived', false)
            ->where('published_at', '<', $cutoff)
            ->get();

        $archived = 0;
        foreach ($logs as $log) {
            $log->is_archived = true;
            $log->save();
            $archived++;
        }

        if ($archived > 0) {
            self::logDecision($brandId, 0, 'CM-A2', 'Archivage automatique de contenus anciens', null, null, ['count' => $archived, 'days_threshold' => $daysThreshold], 'auto_archived');
        }

        return $archived;
    }

    /**
     * CM-A3: Alert SMM when moderation threshold exceeded.
     */
    public static function checkModerationThreshold(int $brandId, int $dailyThreshold = 20): void
    {
        $today = Carbon::today();

        $counts = ModerationAction::query()
            ->where('brand_id', $brandId)
            ->whereDate('action_date', $today)
            ->selectRaw('cm_user_id, COUNT(*) as cnt')
            ->groupBy('cm_user_id')
            ->having('cnt', '>=', $dailyThreshold)
            ->get();

        foreach ($counts as $row) {
            $user = \App\Models\User::find($row->cm_user_id);
            CmNotificationService::moderationThresholdExceeded(
                $brandId,
                $row->cm_user_id,
                $user?->name ?? "CM #{$row->cm_user_id}",
                $row->cnt,
                'jour',
            );

            self::logDecision($brandId, $row->cm_user_id, 'CM-A3', 'Seuil de modération dépassé', null, null, ['count' => $row->cnt, 'threshold' => $dailyThreshold], 'threshold_exceeded');
        }
    }

    /**
     * CM-A4: Auto-create complaint from critical signal.
     */
    public static function autoComplaintFromCriticalSignal(int $brandId, InfluencerSignal $signal): ?Complaint
    {
        if ($signal->severity !== 'critique') {
            return null;
        }

        $complaint = Complaint::create([
            'brand_id' => $brandId,
            'reference' => 'REC-SIG-' . strtoupper(uniqid()),
            'customer_name' => $signal->influencer?->full_name ?? "Influenceur #{$signal->influencer_id}",
            'channel' => 'signal_influenceur',
            'category' => 'influenceur',
            'priority' => 'P1',
            'description' => "Signal critique auto-escaladé : [{$signal->signal_type}] {$signal->description}",
            'status' => 'nouvelle',
            'source_user_id' => $signal->cm_user_id,
            'source' => 'automation',
        ]);

        CmNotificationService::complaintCreatedFromCm($brandId, $complaint->id, $complaint->reference, $complaint->customer_name);

        self::logDecision($brandId, $signal->cm_user_id, 'CM-A4', 'Création automatique de réclamation depuis signal critique', 'influencer_signal', $signal->id, ['complaint_id' => $complaint->id], 'auto_created');

        return $complaint;
    }

    /**
     * CM-A5: Notify CM when publication deadline approaches (within 2 hours).
     */
    public static function checkPublicationDeadlines(int $brandId): int
    {
        $from = Carbon::now();
        $to = Carbon::now()->addHours(2);

        $contents = ContentCalendar::query()
            ->where('brand_id', $brandId)
            ->whereIn('status', ['approved', 'in_production', 'review'])
            ->whereBetween('planned_at', [$from, $to])
            ->whereNotNull('assigned_to')
            ->get();

        $notified = 0;
        foreach ($contents as $content) {
            CmNotificationService::publicationDeadlineApproaching(
                $brandId,
                $content->assigned_to,
                $content->id,
                $content->title,
                $content->planned_at->format('H:i'),
            );
            $notified++;
        }

        return $notified;
    }

    /**
     * CM-A6: Recalculate completion/punctuality rates on all today's checklists.
     */
    public static function recalculateRates(int $brandId): int
    {
        $today = Carbon::today()->toDateString();

        $checklists = DailyChecklist::query()
            ->where('brand_id', $brandId)
            ->where('work_date', $today)
            ->with('items')
            ->get();

        $updated = 0;
        foreach ($checklists as $checklist) {
            $checklist->recalculateRates();
            $checklist->save();
            $updated++;
        }

        return $updated;
    }

    /**
     * CM-A7: Auto-close resolved complaints after configurable days.
     */
    public static function autoCloseResolvedComplaints(int $brandId, int $daysAfterResolved = 7): int
    {
        $cutoff = Carbon::now()->subDays($daysAfterResolved);

        $complaints = Complaint::query()
            ->where('brand_id', $brandId)
            ->where('status', 'résolue')
            ->where('resolved_at', '<', $cutoff)
            ->get();

        $closed = 0;
        foreach ($complaints as $complaint) {
            $complaint->status = 'clôturée';
            $complaint->closed_at = now();
            $complaint->save();

            if ($complaint->source_user_id) {
                CmNotificationService::complaintStatusChanged(
                    $brandId,
                    $complaint->source_user_id,
                    $complaint->id,
                    $complaint->reference,
                    'clôturée',
                );
            }

            self::logDecision($brandId, $complaint->source_user_id ?? 0, 'CM-A7', 'Clôture automatique de réclamation résolue', 'complaint', $complaint->id, ['days_after_resolved' => $daysAfterResolved], 'auto_closed');

            $closed++;
        }

        return $closed;
    }

    /**
     * Run all scheduled automations for a brand (called by artisan schedule).
     */
    public static function runAllScheduled(int $brandId): array
    {
        $results = [];

        try {
            $results['CM-GEN-1_checklists_created'] = self::autoCreateDailyChecklists($brandId);
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-GEN-1', ['error' => $e->getMessage()]);
            $results['CM-GEN-1'] = 'error: ' . $e->getMessage();
        }

        try {
            $results['CM-GEN-3_late_items'] = self::markLateItems($brandId);
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-GEN-3', ['error' => $e->getMessage()]);
            $results['CM-GEN-3'] = 'error: ' . $e->getMessage();
        }

        try {
            $results['CM-A1_signals_escalated'] = self::autoEscalateSignals($brandId);
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-A1', ['error' => $e->getMessage()]);
            $results['CM-A1'] = 'error: ' . $e->getMessage();
        }

        try {
            $results['CM-A2_content_archived'] = self::autoArchiveOldContent($brandId);
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-A2', ['error' => $e->getMessage()]);
            $results['CM-A2'] = 'error: ' . $e->getMessage();
        }

        try {
            self::checkModerationThreshold($brandId);
            $results['CM-A3_moderation_check'] = 'done';
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-A3', ['error' => $e->getMessage()]);
            $results['CM-A3'] = 'error: ' . $e->getMessage();
        }

        try {
            $results['CM-A5_deadline_notified'] = self::checkPublicationDeadlines($brandId);
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-A5', ['error' => $e->getMessage()]);
            $results['CM-A5'] = 'error: ' . $e->getMessage();
        }

        try {
            $results['CM-A6_rates_updated'] = self::recalculateRates($brandId);
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-A6', ['error' => $e->getMessage()]);
            $results['CM-A6'] = 'error: ' . $e->getMessage();
        }

        try {
            $results['CM-A7_complaints_closed'] = self::autoCloseResolvedComplaints($brandId);
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-A7', ['error' => $e->getMessage()]);
            $results['CM-A7'] = 'error: ' . $e->getMessage();
        }

        return $results;
    }

    /**
     * Run end-of-day automations (called by scheduler at 20:00).
     */
    public static function runEndOfDay(int $brandId): array
    {
        $results = [];

        try {
            $results['CM-GEN-2_checklists_closed'] = self::autoCloseEndOfDay($brandId);
        } catch (\Throwable $e) {
            Log::error('cm_automation.CM-GEN-2', ['error' => $e->getMessage()]);
            $results['CM-GEN-2'] = 'error: ' . $e->getMessage();
        }

        return $results;
    }

    private static function logDecision(int $brandId, int $cmUserId, string $code, string $label, ?string $contextType, ?int $contextId, ?array $inputData, string $result): void
    {
        try {
            CmDecisionPoint::create([
                'brand_id' => $brandId,
                'cm_user_id' => $cmUserId ?: 0,
                'decision_code' => $code,
                'decision_label' => $label,
                'context_type' => $contextType,
                'context_id' => $contextId,
                'input_data' => $inputData,
                'result' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::warning('cm_decision_point.save_failed', ['error' => $e->getMessage()]);
        }
    }
}
