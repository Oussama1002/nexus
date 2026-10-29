<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierCity;
use App\Models\DeliveryCompany;
use App\Services\Delivery\CarrierCitySyncService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryCityController extends Controller
{
    /** Transporteurs actifs proposés à la création d'une commande (spec §6.1). */
    public function carriers(): JsonResponse
    {
        $carriers = DeliveryCompany::query()
            ->where('status', 'active')
            ->orderBy('name')
            ->get(['id', 'name', 'code'])
            ->map(fn (DeliveryCompany $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'code' => $c->code,
                'cities_count' => CarrierCity::query()->where('delivery_company_id', $c->id)->count(),
            ]);

        return ApiResponse::success($carriers, 'Transporteurs disponibles.');
    }

    /**
     * Villes desservies par un transporteur (spec §6.1). Si la table est encore
     * vide pour ce transporteur, elle est synchronisée automatiquement à la
     * volée depuis l'API (puis rafraîchie chaque nuit par le planificateur).
     */
    public function cities(Request $request, string $id, CarrierCitySyncService $sync): JsonResponse
    {
        $companyId = (int) $id;

        $hasCities = CarrierCity::query()->where('delivery_company_id', $companyId)->exists();
        if (! $hasCities) {
            $company = DeliveryCompany::query()->find($companyId);
            if ($company) {
                $sync->syncCompany($company);
            }
        }

        $search = trim((string) $request->query('search', ''));
        $q = CarrierCity::query()
            ->where('delivery_company_id', $companyId)
            ->orderBy('name');

        if ($search !== '') {
            $q->where('normalized_name', 'like', '%'.CarrierCity::normalize($search).'%');
        }

        $cities = $q->limit(2000)->get(['id', 'name', 'external_id']);

        return ApiResponse::success($cities, 'Villes desservies.');
    }
}
