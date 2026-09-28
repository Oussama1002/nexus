<?php

namespace App\Console\Commands;

use App\Services\Delivery\DeliveryCarrierResolver;
use App\Services\Delivery\Providers\AmeexDeliveryProvider;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

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
        $this->info('=== Recherche du référentiel des villes ===');
        $this->probeCityEndpoints($resolved->api_url, [
            'C-Api-Id' => (string) $resolved->api_key_ref,
            'C-Api-Key' => (string) $resolved->api_key,
        ]);

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

        return self::SUCCESS;
    }

    /** @param  array<string, string>  $headers */
    private function probeCityEndpoints(string $apiUrl, array $headers): void
    {
        $paths = [
            'customer/Delivery/Cities/Json',
            'customer/Delivery/Cities',
            'customer/Delivery/Parcels/Cities',
            'customer/Cities/Json',
            'customer/Delivery/Villes/Json',
            'customer/Delivery/Parcels/Action/Type/Cities',
        ];

        foreach ($paths as $path) {
            $url = rtrim($apiUrl, '/').'/'.$path;
            try {
                $response = Http::timeout(20)->acceptJson()->withHeaders($headers)->get($url);
                $body = trim($response->body());
                $this->line(sprintf('%-45s %s  %s', $path, $response->status(), mb_substr($body, 0, 160)));
            } catch (\Throwable $e) {
                $this->line(sprintf('%-45s EX  %s', $path, $e->getMessage()));
            }
        }
    }
}
