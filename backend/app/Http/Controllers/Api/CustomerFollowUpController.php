<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerFollowUp;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerFollowUpController extends Controller
{
    /**
     * Suivis de fidélisation (spec §6.6). Par défaut : ceux de l'agent, en
     * attente et arrivant à échéance. ?scope=all pour tous les « pending ».
     */
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $user = $request->user();

        $targetId = (int) $user->id;
        $requested = (int) $request->query('user_id');
        if ($requested > 0 && $requested !== (int) $user->id && UserRoleHelper::hasGlobalScope($user)) {
            $targetId = $requested;
        }

        $q = CustomerFollowUp::query()
            ->with(['customer:id,full_name,phone,city', 'order:id,order_number'])
            ->where('assigned_user_id', $targetId)
            ->where('status', 'pending')
            ->when($brandId !== null, fn ($b) => $b->where('brand_id', $brandId))
            ->orderBy('due_at');

        if ($request->query('scope') !== 'all') {
            $q->whereDate('due_at', '<=', now()->toDateString());
        }

        $items = $q->limit(100)->get()->map(fn (CustomerFollowUp $f) => [
            'id' => $f->id,
            'sequence' => $f->sequence,
            'due_at' => optional($f->due_at)->toDateString(),
            'customer_name' => $f->customer?->full_name,
            'phone' => $f->customer?->phone,
            'city' => $f->customer?->city,
            'order_number' => $f->order?->order_number,
        ]);

        return ApiResponse::success(['items' => $items, 'total' => $items->count()], 'Suivis de fidélisation.');
    }

    /**
     * Enregistre le résultat d'un suivi, le clôture et programme le suivant.
     */
    public function complete(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'result' => ['nullable', 'string', 'max:30'],
            'opportunity' => ['nullable', 'string', 'max:30'],
            'upsell_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'schedule_next' => ['nullable', 'boolean'],
        ]);

        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $followUp = CustomerFollowUp::query()
            ->when($brandId !== null, fn ($b) => $b->where('brand_id', $brandId))
            ->findOrFail($id);

        $followUp->fill([
            'result' => $data['result'] ?? null,
            'opportunity' => $data['opportunity'] ?? null,
            'upsell_amount' => $data['upsell_amount'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => 'done',
            'completed_at' => now(),
            'updated_by' => $request->user()?->id,
        ]);
        $followUp->save();

        // Chaque suivi validé programme le suivant (spec §6.6). Cadence
        // simplifiée : hebdo jusqu'au 6e, puis quinzaine, puis mensuel.
        $next = null;
        if (($data['schedule_next'] ?? true) && $followUp->sequence < 12) {
            $increment = $followUp->sequence < 6 ? 7 : ($followUp->sequence < 8 ? 15 : 30);
            $next = CustomerFollowUp::query()->create([
                'brand_id' => $followUp->brand_id,
                'customer_id' => $followUp->customer_id,
                'order_id' => $followUp->order_id,
                'assigned_user_id' => $followUp->assigned_user_id,
                'sequence' => $followUp->sequence + 1,
                'due_at' => now()->addDays($increment)->toDateString(),
                'status' => 'pending',
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);
        }

        AuditLogger::log($request, 'customer.follow_up.complete', $followUp, null, [
            'result' => $followUp->result,
            'opportunity' => $followUp->opportunity,
            'upsell_amount' => $followUp->upsell_amount,
        ]);

        return ApiResponse::success([
            'id' => $followUp->id,
            'next_id' => $next?->id,
        ], 'Suivi enregistré.');
    }
}
