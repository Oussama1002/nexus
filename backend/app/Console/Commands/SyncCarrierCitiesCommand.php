<?php

namespace App\Console\Commands;

use App\Models\CarrierCity;
use App\Models\DeliveryCompany;
use App\Services\Delivery\DeliveryProviderFactory;
use Illuminate\Console\Command;

class SyncCarrierCitiesCommand extends Command
{
    protected $signature = 'delivery:sync-cities';

    protected $description = 'Synchronise les villes desservies par chaque transporteur depuis leur API (spec Confirmatrice §6.1).';

    public function handle(DeliveryProviderFactory $factory): int
    {
        $companies = DeliveryCompany::query()->where('status', 'active')->get();

        foreach ($companies as $company) {
            $provider = $factory->forCompany($company);
            if (! method_exists($provider, 'fetchCities')) {
                $this->line("{$company->name} : non supporté.");
                continue;
            }

            try {
                $cities = $provider->fetchCities();
            } catch (\Throwable $e) {
                $this->error("{$company->name} : erreur — {$e->getMessage()}");
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
            $this->info("{$company->name} : {$count} ville(s) synchronisée(s).");
        }

        return self::SUCCESS;
    }
}
