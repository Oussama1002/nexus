<?php

namespace App\Services\Delivery;

/**
 * Maps arbitrary carrier status strings to internal shipment statuses.
 */
class ShipmentStatusMapper
{
    /** @var array<string, string> lowercased carrier token → internal */
    protected array $map = [
        'pending' => 'created',
        'created' => 'created',
        'pickup' => 'picked_up',
        'pickedup' => 'picked_up',
        'picked_up' => 'picked_up',
        'en_transit' => 'in_transit',
        'intransit' => 'in_transit',
        'in_transit' => 'in_transit',
        'transit' => 'in_transit',
        'expedie' => 'in_transit',
        'expédié' => 'in_transit',
        'en_cours' => 'in_transit',
        'en cours' => 'in_transit',
        'outfordelivery' => 'out_for_delivery',
        'out_for_delivery' => 'out_for_delivery',
        'en_livraison' => 'out_for_delivery',
        'delivery' => 'out_for_delivery',
        'livre' => 'delivered',
        'livré' => 'delivered',
        'livrée' => 'delivered',
        'delivered' => 'delivered',
        'return' => 'returned',
        'returned' => 'returned',
        'retour' => 'returned',
        'refuse' => 'returned',
        'refusé' => 'returned',
        'failed' => 'failed',
        'echec' => 'failed',
        'échec' => 'failed',
        'reporte' => 'failed',
        'reporté' => 'failed',
        'cancelled' => 'cancelled',
        'canceled' => 'cancelled',
        'annule' => 'cancelled',
        'ramasse' => 'picked_up',
        'ramassé' => 'picked_up',
        'facturé' => 'delivered',
        'facture' => 'delivered',
        'mise_en_distribution' => 'out_for_delivery',
        'en_distribution' => 'out_for_delivery',
        'en_cours_de_livraison' => 'out_for_delivery',
        'non_payé' => 'delivered',
        'payé' => 'delivered',
    ];

    /**
     * @param  array<string, mixed>|string|null  $carrierRaw  Raw status string or payload containing status key
     */
    public function toInternal(mixed $carrierRaw): ?string
    {
        if ($carrierRaw === null) {
            return null;
        }
        if (is_string($carrierRaw)) {
            $token = $this->normalizeToken($carrierRaw);

            return $this->map[$token] ?? null;
        }
        if (is_array($carrierRaw)) {
            foreach (['status', 'carrier_status', 'state', 'Statut', 'libelle'] as $k) {
                if (! empty($carrierRaw[$k]) && is_string($carrierRaw[$k])) {
                    $token = $this->normalizeToken($carrierRaw[$k]);
                    if (isset($this->map[$token])) {
                        return $this->map[$token];
                    }
                }
            }
        }

        return null;
    }

    protected function normalizeToken(string $s): string
    {
        $s = mb_strtolower(trim($s));

        return str_replace([' ', '-', '.'], '_', $s);
    }

    /**
     * Register additional mappings at runtime (e.g. from config DB).
     *
     * @param  array<string, string>  $carrierToInternal
     */
    public function merge(array $carrierToInternal): void
    {
        foreach ($carrierToInternal as $from => $to) {
            $this->map[$this->normalizeToken((string) $from)] = $to;
        }
    }
}
