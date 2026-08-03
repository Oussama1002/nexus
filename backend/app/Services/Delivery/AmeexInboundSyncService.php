<?php

namespace App\Services\Delivery;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\User;
use App\Services\Delivery\Providers\AmeexDeliveryProvider;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AmeexInboundSyncService
{
    public function __construct(
        protected ShipmentStatusMapper $mapper,
        protected DeliveryCarrierResolver $carriers,
    ) {}

    public function sync(int $brandId, User $actor, int $maxPages = 30, int $startPage = 1): array
    {
        $company = $this->carriers->resolve('ameex', $brandId);

        if (! $company) {
            return $this->emptyResult();
        }

        $apiId = trim((string) ($company->api_key_ref ?? ''));
        $apiKey = trim((string) ($company->api_key ?? ''));

        if ($apiId === '' || $apiKey === '') {
            return $this->emptyResult();
        }

        $provider = new AmeexDeliveryProvider($company);
        $imported = 0;
        $updated = 0;
        $events = 0;
        $pages = 0;
        $total = 0;
        $errors = [];

        $existingCodes = Shipment::query()
            ->where('brand_id', $brandId)
            ->where('delivery_company_id', $company->id)
            ->where(function ($q) {
                $q->whereNotNull('tracking_number')->orWhereNotNull('external_tracking_id');
            })
            ->get(['tracking_number', 'external_tracking_id'])
            ->flatMap(fn (Shipment $s) => array_filter([
                $s->tracking_number,
                $s->external_tracking_id,
            ]))
            ->flip()
            ->all();

        $perPage = 100;

        for ($page = max(1, $startPage); $page <= $startPage + $maxPages - 1; $page++) {
            $list = $provider->listDeliveries($page, $perPage);
            if (! ($list['ok'] ?? false)) {
                if ($page === max(1, $startPage)) {
                    $errors[] = (string) ($list['message'] ?? 'Échec lecture Ameex.');
                }
                break;
            }

            $items = is_array($list['data']['items'] ?? null) ? $list['data']['items'] : [];
            if ($items === []) {
                break;
            }

            $pages++;
            $total += count($items);

            foreach ($items as $item) {
                $code = (string) ($item['TBL_CODE'] ?? '');
                if ($code === '') {
                    continue;
                }

                try {
                    $result = $this->upsertDelivery($brandId, $company->id, $actor, $item, $code);
                    if ($result['created']) {
                        $imported++;
                        $existingCodes[$code] = true;
                    } else {
                        $updated++;
                    }
                    $events += $result['events'];
                } catch (\Throwable $e) {
                    $errors[] = sprintf('%s: %s', $code, $e->getMessage());
                }
            }

            $hasMore = $list['data']['has_more'] ?? false;
            if (! $hasMore) {
                break;
            }
        }

        return compact('imported', 'updated', 'events', 'pages', 'total', 'errors') + [
            'has_more' => false,
            'next_page' => 1,
        ];
    }

    protected function upsertDelivery(int $brandId, int $companyId, User $actor, array $item, string $code): array
    {
        $carrierStatus = $this->stripHtml($item['TBL_STATUT'] ?? '');
        $carrierStatus = preg_replace('/[؀-ۿ\s]+$/u', '', $carrierStatus);
        $internalStatus = $this->mapAmeexStatus($carrierStatus);

        $city = (string) ($item['TBL_CITY'] ?? '');
        $address = (string) ($item['TBL_ADDRESS'] ?? '');
        $cod = (float) $this->stripHtml($item['TBL_COD'] ?? '0');
        $createdAt = $this->parseDate($item['TBL_C_DATE'] ?? null);
        $pickupAt = $this->parseDate($item['TBL_P_DATE'] ?? null);
        $deliveredAt = $this->parseDate($item['TBL_D_DATE'] ?? null);
        $returnedAt = $this->parseDate($item['TBL_RTN_R_DATE'] ?? null);

        return DB::transaction(function () use (
            $brandId, $companyId, $actor, $item, $code,
            $carrierStatus, $internalStatus, $city, $address, $cod,
            $createdAt, $pickupAt, $deliveredAt, $returnedAt,
        ) {
            $existing = Shipment::query()
                ->where('brand_id', $brandId)
                ->where(function ($q) use ($code) {
                    $q->where('tracking_number', $code)->orWhere('external_tracking_id', $code);
                })
                ->lockForUpdate()
                ->first();

            $created = $existing === null;
            $previousStatus = $existing?->status;

            $payload = [
                'brand_id' => $brandId,
                'delivery_company_id' => $companyId,
                'tracking_number' => $code,
                'external_tracking_id' => $code,
                'status' => $internalStatus,
                'carrier_status' => $carrierStatus,
                'carrier_response_json' => $item,
                'carrier_last_sync_at' => now(),
                'sync_error' => null,
                'recipient_name' => (string) ($item['TBL_RECEIVER'] ?? ''),
                'recipient_phone' => (string) ($item['TBL_PHONE'] ?? ''),
                'recipient_city' => $city,
                'city' => $city,
                'recipient_address' => $address,
                'address' => $address,
                'cod_amount' => $cod,
                'notes' => (string) ($item['TBL_NOTE'] ?? ''),
            ];

            if (! $existing) {
                if ($cod <= 0) {
                    $payload['payment_status'] = 'not_applicable';
                } elseif ($internalStatus === 'delivered') {
                    $payload['payment_status'] = 'cod_received';
                } else {
                    $payload['payment_status'] = 'cod_pending';
                }
            } elseif (! in_array($existing->payment_status, ['cod_received', 'reconciled'], true)) {
                if ($internalStatus === 'delivered' && $cod > 0) {
                    $payload['payment_status'] = 'cod_received';
                }
            }

            if ($createdAt) {
                $payload['shipped_at'] = $pickupAt ?? $createdAt;
            }
            if ($internalStatus === 'delivered' && $deliveredAt) {
                $payload['delivered_at'] = $deliveredAt;
            }
            if ($internalStatus === 'returned' && $returnedAt) {
                $payload['returned_at'] = $returnedAt;
            }

            if ($existing) {
                $existing->fill($payload);
                $existing->save();
                $shipment = $existing->fresh();
            } else {
                $payload['created_by'] = $actor->id;
                $shipment = Shipment::query()->create($payload);
            }

            if ($created && $shipment->order_id === null) {
                $this->createOrderForShipment($shipment);
            }

            $eventCount = 0;

            if ($created) {
                $this->addEvent($shipment, $actor, 'imported', $internalStatus, 'Importé depuis Ameex', $item, $createdAt);
                $eventCount++;
            } elseif ($previousStatus !== null && $previousStatus !== $internalStatus) {
                $this->addEvent(
                    $shipment, $actor, 'status_changed', $internalStatus,
                    sprintf('Ameex: %s → %s', $previousStatus, $internalStatus),
                    $item, null
                );
                $eventCount++;
            }

            return ['created' => $created, 'events' => $eventCount];
        });
    }

    protected function createOrderForShipment(Shipment $shipment): void
    {
        $customer = null;
        $phone = $shipment->recipient_phone;
        $name = $shipment->recipient_name;

        if ($phone) {
            $customer = Customer::query()
                ->where('brand_id', $shipment->brand_id)
                ->where(function ($q) use ($phone) {
                    $q->where('phone', $phone)->orWhere('phone_secondary', $phone);
                })
                ->first();
        }

        if (! $customer && ($name || $phone)) {
            $customer = Customer::query()->create([
                'brand_id' => $shipment->brand_id,
                'full_name' => $name ?? 'Client inconnu',
                'phone' => $phone ?? '',
                'city' => $shipment->recipient_city ?? $shipment->city ?? '',
                'address' => $shipment->recipient_address ?? $shipment->address ?? '',
                'client_source' => 'carrier_import',
                'status' => 'active',
            ]);
        }

        $statusMap = [
            'delivered' => 'delivered', 'returned' => 'returned', 'cancelled' => 'cancelled',
            'in_transit' => 'confirmed', 'shipped' => 'confirmed', 'picked_up' => 'confirmed',
            'out_for_delivery' => 'confirmed', 'created' => 'pending', 'pending' => 'pending', 'failed' => 'pending',
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
        ]);

        $shipment->order_id = $order->id;
        $shipment->save();
    }

    protected function mapAmeexStatus(string $raw): string
    {
        $s = mb_strtolower(trim($raw));

        if (str_starts_with($s, 'livré')) {
            return 'delivered';
        }
        if (str_starts_with($s, 'retourné')) {
            return 'returned';
        }
        if (str_starts_with($s, 'annulé')) {
            return 'cancelled';
        }
        if (str_starts_with($s, 'refusé')) {
            return 'returned';
        }
        if (str_starts_with($s, 'expédié')) {
            return 'in_transit';
        }
        if (str_starts_with($s, 'en cours')) {
            return 'in_transit';
        }
        if (str_starts_with($s, 'ramassé') || str_starts_with($s, 'reçu')) {
            return 'picked_up';
        }
        if (str_starts_with($s, 'reporté') || str_starts_with($s, 'programmé')) {
            return 'out_for_delivery';
        }
        if (str_starts_with($s, 'nouveau')) {
            return 'created';
        }
        if (str_starts_with($s, 'facturé') || str_starts_with($s, 'facture')) {
            return 'delivered';
        }
        if (str_starts_with($s, 'mise en distribution') || str_starts_with($s, 'en distribution')) {
            return 'out_for_delivery';
        }
        if (str_contains($s, 'pas de réponse') || str_contains($s, 'boîte vocale') || str_starts_with($s, 'relancer')) {
            return 'failed';
        }
        if (str_contains($s, 'hors-zone') || str_contains($s, 'en voyage')) {
            return 'in_transit';
        }

        return $this->mapper->toInternal($raw) ?? 'created';
    }

    protected function addEvent(
        Shipment $shipment, User $actor, string $type, ?string $status,
        string $note, array $payload, ?Carbon $at = null,
    ): void {
        ShipmentEvent::query()->create([
            'shipment_id' => $shipment->id,
            'actor_user_id' => $actor->id,
            'event_type' => $type,
            'status' => $status,
            'note' => $note,
            'description' => $note,
            'raw_payload_json' => $payload,
            'event_at' => $at ?? now(),
        ]);
    }

    protected function parseDate(mixed $value): ?Carbon
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function stripHtml(string $html): string
    {
        return trim(strip_tags($html));
    }

    private function emptyResult(array $errors = []): array
    {
        return [
            'imported' => 0, 'updated' => 0, 'events' => 0,
            'pages' => 0, 'total' => 0, 'errors' => $errors,
            'has_more' => false, 'next_page' => 1,
        ];
    }
}
