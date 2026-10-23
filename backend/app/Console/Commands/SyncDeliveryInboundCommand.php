<?php

namespace App\Console\Commands;

use App\Models\Brand;
use App\Models\User;
use App\Services\Delivery\AmeexInboundSyncService;
use App\Services\Delivery\SenditInboundSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Tire la liste des livraisons chez Sendit/Ameex vers le CRM (statuts, colis,
 * leads) sans qu'un agent ait à cliquer « Rafraîchir ». Mêmes services que le
 * bouton du tableau de bord Livraison ; pensé pour tourner au planificateur.
 */
class SyncDeliveryInboundCommand extends Command
{
    protected $signature = 'delivery:sync-inbound
                            {--brand= : Limiter à une marque (id)}
                            {--max-pages=10 : Pages max par transporteur/marque}';

    protected $description = 'Synchronise les livraisons entrantes Sendit/Ameex pour garder le système à jour.';

    public function handle(SenditInboundSyncService $senditSync, AmeexInboundSyncService $ameexSync): int
    {
        $maxPages = min(max((int) $this->option('max-pages'), 1), 200);

        $actor = User::query()->whereHas('roles', fn ($q) => $q->where('slug', 'admin'))->first()
            ?? User::query()->orderBy('id')->first();

        if (! $actor) {
            $this->error('Aucun utilisateur trouvé ; impossible de synchroniser (acteur requis pour audit/events).');

            return self::FAILURE;
        }

        $brandOpt = $this->option('brand');
        $brandIds = $brandOpt !== null && $brandOpt !== ''
            ? [(int) $brandOpt]
            : Brand::query()->pluck('id')->all();

        $totals = ['imported' => 0, 'updated' => 0, 'events' => 0, 'total' => 0];

        foreach ($brandIds as $brandId) {
            foreach ([['sendit', $senditSync], ['ameex', $ameexSync]] as [$carrier, $service]) {
                try {
                    $result = $service->sync($brandId, $actor, $maxPages, 1);
                    $totals['imported'] += $result['imported'] ?? 0;
                    $totals['updated'] += $result['updated'] ?? 0;
                    $totals['events'] += $result['events'] ?? 0;
                    $totals['total'] += $result['total'] ?? 0;
                    $this->line(sprintf(
                        '[OK] marque %d %s — %d traités (%d nouveaux, %d maj, %d actions)',
                        $brandId, $carrier, $result['total'] ?? 0, $result['imported'] ?? 0, $result['updated'] ?? 0, $result['events'] ?? 0
                    ));
                } catch (\Throwable $e) {
                    Log::warning('delivery:sync-inbound failed', [
                        'brand_id' => $brandId,
                        'carrier' => $carrier,
                        'error' => $e->getMessage(),
                    ]);
                    $this->warn(sprintf('[WARN] marque %d %s — %s', $brandId, $carrier, $e->getMessage()));
                }
            }
        }

        $this->info(sprintf(
            'Terminé. %d colis traités (%d nouveaux, %d mis à jour, %d actions).',
            $totals['total'], $totals['imported'], $totals['updated'], $totals['events']
        ));

        return self::SUCCESS;
    }
}
