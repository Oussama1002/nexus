<?php

namespace App\Console\Commands;

use App\Models\Shipment;
use Illuminate\Console\Command;

/**
 * Colis sans ville : le transporteur les refuse. La ville est reprise de la
 * fiche client (livraison d'abord, facturation ensuite).
 */
class BackfillShipmentCityCommand extends Command
{
    protected $signature = 'shipments:backfill-city {--apply : Écrit les corrections au lieu de les lister}';

    protected $description = 'Complète la ville des expéditions qui n’en ont pas, depuis la fiche client.';

    public function handle(): int
    {
        $rows = Shipment::query()
            ->with('order.customer')
            ->where(fn ($q) => $q->whereNull('recipient_city')->orWhere('recipient_city', ''))
            ->get();

        if ($rows->isEmpty()) {
            $this->info('Aucune expédition sans ville.');

            return self::SUCCESS;
        }

        $apply = (bool) $this->option('apply');
        $fixed = 0;
        $stuck = 0;

        foreach ($rows as $shipment) {
            $customer = $shipment->order?->customer;
            $city = trim((string) ($customer?->delivery_city ?: $customer?->city ?: ''));
            $order = $shipment->order?->order_number ?? '—';

            if ($city === '') {
                $this->line(sprintf('  #%-7d %-18s AUCUNE VILLE SUR LA FICHE CLIENT', $shipment->id, $order));
                $stuck++;
                continue;
            }

            $this->line(sprintf('  #%-7d %-18s → %s', $shipment->id, $order, $city));
            if ($apply) {
                $shipment->recipient_city = $city;
                if (! trim((string) $shipment->recipient_address)) {
                    $shipment->recipient_address = $customer?->delivery_address ?: $customer?->address;
                }
                $shipment->save();
            }
            $fixed++;
        }

        $this->newLine();
        $this->info($apply
            ? sprintf('%d expédition(s) corrigée(s), %d sans ville exploitable.', $fixed, $stuck)
            : sprintf('%d corrigeable(s), %d sans ville exploitable. Relancez avec --apply pour écrire.', $fixed, $stuck));

        return self::SUCCESS;
    }
}
