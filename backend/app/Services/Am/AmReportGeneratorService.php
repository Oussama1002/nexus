<?php

namespace App\Services\Am;

use App\Models\AmBrandEconomics;
use App\Models\AmClientReport;
use App\Models\AmReportTemplate;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Generates client-facing reports (spec §22). The publishable-fields whitelist
 * is HARD — any field the AM tries to include that isn't whitelisted is
 * stripped before persistence.
 */
class AmReportGeneratorService
{
    public function __construct(private readonly AmHealthScoreService $health) {}

    public function draft(int $brandId, int $templateId, string $period, array $sections, ?string $comment, User $actor, Request $request): AmClientReport
    {
        $tpl = AmReportTemplate::query()->findOrFail($templateId);
        $whitelist = $tpl->publishable_fields_whitelist ?: [];

        $filtered = $this->filterSections($sections, $whitelist);
        // Auto-attach health score if whitelisted
        if (in_array('health_score', $whitelist, true)) {
            $filtered['health_score'] = $this->health->computeForBrand($brandId);
        }

        $report = AmClientReport::query()->create([
            'brand_id' => $brandId,
            'template_id' => $tpl->id,
            'period' => $period,
            'sections_data_json' => $filtered,
            'account_manager_comment' => $comment,
            'status' => 'brouillon',
            'drafted_by_user_id' => $actor->id,
            'version' => 'v1',
        ]);

        AuditLogger::log($request, 'am_client_report.drafted', $report, null, $report->toArray());
        return $report;
    }

    public function validate(AmClientReport $report, User $actor, Request $request): AmClientReport
    {
        if (! in_array($report->status, ['brouillon', 'a_valider'], true)) {
            throw new RuntimeException('Rapport déjà validé ou publié.');
        }
        $before = $report->only(['status']);
        $report->fill([
            'status' => 'valide',
            'validated_by_user_id' => $actor->id,
            'validated_at' => now(),
        ])->save();
        AuditLogger::log($request, 'am_client_report.validated', $report, $before, $report->fresh()->toArray());
        return $report->fresh();
    }

    public function publish(AmClientReport $report, array $recipientUserIds, User $actor, Request $request): AmClientReport
    {
        if ($report->status !== 'valide') {
            throw new RuntimeException('Le rapport doit être validé avant publication.');
        }
        $before = $report->only(['status', 'published_at']);
        $report->fill([
            'status' => 'publie',
            'published_by_user_id' => $actor->id,
            'published_at' => now(),
            'recipient_user_ids_json' => array_values(array_unique($recipientUserIds)),
        ])->save();
        AuditLogger::log($request, 'am_client_report.published', $report, $before, [
            'recipients' => $recipientUserIds,
        ]);
        return $report->fresh();
    }

    private function filterSections(array $sections, array $whitelist): array
    {
        if (empty($whitelist)) return [];
        $out = [];
        foreach ($sections as $key => $value) {
            if (in_array($key, $whitelist, true)) {
                $out[$key] = $value;
            }
        }
        return $out;
    }
}
