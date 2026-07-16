<?php

namespace App\Services\Delivery;

use App\Models\Order;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Delivery\Contracts\DeliveryProviderInterface;
use Illuminate\Support\Facades\Log;

class SenditAutoDispatchService
{
    private const CARRIERS = ['ameex', 'sendit'];

    public function __construct(
        protected DeliveryCarrierResolver $carrierResolver,
        protected DeliveryProviderFactory $providerFactory,
    ) {}

    public function dispatch(Order $order, User $actor): ?array
    {
        $order->loadMissing(['customer', 'lines.product', 'brand']);

        $company = null;
        $provider = null;

        foreach (self::CARRIERS as $code) {
            $candidate = $this->carrierResolver->resolve($code, $order->brand_id);
            if ($candidate) {
                $p = $this->providerFactory->forCompany($candidate);
                if ($p instanceof DeliveryProviderInterface) {
                    $company = $candidate;
                    $provider = $p;
                    break;
                }
            }
        }

        if (!$company || !$provider) {
            Log::warning('AutoDispatch: no delivery carrier configured for brand ' . $order->brand_id);
            return null;
        }

        $customer = $order->customer;
        $recipientName = $customer?->full_name ?? '';
        $recipientPhone = $customer?->phone ?? '';
        $recipientCity = $customer?->delivery_city ?: ($customer?->city ?? '');
        $recipientAddress = $order->shipping_address ?: ($customer?->delivery_address ?: ($customer?->address ?? ''));
        $codAmount = $order->payment_method === 'cod' ? (float) $order->total : 0;

        $productNames = $order->lines->map(function ($line) {
            $qty = (int) $line->quantity;
            $name = $line->product_name ?: ($line->product?->name ?? 'Produit');
            return $qty > 1 ? "{$name} x{$qty}" : $name;
        })->implode(', ');

        $secondPhone = $customer?->phone_secondary ?? '';
        $notes = $order->notes ?? '';
        $comment = trim(($notes ? $notes . ' ' : '') . ($secondPhone ? '2ème tél: ' . $secondPhone : ''));

        $payload = [
            'recipient_name' => $recipientName,
            'recipient_phone' => $recipientPhone,
            'recipient_city' => $recipientCity,
            'recipient_address' => $recipientAddress,
            'cod_amount' => $codAmount,
            'reference' => $order->order_number,
            'comment' => $comment,
            'products' => $productNames,
            'allow_try' => false,
            'allow_open' => false,
        ];

        $result = $provider->createShipment($payload);

        if (!($result['ok'] ?? false)) {
            Log::warning('AutoDispatch: failed to create shipment', [
                'order_id' => $order->id,
                'carrier' => $company->code,
                'error' => $result['message'] ?? 'Unknown error',
                'data' => $result['data'] ?? [],
            ]);
            return $result;
        }

        $trackingNumber = $result['data']['tracking_number'] ?? null;
        $externalId = $result['data']['external_tracking_id'] ?? $trackingNumber;

        $shipment = Shipment::query()->create([
            'order_id' => $order->id,
            'brand_id' => $order->brand_id,
            'delivery_company_id' => $company->id,
            'tracking_number' => $trackingNumber,
            'external_tracking_id' => $externalId,
            'status' => 'created',
            'carrier_status' => $result['data']['carrier_status'] ?? 'created',
            'carrier_response_json' => json_encode($result['data']['raw'] ?? []),
            'cod_amount' => $codAmount,
            'payment_status' => $codAmount > 0 ? 'cod_pending' : 'not_applicable',
            'recipient_name' => $recipientName,
            'recipient_phone' => $recipientPhone,
            'city' => $recipientCity,
            'recipient_city' => $recipientCity,
            'address' => $recipientAddress,
            'recipient_address' => $recipientAddress,
            'notes' => $comment ?: null,
            'created_by' => $actor->id,
        ]);

        return [
            'ok' => true,
            'carrier' => $company->code,
            'shipment_id' => $shipment->id,
            'tracking_number' => $trackingNumber,
            'result' => $result,
        ];
    }
}
