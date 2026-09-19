<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Support\Facades\Mail;

/**
 * Mailer par marque : utilise le SMTP saisi dans Paramètres → Intégrations, sinon celui du .env.
 */
class BrandMailer
{
    /** @return array{host: string, port: int, user: string, password: string, encryption: string, sender: string}|null */
    public function settings(int $brandId): ?array
    {
        $values = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->whereIn('setting_key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_encryption', 'smtp_sender_name'])
            ->pluck('setting_value', 'setting_key')
            ->map(fn ($v) => trim((string) $v));

        $host = $values['smtp_host'] ?? '';
        $user = $values['smtp_user'] ?? '';
        $password = $values['smtp_password'] ?? '';
        if ($host === '' || $user === '' || SystemSetting::valueIsUnchangedSecretPlaceholder($password)) {
            return null;
        }

        $encryption = strtolower($values['smtp_encryption'] ?? '');
        $port = (int) ($values['smtp_port'] ?? 0) ?: ($encryption === 'ssl' ? 465 : 587);

        return [
            'host' => $host,
            'port' => $port,
            'user' => $user,
            'password' => $password,
            'encryption' => $encryption,
            'sender' => $values['smtp_sender_name'] ?? '',
        ];
    }

    public function for(?int $brandId): Mailer
    {
        $s = $brandId ? $this->settings($brandId) : null;
        if (! $s) {
            return Mail::mailer();
        }

        $name = 'brand_'.$brandId;
        config([
            "mail.mailers.$name" => [
                'transport' => 'smtp',
                'scheme' => ($s['encryption'] === 'ssl' || $s['port'] === 465) ? 'smtps' : 'smtp',
                'host' => $s['host'],
                'port' => $s['port'],
                'username' => $s['user'],
                'password' => $s['password'],
                'timeout' => 15,
            ],
        ]);
        app('mail.manager')->purge($name);

        $mailer = Mail::mailer($name);
        $mailer->alwaysFrom($s['user'], $s['sender'] !== '' ? $s['sender'] : null);

        return $mailer;
    }

    public static function translateError(string $raw): string
    {
        $m = strtolower($raw);
        if (str_contains($m, 'authenticate') || str_contains($m, '535') || str_contains($m, 'username and password')) {
            return 'Adresse e-mail ou mot de passe refusé par le serveur. Pour Gmail, il faut un « mot de passe d’application », pas le mot de passe habituel.';
        }
        if (str_contains($m, 'could not be established') || str_contains($m, 'timed out') || str_contains($m, 'getaddrinfo') || str_contains($m, 'connection refused')) {
            return 'Impossible de joindre le serveur e-mail. Vérifiez le fournisseur choisi (hôte / port).';
        }
        if (str_contains($m, 'certificate') || str_contains($m, 'ssl') || str_contains($m, 'tls')) {
            return 'Problème de chiffrement SSL/TLS. Essayez l’autre chiffrement (port 465 = SSL, 587 = TLS).';
        }

        return 'Échec de l’envoi : '.$raw;
    }
}
