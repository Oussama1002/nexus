<?php

namespace App\Console\Commands;

use App\Models\Brand;
use App\Services\Meta\MetaApiException;
use App\Services\Meta\MetaGraphClient;
use Illuminate\Console\Command;

/**
 * Diagnostic Meta : autorisations réellement accordées au jeton et accès
 * aux Pages. « Permissions insuffisantes » vient presque toujours d'une
 * permission déclinée au moment de la connexion Facebook.
 */
class MetaDoctorCommand extends Command
{
    protected $signature = 'meta:doctor {--brand= : Marque à diagnostiquer (la première par défaut)}';

    protected $description = 'Vérifie le jeton Meta : autorisations accordées, Pages accessibles, jetons de Page.';

    public function handle(MetaGraphClient $graph): int
    {
        $brandId = (int) ($this->option('brand') ?: Brand::query()->orderBy('id')->value('id'));
        $this->info('Marque : '.$brandId);

        try {
            $me = $graph->get($brandId, 'me', ['fields' => 'id,name']);
            $this->line('Compte connecté : '.($me['name'] ?? '?').' (id '.($me['id'] ?? '?').')');
        } catch (MetaApiException $e) {
            $this->error('Jeton inutilisable : '.$e->getMessage());

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('=== Autorisations du jeton ===');
        try {
            $rows = $graph->paginate($brandId, 'me/permissions', [], 2);
            $granted = [];
            $declined = [];
            foreach ($rows as $row) {
                $name = (string) ($row['permission'] ?? '');
                if ((string) ($row['status'] ?? '') === 'granted') {
                    $granted[] = $name;
                } else {
                    $declined[] = $name;
                }
            }

            $this->line('Accordées : '.($granted !== [] ? implode(', ', $granted) : 'aucune'));
            if ($declined !== []) {
                $this->warn('Refusées  : '.implode(', ', $declined));
            }

            foreach (['pages_show_list', 'pages_read_engagement', 'ads_read', 'business_management'] as $needed) {
                $this->line(sprintf('  %-24s %s', $needed, in_array($needed, $granted, true) ? 'OK' : 'MANQUANTE'));
            }
        } catch (MetaApiException $e) {
            $this->error('Lecture des autorisations impossible : '.$e->getMessage());
        }

        $this->newLine();
        $this->info('=== Pages accessibles et jetons de Page ===');
        try {
            $pages = $graph->paginate($brandId, 'me/accounts', [
                'fields' => 'id,name,access_token,instagram_business_account{id,username}',
                'limit' => 100,
            ], 3);

            if ($pages === []) {
                $this->warn('Aucune Page renvoyée par me/accounts : la Page n’a pas été cochée pendant la connexion Facebook.');
            }

            foreach ($pages as $page) {
                $ig = $page['instagram_business_account']['username'] ?? ($page['instagram_business_account']['id'] ?? '—');
                $this->line(sprintf(
                    '  %-28s id=%-18s jeton=%s  instagram=%s',
                    mb_substr((string) ($page['name'] ?? '?'), 0, 28),
                    (string) ($page['id'] ?? '?'),
                    empty($page['access_token']) ? 'ABSENT' : 'OK',
                    $ig
                ));
            }
        } catch (MetaApiException $e) {
            $this->error('Lecture des Pages impossible : '.$e->getMessage());
        }

        return self::SUCCESS;
    }
}
