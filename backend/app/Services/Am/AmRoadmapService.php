<?php

namespace App\Services\Am;

use App\Models\AmChantier;
use App\Models\AmChantierTemplate;
use App\Models\AmGate;
use App\Models\AmGateCriteriaTemplate;
use App\Models\AmGateCriterion;
use App\Models\AmGateTemplate;
use App\Models\AmRoadmap;
use App\Models\AmRoadmapTemplate;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Opens a roadmap for a brand: clones the chosen template's chantiers, gates,
 * and gate criteria into instance rows. Only one active roadmap per brand.
 */
class AmRoadmapService
{
    public function open(int $brandId, int $templateId, ?int $accountManagerUserId, User $actor, Request $request): AmRoadmap
    {
        $existing = AmRoadmap::query()
            ->where('brand_id', $brandId)
            ->whereIn('status', ['non_demarree', 'en_cours', 'suspendue'])
            ->first();
        if ($existing) {
            throw new RuntimeException('Une feuille de route active existe déjà pour cette marque.');
        }
        $template = AmRoadmapTemplate::query()->findOrFail($templateId);

        return DB::transaction(function () use ($brandId, $template, $accountManagerUserId, $actor, $request) {
            $roadmap = AmRoadmap::query()->create([
                'brand_id' => $brandId,
                'template_id' => $template->id,
                'status' => 'en_cours',
                'brand_lifecycle_stage' => 'cadrage',
                'account_manager_user_id' => $accountManagerUserId,
                'opened_by_user_id' => $actor->id,
                'opened_at' => now(),
                'current_gate_code' => 'G0',
            ]);

            $chantiersByCode = [];
            foreach (AmChantierTemplate::query()->where('roadmap_template_id', $template->id)->orderBy('sort_order')->get() as $ct) {
                $ch = AmChantier::query()->create([
                    'roadmap_id' => $roadmap->id,
                    'template_id' => $ct->id,
                    'brand_id' => $brandId,
                    'code' => $ct->code,
                    'status' => 'verrouille',
                ]);
                $chantiersByCode[$ct->id] = $ch;
            }

            foreach (AmGateTemplate::query()->where('roadmap_template_id', $template->id)->orderBy('sort_order')->get() as $gt) {
                $gate = AmGate::query()->create([
                    'roadmap_id' => $roadmap->id,
                    'template_id' => $gt->id,
                    'chantier_id' => $gt->chantier_template_id ? ($chantiersByCode[$gt->chantier_template_id]->id ?? null) : null,
                    'brand_id' => $brandId,
                    'code' => $gt->code,
                    'status' => $gt->code === 'G0' ? 'criteres_en_cours' : 'non_atteinte',
                ]);
                foreach (AmGateCriteriaTemplate::query()->where('gate_template_id', $gt->id)->orderBy('sort_order')->get() as $crit) {
                    AmGateCriterion::query()->create([
                        'gate_id' => $gate->id,
                        'template_id' => $crit->id,
                        'status' => 'non_satisfait',
                    ]);
                }
            }

            AuditLogger::log($request, 'am_roadmap.opened', $roadmap, null, $roadmap->toArray());
            return $roadmap->fresh(['chantiers', 'gates.criteria']);
        });
    }

    public function close(AmRoadmap $roadmap, string $summary, User $actor, Request $request): AmRoadmap
    {
        if ($roadmap->status === 'terminee' || $roadmap->status === 'abandonnee') {
            throw new RuntimeException('Feuille de route déjà clôturée.');
        }
        $before = $roadmap->only(['status', 'closure_summary']);
        $roadmap->fill([
            'status' => 'terminee',
            'closure_summary' => $summary,
        ])->save();
        AuditLogger::log($request, 'am_roadmap.closed', $roadmap, $before, $roadmap->fresh()->toArray());
        return $roadmap->fresh();
    }

    public function suspend(AmRoadmap $roadmap, string $reason, User $actor, Request $request): AmRoadmap
    {
        $before = $roadmap->only(['status']);
        $roadmap->fill(['status' => 'suspendue', 'notes' => trim(($roadmap->notes ?? '') . "\n[Suspension] {$reason}")])->save();
        AuditLogger::log($request, 'am_roadmap.suspended', $roadmap, $before, ['reason' => $reason]);
        return $roadmap->fresh();
    }

    public function resume(AmRoadmap $roadmap, User $actor, Request $request): AmRoadmap
    {
        if ($roadmap->status !== 'suspendue') {
            throw new RuntimeException('Seule une feuille de route suspendue peut être reprise.');
        }
        $before = $roadmap->only(['status']);
        $roadmap->fill(['status' => 'en_cours'])->save();
        AuditLogger::log($request, 'am_roadmap.resumed', $roadmap, $before, $roadmap->fresh()->toArray());
        return $roadmap->fresh();
    }
}
