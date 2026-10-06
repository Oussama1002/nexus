<?php

namespace App\Console\Commands;

use App\Models\Shipment;
use App\Services\Delivery\DeliveryCarrierResolver;
use App\Services\Delivery\Providers\SenditDeliveryProvider;
use Illuminate\Console\Command;

/**
 * Vérifie la configuration Sendit de bout en bout. L'authentification peut
 * réussir alors que le compte refuse toute création tant que son dossier de
 * vérification est incomplet : seul un envoi réel le révèle.
 */
class SenditDoctorCommand extends Command
{
    protected $signature = 'sendit:doctor
        {--brand=1 : Marque dont on lit les identifiants Sendit}
        {--city=Casablanca : Ville du colis de test}
        {--cod=150 : Montant à encaisser pour le test}
        {--send : Crée réellement un colis de test chez Sendit}';

    protected $description = 'Vérifie la configuration Sendit : identifiants, villes, et blocage éventuel du compte.';

    public function handle(DeliveryCarrierResolver $resolver): int
    {
        $brandId = (int) $this->option('brand');
        $resolved = $resolver->resolve('sendit', $brandId);

        if (! $resolved) {
            $this->error('Transporteur Sendit introuvable.');

            return self::FAILURE;
        }

        $this->line('=== Identifiants ===');
        $this->line('api_url      : '.($resolved->api_url ?: 'MANQUANT'));
        $this->line('public_key   : '.$this->describe($resolved->api_key_ref));
        $this->line('secret_key   : '.$this->describe($resolved->api_key));
        $this->newLine();

        $provider = new SenditDeliveryProvider($resolved);
        $credentials = [
            'public_key' => (string) $resolved->api_key_ref,
            'secret_key' => (string) $resolved->api_key,
        ];

        $this->line('=== Authentification ===');
        $test = $provider->testConnection($credentials);
        $this->line(($test['ok'] ?? false) ? 'OK — '.$test['message'] : 'ÉCHEC — '.$test['message']);
        $this->newLine();

        if (! ($test['ok'] ?? false)) {
            return self::FAILURE;
        }

        $this->line('=== Expéditions en attente d’envoi ===');
        $pending = Shipment::query()
            ->whereHas('deliveryCompany', fn ($q) => $q->where('code', 'sendit'))
            ->whereNull('external_tracking_id')
            ->latest('id')
            ->limit(15)
            ->get(['id', 'recipient_city', 'sync_error']);

        if ($pending->isEmpty()) {
            $this->line('  aucune.');
        }
        foreach ($pending as $shipment) {
            $this->line(sprintf(
                '  #%-7d %-22s %s',
                $shipment->id,
                $shipment->recipient_city ?: '(ville vide)',
                $shipment->sync_error ? mb_substr($shipment->sync_error, 0, 70) : '—'
            ));
        }
        $this->newLine();

        $this->line('=== Création de colis ===');
        if (! $this->option('send')) {
            $this->line('Non testée. Relancez avec --send pour créer un colis de test chez Sendit.');

            return self::SUCCESS;
        }

        $result = $provider->createShipment([
            'reference' => 'TEST-'.now()->format('YmdHis'),
            'recipient_name' => 'Test Nexus',
            'recipient_phone' => '0600000000',
            'recipient_city' => (string) $this->option('city'),
            'recipient_address' => 'Adresse de test',
            'cod_amount' => (float) $this->option('cod'),
            'comment' => 'Colis de test — à annuler',
        ]);

        if ($result['ok'] ?? false) {
            $this->info('Colis de test créé : '.($result['message'] ?? ''));
            $this->warn('Pensez à l’annuler dans votre espace Sendit.');

            return self::SUCCESS;
        }

        $this->error('Refus Sendit : '.($result['message'] ?? 'motif inconnu'));
        if (str_contains(mb_strtolower((string) ($result['message'] ?? '')), 'vérification')) {
            $this->newLine();
            $this->warn('Le compte est authentifié mais son dossier de vérification est incomplet.');
            $this->warn('Complétez-le sur app.sendit.ma → Mon compte → Vérification. Rien à corriger dans le CRM.');
        }

        return self::FAILURE;
    }

    private function describe(?string $value): string
    {
        $value = trim((string) $value);

        return $value === '' ? 'MANQUANT' : 'défini ('.strlen($value).' car.)';
    }
}
