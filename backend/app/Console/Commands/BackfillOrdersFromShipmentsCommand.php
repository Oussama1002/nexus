<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Shipment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillOrdersFromShipmentsCommand extends Command
{
    protected $signature = 'shipments:backfill-orders {--dry-run : Show what would be created without creating}';
    protected $description = 'Create orders for shipments that have no linked order';

    public function handle(): int
    {
        $query = Shipment::query()->whereNull('order_id');
        $total = $query->count();

        if ($total === 0) {
            $this->info('All shipments already have linked orders.');
            return 0;
        }

        $this->info("Found {$total} shipments without orders.");

        if ($this->option('dry-run')) {
            $this->warn('Dry run — no changes made.');
            return 0;
        }

        $bar = $this->output->createProgressBar($total);
        $created = 0;

        $query->chunkById(200, function ($shipments) use ($bar, &$created) {
            foreach ($shipments as $shipment) {
                DB::transaction(function () use ($shipment, &$created) {
                    $this->createOrderFromShipment($shipment);
                    $created++;
                });
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("Created {$created} orders from shipments.");

        return 0;
    }

    protected function createOrderFromShipment(Shipment $shipment): void
    {
        $customer = $this->findOrCreateCustomer($shipment);

        $statusMap = [
            'delivered' => 'delivered',
            'returned' => 'returned',
            'cancelled' => 'cancelled',
            'in_transit' => 'confirmed',
            'shipped' => 'confirmed',
            'picked_up' => 'confirmed',
            'out_for_delivery' => 'confirmed',
            'created' => 'pending',
            'pending' => 'pending',
            'failed' => 'pending',
        ];

        $order = Order::query()->create([
            'brand_id' => $shipment->brand_id,
            'customer_id' => $customer?->id,
            'order_number' => Order::generateUniqueOrderNumber(),
            'source' => 'carrier_import',
            'status' => $statusMap[$shipment->status] ?? 'pending',
            'payment_method' => 'cod',
            'payment_state' => $shipment->status === 'delivered' ? 'paid' : 'cod_pending',
            'subtotal' => $shipment->cod_amount ?? 0,
            'shipping_fee' => $shipment->delivery_fee ?? 0,
            'discount' => 0,
            'total' => $shipment->cod_amount ?? 0,
            'shipping_address' => trim(($shipment->recipient_address ?? $shipment->address ?? '') . ' ' . ($shipment->recipient_city ?? $shipment->city ?? '')),
            'notes' => $shipment->notes,
            'confirmed_at' => in_array($shipment->status, ['delivered', 'in_transit', 'shipped', 'picked_up', 'out_for_delivery']) ? ($shipment->shipped_at ?? $shipment->created_at) : null,
            'delivered_at' => $shipment->delivered_at,
            'created_at' => $shipment->created_at,
            'updated_at' => $shipment->updated_at,
        ]);

        $shipment->order_id = $order->id;
        $shipment->save();
    }

    protected function findOrCreateCustomer(Shipment $shipment): ?Customer
    {
        $name = $shipment->recipient_name;
        $phone = $shipment->recipient_phone;

        if (! $name && ! $phone) {
            return null;
        }

        if ($phone) {
            $existing = Customer::query()
                ->where('brand_id', $shipment->brand_id)
                ->where(function ($q) use ($phone) {
                    $q->where('phone', $phone)->orWhere('phone_secondary', $phone);
                })
                ->first();

            if ($existing) {
                return $existing;
            }
        }

        return Customer::query()->create([
            'brand_id' => $shipment->brand_id,
            'full_name' => $name ?? 'Client inconnu',
            'phone' => $phone ?? '',
            'city' => $shipment->recipient_city ?? $shipment->city ?? '',
            'address' => $shipment->recipient_address ?? $shipment->address ?? '',
            'client_source' => 'carrier_import',
            'status' => 'active',
        ]);
    }
}
