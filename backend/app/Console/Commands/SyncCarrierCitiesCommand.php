<?php

namespace App\Console\Commands;

use App\Services\Delivery\CarrierCitySyncService;
use Illuminate\Console\Command;

class SyncCarrierCitiesCommand extends Command
{
    protected $signature = 'delivery:sync-cities';

    protected $description = 'Synchronise les villes desservies par chaque transporteur depuis leur API (spec Confirmatrice §6.1).';

    public function handle(CarrierCitySyncService $sync): int
    {
        foreach ($sync->syncAll() as $name => $result) {
            $this->info("{$name} : {$result}");
        }

        return self::SUCCESS;
    }
}
