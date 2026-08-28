<?php

namespace App\Http\Middleware;

use App\Models\AmGate;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks module-scoped writes until the given AM gate has been passed for the
 * request's brand. Middleware signature:
 *
 *   ->middleware('am.gate:G3')          // requires G3 franchie/franchie_par_derogation
 *   ->middleware('am.gate:G3,scaling')  // G3 for creation, and G5+G7 for scaling
 *
 * `scaling` (or any second arg equal to "scaling") layers the spec §6 lock:
 * G5 alone is not enough — G7 must also be passed (server-side belt-and-braces
 * to complement AmGateService's own check inside this app's UI-driven flows).
 */
class EnsureAmGate
{
    public function handle(Request $request, Closure $next, string $requiredGate = 'G3', ?string $mode = null): Response
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        if (! $brandId) {
            // No brand context = nothing to gate on. Let the controller decide.
            return $next($request);
        }

        if (! $this->gatePassed($brandId, $requiredGate)) {
            return ApiResponse::error(
                "Action bloquée : la porte {$requiredGate} de la feuille de route de la marque n'est pas franchie.",
                ['required_gate' => $requiredGate],
                423,
            );
        }

        if ($mode === 'scaling') {
            if (! $this->gatePassed($brandId, 'G7')) {
                return ApiResponse::error(
                    "Scaling verrouillé : la porte G7 (conversion) doit être franchie avant toute action de scaling.",
                    ['required_gate' => 'G7'],
                    423,
                );
            }
            if (! $this->gatePassed($brandId, 'G5')) {
                return ApiResponse::error(
                    "Scaling verrouillé : la porte G5 (scaling) doit être franchie.",
                    ['required_gate' => 'G5'],
                    423,
                );
            }
        }

        return $next($request);
    }

    private function gatePassed(int $brandId, string $code): bool
    {
        return AmGate::query()
            ->where('brand_id', $brandId)
            ->where('code', $code)
            ->whereIn('status', ['franchie', 'franchie_par_derogation'])
            ->exists();
    }
}
