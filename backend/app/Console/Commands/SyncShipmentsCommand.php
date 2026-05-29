<?php

namespace App\Console\Commands;

use App\Models\Shipment;
use App\Models\User;
use App\Services\Delivery\ShipmentSyncService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SyncShipmentsCommand extends Command
{
    protected $signature = 'shipments:sync
                            {--company= : Filter by delivery_company id}
                            {--status= : Filter by shipment status}
                            {--limit=100 : Max shipments to process}';

    protected $description = 'Sync open shipments with their delivery provider (track API / manual).';

    public function handle(ShipmentSyncService $shipmentSyncService): int
    {
        $limit = max(1, min(500, (int) $this->option('limit')));
        $companyId = $this->option('company') !== null && $this->option('company') !== ''
            ? (int) $this->option('company')
            : null;
        $statusOpt = $this->option('status') !== null && $this->option('status') !== ''
            ? (string) $this->option('status')
            : null;

        $actor = User::query()->whereHas('roles', fn ($q) => $q->where('slug', 'admin'))->first()
            ?? User::query()->orderBy('id')->first();

        if (! $actor) {
            $this->error('No user found; cannot run sync (actor required for audit / events).');

            return self::FAILURE;
        }

        $q = Shipment::query()
            ->with('deliveryCompany')
            ->whereNotIn('status', ['delivered', 'returned', 'cancelled']);

        if ($companyId) {
            $q->where('delivery_company_id', $companyId);
        }
        if ($statusOpt) {
            $q->where('status', $statusOpt);
        }

        $shipments = $q->orderBy('id')->limit($limit)->get();

        if ($shipments->isEmpty()) {
            $this->info('No shipments to sync.');

            return self::SUCCESS;
        }

        $ok = 0;
        $failed = 0;

        foreach ($shipments as $shipment) {
            try {
                $result = $shipmentSyncService->syncShipment($shipment, $actor);
                $syncOk = (bool) ($result['provider']['ok'] ?? false);
                if ($syncOk) {
                    $this->line(sprintf('[OK] #%d %s → %s', $shipment->id, $shipment->tracking_number ?? '-', $result['mapped_status'] ?? '-'));
                    $ok++;
                } else {
                    $msg = $result['provider']['message'] ?? 'provider error';
                    $this->warn(sprintf('[WARN] #%d %s — %s', $shipment->id, $shipment->tracking_number ?? '-', $msg));
                    $failed++;
                }
            } catch (\Throwable $e) {
                Log::warning('shipments:sync failed', [
                    'shipment_id' => $shipment->id,
                    'error' => $e->getMessage(),
                ]);
                $this->error(sprintf('[ERR] #%d — %s', $shipment->id, $e->getMessage()));
                $failed++;
            }
        }

        $this->info(sprintf('Done. Success-ish: %d, issues: %d (limit %d).', $ok, $failed, $limit));

        return self::SUCCESS;
    }
}
