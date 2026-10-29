<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierCity;
use App\Models\DeliveryCompany;
use App\Services\AuditLogger;
use App\Services\Delivery\DeliveryProviderFactory;
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
                // A-t-on déjà des villes synchronisées pour ce transporteur ?
                'cities_count' => CarrierCity::query()->where('delivery_company_id', $c->id)->count(),
            ]);

        return ApiResponse::success($carriers, 'Transporteurs disponibles.');
    }

    /** Villes desservies par un transporteur (spec §6.1). */
    public function cities(Request $request, string $id): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $q = CarrierCity::query()
            ->where('delivery_company_id', (int) $id)
            ->orderBy('name');

        if ($search !== '') {
            $q->where('normalized_name', 'like', '%'.CarrierCity::normalize($search).'%');
        }

        $cities = $q->limit(2000)->get(['id', 'name', 'external_id']);

        return ApiResponse::success($cities, 'Villes desservies.');
    }

    /**
     * Synchronise les villes desservies depuis les API transporteur.
     * Réservé à l'administration (permission delivery_companies.update).
     */
    public function sync(Request $request, DeliveryProviderFactory $factory): JsonResponse
    {
        $companies = DeliveryCompany::query()->where('status', 'active')->get();
        $result = [];

        foreach ($companies as $company) {
            $provider = $factory->forCompany($company);
            if (! method_exists($provider, 'fetchCities')) {
                $result[$company->name] = 'non supporté';
                continue;
            }

            try {
                $cities = $provider->fetchCities();
            } catch (\Throwable $e) {
                $result[$company->name] = 'erreur : '.$e->getMessage();
                continue;
            }

            $count = 0;
            foreach ($cities as $city) {
                $name = trim((string) ($city['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                CarrierCity::query()->updateOrCreate(
                    ['delivery_company_id' => $company->id, 'normalized_name' => CarrierCity::normalize($name)],
                    ['name' => $name, 'external_id' => (string) ($city['id'] ?? '')],
                );
                $count++;
            }
            $result[$company->name] = $count.' ville(s)';
        }

        AuditLogger::log($request, 'delivery.cities.sync', null, null, $result);

        return ApiResponse::success($result, 'Synchronisation des villes terminée.');
    }
}
