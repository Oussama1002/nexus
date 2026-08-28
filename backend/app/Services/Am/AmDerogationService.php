<?php

namespace App\Services\Am;

use App\Models\AmDerogation;
use App\Models\AmGate;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use RuntimeException;

class AmDerogationService
{
    public function __construct(private readonly AmGateService $gates) {}

    public function request(AmGate $gate, array $data, User $actor, Request $request): AmDerogation
    {
        $der = AmDerogation::query()->create([
            'gate_id' => $gate->id,
            'brand_id' => $gate->brand_id,
            'requested_by_user_id' => $actor->id,
            'requested_at' => now(),
            'request_reason' => $data['request_reason'],
            'identified_risk' => $data['identified_risk'],
            'compensatory_measure' => $data['compensatory_measure'],
            'status' => 'demandee',
        ]);
        AuditLogger::log($request, 'am_derogation.requested', $der, null, $der->toArray());
        return $der;
    }

    public function decide(AmDerogation $derogation, string $decision, string $reason, ?int $validityDays, ?string $liftingCondition, User $actor, Request $request): AmDerogation
    {
        if ($derogation->status !== 'demandee') {
            throw new RuntimeException('Dérogation déjà décidée.');
        }
        if (! in_array($decision, ['accordee', 'refusee'], true)) {
            throw new RuntimeException('Décision invalide.');
        }

        $before = $derogation->only(['status', 'decided_by_user_id']);
        $update = [
            'status' => $decision,
            'decided_by_user_id' => $actor->id,
            'decided_at' => now(),
            'decision_reason' => $reason,
            'lifting_condition' => $liftingCondition,
        ];

        if ($decision === 'accordee') {
            $days = (int) ($validityDays ?? AmGateService::DEROGATION_MAX_DAYS);
            if ($days < 1) {
                throw new RuntimeException('Durée de validité invalide.');
            }
            if ($days > AmGateService::DEROGATION_MAX_DAYS) {
                throw new RuntimeException('Durée maximale de dérogation : ' . AmGateService::DEROGATION_MAX_DAYS . ' jours.');
            }
            $update['expires_at'] = now()->addDays($days);
        }

        $derogation->fill($update)->save();

        if ($decision === 'accordee' && $derogation->gate) {
            $this->gates->markPassedByDerogation($derogation->gate, $derogation, $actor, $request);
        }

        AuditLogger::log($request, 'am_derogation.decided', $derogation, $before, $derogation->fresh()->toArray());
        return $derogation->fresh();
    }

    public function lift(AmDerogation $derogation, string $liftingReason, User $actor, Request $request): AmDerogation
    {
        if ($derogation->status !== 'accordee') {
            throw new RuntimeException('Seule une dérogation accordée peut être levée.');
        }
        $before = $derogation->only(['status']);
        $derogation->fill(['status' => 'levee'])->save();
        AuditLogger::log($request, 'am_derogation.lifted', $derogation, $before, ['reason' => $liftingReason]);
        return $derogation->fresh();
    }

    /** Called by the scheduled command. Flips expired accordee to expiree. */
    public function expireDue(): int
    {
        $count = 0;
        AmDerogation::query()
            ->where('status', 'accordee')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->chunkById(200, function ($rows) use (&$count) {
                foreach ($rows as $row) {
                    $row->update(['status' => 'expiree']);
                    AuditLogger::system('am_derogation.expired', $row, ['expired_at' => now()->toIso8601String()]);
                    $count++;
                }
            });
        return $count;
    }
}
