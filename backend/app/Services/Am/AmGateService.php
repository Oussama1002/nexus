<?php

namespace App\Services\Am;

use App\Models\AmDerogation;
use App\Models\AmGate;
use App\Models\AmGateCriterion;
use App\Models\AmRoadmap;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Encapsulates the G0→G8 lifecycle. The whole spec section §5 lives here:
 * criterion evaluation, transit request/validation/refusal, and the hard
 * server-side lock that G7 (conversion) must be reached BEFORE G5 (scaling).
 */
class AmGateService
{
    /** Direction-validated gates (spec §25 answer #3). */
    public const DIRECTION_GATES = ['G1', 'G2', 'G8'];

    /** Manager OPS gates. */
    public const OPS_GATES = ['G0', 'G3', 'G4', 'G5', 'G6', 'G7'];

    /** Hard cap on derogation validity duration (spec §25 answer #4). */
    public const DEROGATION_MAX_DAYS = 30;

    /**
     * User requests a gate transit. Recomputes criteria state and marks the
     * gate `demandee` iff every mandatory criterion is `satisfait`.
     */
    public function requestTransit(AmGate $gate, User $user, Request $request): AmGate
    {
        if (in_array($gate->status, ['franchie', 'franchie_par_derogation'], true)) {
            throw new RuntimeException('Porte déjà franchie.');
        }

        // Spec §6: G7 lock — G5 cannot be requested until G7 is franchie.
        if ($gate->code === 'G5') {
            $g7 = AmGate::query()
                ->where('roadmap_id', $gate->roadmap_id)
                ->where('code', 'G7')
                ->first();
            $g7Passed = $g7 && in_array($g7->status, ['franchie', 'franchie_par_derogation'], true);
            if (! $g7Passed) {
                throw new RuntimeException('G5 (scaling) verrouillée : G7 (conversion) doit être franchie au préalable.');
            }
        }

        $missing = $this->missingMandatoryCriteria($gate);
        if (! empty($missing)) {
            throw new RuntimeException('Critères non satisfaits : ' . implode(', ', $missing));
        }

        $before = $gate->only(['status', 'requested_by_user_id', 'requested_at']);
        $gate->fill([
            'status' => 'demandee',
            'requested_by_user_id' => $user->id,
            'requested_at' => now(),
        ])->save();

        AuditLogger::log($request, 'am_gate.transit_requested', $gate, $before, $gate->fresh()->toArray());
        return $gate->fresh();
    }

    /**
     * Validator (Manager OPS for OPS gates, Direction/admin for G1/G2/G8) approves.
     */
    public function validateTransit(AmGate $gate, User $user, Request $request): AmGate
    {
        if ($gate->status !== 'demandee') {
            throw new RuntimeException('Seule une porte demandée peut être validée.');
        }
        $this->assertValidatorRole($gate, $user);

        $before = $gate->only(['status', 'validated_by_user_id', 'validated_at']);
        DB::transaction(function () use ($gate, $user) {
            $gate->fill([
                'status' => 'franchie',
                'validated_by_user_id' => $user->id,
                'validated_at' => now(),
            ])->save();

            AmRoadmap::query()->where('id', $gate->roadmap_id)->update([
                'last_gate_transit_at' => now(),
                'current_gate_code' => $gate->code,
            ]);
        });

        AuditLogger::log($request, 'am_gate.validated', $gate, $before, $gate->fresh()->toArray());
        return $gate->fresh();
    }

    /**
     * Validator refuses the transit request with a mandatory reason.
     */
    public function refuseTransit(AmGate $gate, User $user, string $reason, Request $request): AmGate
    {
        if ($gate->status !== 'demandee') {
            throw new RuntimeException('Seule une porte demandée peut être refusée.');
        }
        $this->assertValidatorRole($gate, $user);
        if (trim($reason) === '') {
            throw new RuntimeException('Motif de refus requis.');
        }

        $before = $gate->only(['status', 'refusal_reason']);
        $gate->fill([
            'status' => 'refusee',
            'refusal_reason' => $reason,
            'validated_by_user_id' => $user->id,
            'validated_at' => now(),
        ])->save();

        AuditLogger::log($request, 'am_gate.refused', $gate, $before, $gate->fresh()->toArray());
        return $gate->fresh();
    }

    /**
     * A dérogation was accorded — flip the gate to franchie_par_derogation.
     * Validity duration must respect the 30-day cap (checked in AmDerogationService).
     */
    public function markPassedByDerogation(AmGate $gate, AmDerogation $derogation, User $user, Request $request): AmGate
    {
        $before = $gate->only(['status']);
        DB::transaction(function () use ($gate, $user) {
            $gate->fill([
                'status' => 'franchie_par_derogation',
                'validated_by_user_id' => $user->id,
                'validated_at' => now(),
            ])->save();
            AmRoadmap::query()->where('id', $gate->roadmap_id)->update([
                'last_gate_transit_at' => now(),
                'current_gate_code' => $gate->code,
            ]);
        });

        AuditLogger::log($request, 'am_gate.passed_by_derogation', $gate, $before, [
            'derogation_id' => $derogation->id,
            'expires_at' => $derogation->expires_at,
        ]);
        return $gate->fresh();
    }

    /**
     * @return list<string>  criterion labels still non-satisfait
     */
    public function missingMandatoryCriteria(AmGate $gate): array
    {
        return AmGateCriterion::query()
            ->where('gate_id', $gate->id)
            ->join('am_gate_criteria_templates as t', 't.id', '=', 'am_gate_criteria.template_id')
            ->where('t.is_mandatory', true)
            ->where('am_gate_criteria.status', '!=', 'satisfait')
            ->pluck('t.label')
            ->all();
    }

    /**
     * Assert the acting user has the right role to validate this gate.
     * G1/G2/G8 → Direction (admin). Everything else → Manager OPS.
     */
    private function assertValidatorRole(AmGate $gate, User $user): void
    {
        $user->loadMissing('roles');
        $slugs = $user->roles->pluck('slug')->all();
        $isDirection = in_array('admin', $slugs, true);
        $isOps = $isDirection || in_array('manager_operationnel', $slugs, true);

        if (in_array($gate->code, self::DIRECTION_GATES, true) && ! $isDirection) {
            throw new RuntimeException("La porte {$gate->code} doit être validée par la Direction.");
        }
        if (in_array($gate->code, self::OPS_GATES, true) && ! $isOps) {
            throw new RuntimeException("La porte {$gate->code} doit être validée par le Manager OPS.");
        }
    }
}
