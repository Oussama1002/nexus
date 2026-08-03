<?php

namespace App\Services\Delivery;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\User;
use App\Services\Delivery\Providers\SenditDeliveryProvider;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SenditInboundSyncService
{
    public function __construct(
        protected ShipmentStatusMapper $mapper,
        protected DeliveryCarrierResolver $carriers,
    ) {}

    /**
     * Import / refresh shipments from Sendit into Nexus (colis + statuts + audits).
     *
     * @return array{imported: int, updated: int, events: int, pages: int, total: int, errors: list<string>, has_more: bool, next_page: int}
     */
    public function sync(int $brandId, User $actor, int $maxPages = 30, int $startPage = 1): array
    {
        $company = $this->carriers->resolve('sendit', $brandId);

        if (! $company) {
            return [
                'imported' => 0,
                'updated' => 0,
                'events' => 0,
                'pages' => 0,
                'total' => 0,
                'errors' => ['Transporteur Sendit introuvable ou inactif.'],
                'has_more' => false,
                'next_page' => 1,
            ];
        }

        if (trim((string) ($company->api_key_ref ?? '')) === '' || trim((string) ($company->api_key ?? '')) === '') {
            return [
                'imported' => 0,
                'updated' => 0,
                'events' => 0,
                'pages' => 0,
                'total' => 0,
                'errors' => ['Clés API Sendit manquantes — configurez-les dans Paramètres → Livraison ou dans le fichier .env du serveur.'],
                'has_more' => false,
                'next_page' => 1,
            ];
        }

        $provider = new SenditDeliveryProvider($company);
        $imported = 0;
        $updated = 0;
        $events = 0;
        $pages = 0;
        $total = 0;
        $errors = [];
        $lastPageItemCount = 0;
        $nextPage = max(1, $startPage);

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

        $pageLimit = max(1, $maxPages);
        $endPage = max(1, $startPage) + $pageLimit - 1;

        for ($page = max(1, $startPage); $page <= $endPage; $page++) {
            $list = $provider->listDeliveries($page);
            if (! ($list['ok'] ?? false)) {
                if ($page === max(1, $startPage)) {
                    $errors[] = (string) ($list['message'] ?? 'Échec lecture Sendit.');
                }

                break;
            }

            /** @var list<array<string, mixed>> $items */
            $items = is_array($list['data']['items'] ?? null) ? $list['data']['items'] : [];
            if ($items === []) {
                break;
            }

            $pages++;
            $lastPageItemCount = count($items);
            $total += $lastPageItemCount;
            $nextPage = $page + 1;

            foreach ($items as $item) {
                $code = (string) ($item['code'] ?? '');
                if ($code === '') {
                    continue;
                }

                $isKnown = isset($existingCodes[$code]);
                if ($isKnown) {
                    $delivery = $item;
                } else {
                    $detail = $provider->getDelivery($code);
                    $delivery = ($detail['ok'] ?? false) && is_array($detail['data']['delivery'] ?? null)
                        ? $detail['data']['delivery']
                        : $item;
                }

                try {
                    $result = $this->upsertDeliveryWithRetry($brandId, $company->id, $actor, $delivery);
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

            if ($lastPageItemCount < 10) {
                break;
            }
        }

        $hasMore = $pages === $pageLimit && $lastPageItemCount >= 10;

        return compact('imported', 'updated', 'events', 'pages', 'total', 'errors') + [
            'has_more' => $hasMore,
            'next_page' => $nextPage,
        ];
    }

    /**
     * @param  array<string, mixed>  $delivery
     * @return array{created: bool, events: int}
     */
    protected function upsertDeliveryWithRetry(int $brandId, int $companyId, User $actor, array $delivery): array
    {
        $attempts = 0;
        while (true) {
            try {
                return $this->upsertDelivery($brandId, $companyId, $actor, $delivery);
            } catch (\Throwable $e) {
                $attempts++;
                if ($attempts >= 3 || ! str_contains($e->getMessage(), 'database is locked')) {
                    throw $e;
                }
                usleep(200_000 * $attempts);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $delivery
     * @return array{created: bool, events: int}
     */
    protected function upsertDelivery(int $brandId, int $companyId, User $actor, array $delivery): array
    {
        $code = (string) ($delivery['code'] ?? '');
        $carrierStatus = (string) ($delivery['status'] ?? '');
        $internalStatus = $this->mapper->toInternal($carrierStatus) ?? 'created';

        $district = is_array($delivery['district'] ?? null) ? $delivery['district'] : [];
        $city = (string) ($district['name'] ?? $district['ville'] ?? '');
        $amount = (float) ($delivery['amount'] ?? 0);
        $fee = (float) ($delivery['fee'] ?? 0);
        $createdAt = $this->parseDate($delivery['created_at'] ?? null);
        $lastActionAt = $this->parseDate($delivery['last_action_at'] ?? null);

        return DB::transaction(function () use (
            $brandId,
            $companyId,
            $actor,
            $delivery,
            $code,
            $carrierStatus,
            $internalStatus,
            $city,
            $amount,
            $fee,
            $createdAt,
            $lastActionAt,
        ) {
            /** @var Shipment|null $existing */
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
                'carrier_response_json' => $delivery,
                'carrier_last_sync_at' => now(),
                'sync_error' => null,
                'recipient_name' => (string) ($delivery['name'] ?? ''),
                'recipient_phone' => (string) ($delivery['phone'] ?? ''),
                'recipient_city' => $city,
                'city' => $city,
                'recipient_address' => (string) ($delivery['address'] ?? ''),
                'address' => (string) ($delivery['address'] ?? ''),
                'cod_amount' => $amount,
                'delivery_fee' => $fee,
                'notes' => (string) ($delivery['comment'] ?? ''),
            ];

            if (! $existing) {
                $payload['payment_status'] = $amount > 0 ? 'cod_pending' : 'not_applicable';
            } elseif (! in_array($existing->payment_status, ['cod_received', 'reconciled'], true)) {
                if ($internalStatus === 'delivered' && $amount > 0) {
                    $payload['payment_status'] = 'cod_received';
                }
            }

            if ($createdAt) {
                $payload['shipped_at'] = $payload['shipped_at'] ?? $createdAt;
            }
            if ($internalStatus === 'delivered' && $lastActionAt) {
                $payload['delivered_at'] = $lastActionAt;
            }
            if ($internalStatus === 'returned' && $lastActionAt) {
                $payload['returned_at'] = $lastActionAt;
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
                $this->addEvent($shipment, $actor, 'imported', $internalStatus, 'Importé depuis Sendit', $delivery, $createdAt);
                $eventCount++;
            } elseif ($previousStatus !== null && $previousStatus !== $internalStatus) {
                $this->addEvent(
                    $shipment,
                    $actor,
                    'status_changed',
                    $internalStatus,
                    sprintf('Sendit: %s → %s', $previousStatus, $internalStatus),
                    $delivery,
                    $lastActionAt
                );
                $eventCount++;
            }

            $audits = is_array($delivery['audits'] ?? null) ? $delivery['audits'] : [];
            foreach ($audits as $audit) {
                if (! is_array($audit)) {
                    continue;
                }
                $auditStatus = is_array($audit['data'] ?? null)
                    ? (string) ($audit['data']['status'] ?? '')
                    : '';
                $mappedAudit = $this->mapper->toInternal($auditStatus) ?? $auditStatus;
                $note = trim(sprintf(
                    'Sendit — %s (%s)',
                    (string) ($audit['event'] ?? 'action'),
                    (string) ($audit['user'] ?? 'Sendit')
                ));
                $at = $this->parseDate(is_array($audit['data'] ?? null) ? ($audit['data']['last_action_at'] ?? null) : null);

                $exists = ShipmentEvent::query()
                    ->where('shipment_id', $shipment->id)
                    ->where('note', $note)
                    ->where('status', $mappedAudit !== '' ? $mappedAudit : null)
                    ->exists();

                if ($exists) {
                    continue;
                }

                $this->addEvent(
                    $shipment,
                    $actor,
                    'carrier_audit',
                    $mappedAudit !== '' ? $mappedAudit : null,
                    $note,
                    $audit,
                    $at
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

    /**
     * @param  array<string, mixed>  $payload
     */
    protected function addEvent(
        Shipment $shipment,
        User $actor,
        string $type,
        ?string $status,
        string $note,
        array $payload,
        ?Carbon $at = null,
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
}
