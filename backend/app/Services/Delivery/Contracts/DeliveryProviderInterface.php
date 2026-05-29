<?php

namespace App\Services\Delivery\Contracts;

/**
 * Normalized carrier integration (Amana, Ozon, Manual, …).
 *
 * @phpstan-type NormalizedResult array{
 *   ok: bool,
 *   code: string,
 *   message: string,
 *   data?: array<string, mixed>,
 * }
 */
interface DeliveryProviderInterface
{
    /**
     * Create or register a shipment at the carrier (no-op for manual).
     *
     * @param  array<string, mixed>  $payload
     * @return NormalizedResult
     */
    public function createShipment(array $payload): array;

    /**
     * @return NormalizedResult
     */
    public function trackShipment(string $trackingNumber): array;

    /**
     * @return NormalizedResult
     */
    public function cancelShipment(string $trackingNumber): array;

    /**
     * @return NormalizedResult
     */
    public function printLabel(string $trackingNumber): array;
}
