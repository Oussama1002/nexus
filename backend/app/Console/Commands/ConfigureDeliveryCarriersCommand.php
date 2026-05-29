<?php

namespace App\Console\Commands;

use App\Models\DeliveryCompany;
use App\Services\Delivery\Providers\AmeexDeliveryProvider;
use App\Services\Delivery\Providers\SenditDeliveryProvider;
use Illuminate\Console\Command;

class ConfigureDeliveryCarriersCommand extends Command
{
    protected $signature = 'delivery:configure-carriers
                            {--sendit-public= : Sendit public API key}
                            {--sendit-secret= : Sendit secret API key}
                            {--ameex-key= : Ameex C-Api-Key}
                            {--test : Run connection tests after configuration}';

    protected $description = 'Create or update Sendit and Ameex delivery companies with API credentials';

    public function handle(): int
    {
        $senditPublic = (string) ($this->option('sendit-public') ?: env('SENDIT_PUBLIC_KEY', ''));
        $senditSecret = (string) ($this->option('sendit-secret') ?: env('SENDIT_SECRET_KEY', ''));
        $ameexKey = (string) ($this->option('ameex-key') ?: env('AMEEX_API_KEY', ''));

        $sendit = $this->upsertCarrier(
            code: 'sendit',
            name: 'Sendit',
            apiUrl: (string) config('delivery.sendit.api_url'),
            apiKeyRef: $senditPublic,
            apiKey: $senditSecret,
            trackingUrl: 'https://app.sendit.ma',
            avgDays: 2,
        );

        $ameex = $this->upsertCarrier(
            code: 'ameex',
            name: 'Ameex',
            apiUrl: (string) config('delivery.ameex.api_url'),
            apiKeyRef: $ameexKey,
            apiKey: null,
            trackingUrl: 'https://www.ameex.ma/en/delivery',
            avgDays: 3,
        );

        $this->info('Delivery companies configured:');
        $this->line(sprintf('  - Sendit (#%d) public key: %s', $sendit->id, $senditPublic !== '' ? 'set' : 'missing'));
        $this->line(sprintf('  - Sendit (#%d) secret key: %s', $sendit->id, $senditSecret !== '' ? 'set' : 'missing'));
        $this->line(sprintf('  - Ameex (#%d) API key: %s', $ameex->id, $ameexKey !== '' ? 'set' : 'missing'));

        if ($this->option('test')) {
            $this->newLine();
            $this->testSendit($sendit, $senditPublic, $senditSecret);
            $this->testAmeex($ameex, $ameexKey);
        }

        return self::SUCCESS;
    }

    protected function upsertCarrier(
        string $code,
        string $name,
        string $apiUrl,
        ?string $apiKeyRef,
        ?string $apiKey,
        string $trackingUrl,
        int $avgDays,
    ): DeliveryCompany {
        /** @var DeliveryCompany $company */
        $company = DeliveryCompany::query()->firstOrNew(['code' => $code]);

        $company->fill([
            'name' => $name,
            'api_url' => $apiUrl,
            'tracking_base_url' => $trackingUrl,
            'avg_delivery_days' => $avgDays,
            'status' => 'active',
        ]);

        if ($apiKeyRef !== null && $apiKeyRef !== '') {
            $company->api_key_ref = $apiKeyRef;
        }
        if ($apiKey !== null && $apiKey !== '') {
            $company->api_key = $apiKey;
        }

        $company->save();

        return $company->fresh();
    }

    protected function testSendit(DeliveryCompany $company, string $public, string $secret): void
    {
        if ($public === '' || $secret === '') {
            $this->warn('Sendit: skipped test — public and secret keys are required.');

            return;
        }

        $result = (new SenditDeliveryProvider($company))->testConnection([
            'public_key' => $public,
            'secret_key' => $secret,
        ]);

        $this->line('Sendit test: '.($result['ok'] ? '<info>OK</info>' : '<error>FAILED</error>').' — '.$result['message']);
    }

    protected function testAmeex(DeliveryCompany $company, string $key): void
    {
        if ($key === '') {
            $this->warn('Ameex: skipped test — API key is required.');

            return;
        }

        $result = (new AmeexDeliveryProvider($company))->testConnection([
            'api_key' => $key,
        ]);

        $this->line('Ameex test: '.($result['ok'] ? '<info>OK</info>' : '<error>FAILED</error>').' — '.$result['message']);
    }
}
