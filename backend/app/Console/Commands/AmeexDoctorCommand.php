<?php

namespace App\Console\Commands;

use App\Services\Delivery\DeliveryCarrierResolver;
use App\Services\Delivery\Providers\AmeexDeliveryProvider;
use Illuminate\Console\Command;

/**
 * Diagnostic Ameex : identifiants, villes acceptées et essai d'envoi.
 * L'API refuse « Veuillez choisir une ville » quand le nom envoyé ne
 * correspond pas à son référentiel.
 */
class AmeexDoctorCommand extends Command
{
    protected $signature = 'ameex:doctor
        {--brand=1 : Marque dont on lit les identifiants Ameex}
        {--city= : Teste la création d’un colis avec cette ville}
        {--cod=150 : Montant à encaisser pour le test}
        {--shipment= : Renvoie une expédition existante au lieu d’un colis de test}';

    protected $description = 'Vérifie la configuration Ameex : identifiants, villes acceptées, envoi de colis.';

    public function handle(): int
    {
        $brandId = (int) $this->option('brand');
        $resolved = app(DeliveryCarrierResolver::class)->resolve('ameex', $brandId);

        if (! $resolved) {
            $this->error('Ameex introuvable pour la marque '.$brandId);

            return self::FAILURE;
        }

        $this->info('=== Identifiants ===');
        $this->line('api_url      : '.$resolved->api_url);
        $this->line('api_id       : '.(strlen((string) $resolved->api_key_ref) > 0 ? 'défini ('.strlen((string) $resolved->api_key_ref).' car.)' : 'MANQUANT'));
        $this->line('api_key      : '.(strlen((string) $resolved->api_key) > 0 ? 'défini ('.strlen((string) $resolved->api_key).' car.)' : 'MANQUANT'));

        $provider = new AmeexDeliveryProvider($resolved);

        if ($shipmentId = $this->option('shipment')) {
            return $this->resendShipment($provider, (int) $shipmentId);
        }

        $this->newLine();
        $this->info('=== Villes vues sur vos colis existants ===');
        $list = $provider->listDeliveries(1, 25);
        if ($list['ok'] ?? false) {
            $cities = collect($list['data']['items'] ?? [])
                ->map(fn ($i) => trim(strip_tags((string) ($i['TBL_CITY'] ?? ''))))
                ->filter()
                ->unique()
                ->values();
            $cities->isEmpty()
                ? $this->warn('Aucune ville trouvée sur les colis existants.')
                : $cities->each(fn ($c) => $this->line('  ['.$c.']'));
        } else {
            $this->error('Lecture des colis impossible : '.($list['message'] ?? '?'));
        }

        $this->newLine();
        $this->info('=== Référentiel des villes Ameex ===');
        $cities = $provider->fetchCities();
        $this->line(count($cities).' villes desservies.');
        if ($cities !== []) {
            $this->line(collect($cities)->take(12)->map(fn ($c) => $c['name'].' (#'.$c['id'].')')->implode(', ').' …');
        }

        $this->newLine();
        $this->info('=== Villes de vos expéditions non envoyées ===');
        $this->auditPendingCities($provider);

        if ($city = $this->option('city')) {
            $this->newLine();
            $this->info('=== Essai de création avec la ville « '.$city.' » ===');
            $result = $provider->createShipment([
                'reference' => 'TEST-'.now()->format('ymdHis'),
                'recipient_name' => 'Test Nexus',
                'recipient_phone' => '0600000000',
                'recipient_city' => $city,
                'recipient_address' => 'Adresse de test',
                'cod_amount' => (float) $this->option('cod'),
                'products' => 'Test',
            ]);
            $this->line(($result['ok'] ?? false) ? 'ACCEPTÉ — suivi '.($result['data']['tracking_number'] ?? '?') : 'REFUSÉ — '.($result['message'] ?? '?'));
        }

        return self::SUCCESS;
    }

    private function resendShipment(AmeexDeliveryProvider $provider, int $shipmentId): int
    {
        $shipment = \App\Models\Shipment::query()->with('order')->find($shipmentId);
        if (! $shipment) {
            $this->error('Expédition '.$shipmentId.' introuvable.');

            return self::FAILURE;
        }

        $result = $provider->createShipment([
            'reference' => $shipment->order?->order_number ?? $shipment->tracking_number,
            'recipient_name' => $shipment->recipient_name,
            'recipient_phone' => $shipment->recipient_phone,
            'recipient_city' => $this->option('city') ?: ($shipment->recipient_city ?: $shipment->city),
            'recipient_address' => $shipment->recipient_address ?: $shipment->address,
            'cod_amount' => (float) ($this->option('cod') ?: $shipment->cod_amount),
            'products' => 'Commande',
        ]);

        $this->line(($result['ok'] ?? false) ? 'ACCEPTÉ — suivi '.($result['data']['tracking_number'] ?? '?') : 'REFUSÉ — '.($result['message'] ?? '?'));
        $this->line('Réponse brute : '.json_encode($result['data']['raw'] ?? [], JSON_UNESCAPED_UNICODE));

        return self::SUCCESS;
    }

    /**
     * Liste les expéditions bloquées et dit si leur ville est reconnue par Ameex.
     */
    private function auditPendingCities(AmeexDeliveryProvider $provider): void
    {
        $pending = \App\Models\Shipment::query()
            ->whereNull('external_tracking_id')
            ->latest()
            ->take(20)
            ->get(['id', 'recipient_city', 'city']);

        if ($pending->isEmpty()) {
            $this->line('Aucune expédition en attente.');

            return;
        }

        $known = collect($provider->fetchCities())
            ->mapWithKeys(fn ($c) => [$this->normalize($c['name']) => $c['id']]);

        foreach ($pending as $shipment) {
            $name = (string) ($shipment->recipient_city ?: $shipment->city);
            $id = $known[$this->normalize($name)] ?? null;
            $this->line(sprintf('  #%-6s %-25s %s', $shipment->id, $name !== '' ? $name : '(vide)', $id ? 'OK → #'.$id : 'INCONNUE CHEZ AMEEX'));
        }
    }

    private function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = strtr($value, [
            'à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'î' => 'i', 'ï' => 'i', 'ô' => 'o', 'ö' => 'o',
            'û' => 'u', 'ü' => 'u', 'ù' => 'u', 'ç' => 'c',
        ]);

        return (string) preg_replace('/[^a-z0-9]/', '', $value);
    }
}
