<?php

namespace App\Services\Delivery;

use App\Models\CarrierCity;
use App\Models\DeliveryCompany;

class CarrierCitySyncService
{
    public function __construct(private DeliveryProviderFactory $factory)
    {
    }

    /**
     * Synchronise les villes de tous les transporteurs actifs.
     *
     * @return array<string, string>
     */
    public function syncAll(): array
    {
        $result = [];
        foreach (DeliveryCompany::query()->where('status', 'active')->get() as $company) {
            $result[$company->name] = $this->syncCompany($company);
        }

        return $result;
    }

    /** Synchronise les villes d'un transporteur. Retourne un libellé de résultat. */
    public function syncCompany(DeliveryCompany $company): string
    {
        $provider = $this->factory->forCompany($company);
        if (! method_exists($provider, 'fetchCities')) {
            return 'non supporté';
        }

        try {
            $cities = $provider->fetchCities();
        } catch (\Throwable $e) {
            return 'erreur : '.$e->getMessage();
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

        return $count.' ville(s)';
    }
}
