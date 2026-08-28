<?php

namespace App\Services\Am;

use App\Models\AmComplianceCheck;
use App\Models\AmDiffusionSuspension;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Product compliance (spec §17). Auto-suspends brand diffusion when status
 * flips to `non_conforme`, and reopens it when lifted.
 */
class AmComplianceService
{
    public function update(AmComplianceCheck $check, array $data, User $actor, Request $request): AmComplianceCheck
    {
        $before = $check->toArray();
        $check->fill($data)->save();

        if (($before['status'] ?? null) !== 'non_conforme' && $check->status === 'non_conforme') {
            $this->autoSuspend($check, $actor, $request);
        }

        AuditLogger::log($request, 'am_compliance.updated', $check, $before, $check->fresh()->toArray());
        return $check->fresh();
    }

    public function suspend(AmComplianceCheck $check, string $reason, User $actor, Request $request): AmDiffusionSuspension
    {
        $sus = AmDiffusionSuspension::query()->create([
            'brand_id' => $check->brand_id,
            'compliance_check_id' => $check->id,
            'product_id' => $check->product_id,
            'reason' => $reason,
            'suspended_by_user_id' => $actor->id,
            'suspended_at' => now(),
            'is_active' => true,
        ]);
        AuditLogger::log($request, 'am_diffusion.suspended', $sus, null, $sus->toArray());
        return $sus;
    }

    public function lift(AmDiffusionSuspension $sus, string $liftingReason, User $actor, Request $request): AmDiffusionSuspension
    {
        if (! $sus->is_active) {
            throw new RuntimeException('Suspension déjà levée.');
        }
        $before = $sus->only(['is_active']);
        $sus->fill([
            'is_active' => false,
            'lifted_by_user_id' => $actor->id,
            'lifted_at' => now(),
            'lifting_reason' => $liftingReason,
        ])->save();
        AuditLogger::log($request, 'am_diffusion.lifted', $sus, $before, $sus->fresh()->toArray());
        return $sus->fresh();
    }

    private function autoSuspend(AmComplianceCheck $check, User $actor, Request $request): void
    {
        $reason = 'Auto-suspension : conformité produit déclarée non conforme.';
        $this->suspend($check, $reason, $actor, $request);
    }

    /** For guards in Media Buying / SMM: is brand+product diffusion blocked? */
    public function isDiffusionBlocked(int $brandId, ?int $productId = null): bool
    {
        return AmDiffusionSuspension::query()
            ->where('brand_id', $brandId)
            ->when($productId, fn ($q) => $q->where('product_id', $productId))
            ->where('is_active', true)
            ->exists();
    }
}
