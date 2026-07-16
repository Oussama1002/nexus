<?php

namespace App\Services\Delivery;

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
            return $this->emptyResult(['Transporteur Ameex introuvable ou inactif.']);
        }

        $apiId = trim((string) ($company->api_key_ref ?? ''));
        $apiKey = trim((string) ($company->api_key ?? ''));

        if ($apiId === '' || $apiKey === '') {
            return $this->emptyResult(['Clés API Ameex manquantes — configurez-les dans Paramètres → Livraison.']);
        }

        $provider = new AmeexDeliveryProvider($company);
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
                    $errors[] = (string) ($list['message'] ?? 'Échec lecture Ameex.');
                }
                break;
            }

            $items = is_array($list['data']['items'] ?? null) ? $list['data']['items'] : [];
            if ($items === []) {
                break;
            }

            $pages++;
            $lastPageItemCount = count($items);
            $total += $lastPageItemCount;
            $nextPage = $page + 1;

            foreach ($items as $item) {
                $code = $this->extractCode($item);
                if ($code === '') {
                    continue;
                }

                $isKnown = isset($existingCodes[$code]);
                if (! $isKnown) {
                    $detail = $provider->getDelivery($code);
                    $delivery = ($detail['ok'] ?? false) && is_array($detail['data']['delivery'] ?? null)
                        ? $detail['data']['delivery']
                        : $item;
                } else {
                    $delivery = $item;
                }

                try {
                    $result = $this->upsertDelivery($brandId, $company->id, $actor, $delivery, $code);
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

    protected function upsertDelivery(int $brandId, int $companyId, User $actor, array $delivery, string $code): array
    {
        $carrierStatus = (string) ($delivery['status'] ?? $delivery['parcel_status'] ?? '');
        $internalStatus = $this->mapper->toInternal($carrierStatus) ?? 'created';

        $city = (string) ($delivery['city'] ?? $delivery['ville'] ?? '');
        $amount = (float) ($delivery['cod'] ?? $delivery['amount'] ?? $delivery['prix'] ?? 0);
        $fee = (float) ($delivery['fee'] ?? $delivery['frais'] ?? 0);
        $createdAt = $this->parseDate($delivery['created_at'] ?? $delivery['date'] ?? null);
        $lastActionAt = $this->parseDate($delivery['last_action_at'] ?? $delivery['updated_at'] ?? null);

        return DB::transaction(function () use (
            $brandId, $companyId, $actor, $delivery, $code,
            $carrierStatus, $internalStatus, $city, $amount, $fee,
            $createdAt, $lastActionAt,
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
                'carrier_response_json' => $delivery,
                'carrier_last_sync_at' => now(),
                'sync_error' => null,
                'recipient_name' => (string) ($delivery['receiver'] ?? $delivery['name'] ?? ''),
                'recipient_phone' => (string) ($delivery['phone'] ?? ''),
                'recipient_city' => $city,
                'city' => $city,
                'recipient_address' => (string) ($delivery['address'] ?? ''),
                'address' => (string) ($delivery['address'] ?? ''),
                'cod_amount' => $amount,
                'delivery_fee' => $fee,
                'payment_status' => $amount > 0 ? 'cod_pending' : 'not_applicable',
                'notes' => (string) ($delivery['comment'] ?? ''),
            ];

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

            $eventCount = 0;

            if ($created) {
                $this->addEvent($shipment, $actor, 'imported', $internalStatus, 'Importé depuis Ameex', $delivery, $createdAt);
                $eventCount++;
            } elseif ($previousStatus !== null && $previousStatus !== $internalStatus) {
                $this->addEvent(
                    $shipment, $actor, 'status_changed', $internalStatus,
                    sprintf('Ameex: %s → %s', $previousStatus, $internalStatus),
                    $delivery, $lastActionAt
                );
                $eventCount++;
            }

            return ['created' => $created, 'events' => $eventCount];
        });
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

    private function extractCode(array $item): string
    {
        foreach (['code', 'parcel_code', 'ref', 'Ref', 'tracking', 'order_num'] as $key) {
            if (! empty($item[$key])) {
                return (string) $item[$key];
            }
        }
        return '';
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
