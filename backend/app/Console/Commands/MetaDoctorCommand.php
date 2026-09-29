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
    protected $signature = 'meta:doctor
        {--brand= : Marque à diagnostiquer (la première par défaut)}
        {--instagram= : ID d’un compte Instagram à sonder avec chaque jeton de Page}';

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
                $pageId = (string) ($page['id'] ?? '?');
                $token = (string) ($page['access_token'] ?? '');

                // Le vrai test : lire une publication avec le jeton de Page.
                $posts = 'non testé';
                if ($token !== '') {
                    try {
                        $rows = $graph->paginate($brandId, $pageId.'/posts', ['fields' => 'id', 'limit' => 1], 1, $token);
                        $posts = count($rows).' publication(s) lisible(s)';
                    } catch (MetaApiException $e) {
                        $posts = 'REFUS — '.$e->getMessage();
                    }
                }

                $this->line(sprintf(
                    '  %-28s id=%-18s jeton=%s  instagram=%-14s posts=%s',
                    mb_substr((string) ($page['name'] ?? '?'), 0, 28),
                    $pageId,
                    $token === '' ? 'ABSENT' : 'OK',
                    $ig,
                    $posts
                ));
            }
        } catch (MetaApiException $e) {
            $this->error('Lecture des Pages impossible : '.$e->getMessage());
            $pages = [];
        }

        $this->newLine();
        $this->info('=== Instagram : réponse brute de Meta ===');
        $instagramId = (string) ($this->option('instagram') ?? '');

        foreach ($pages as $page) {
            $pageId = (string) ($page['id'] ?? '');
            $token = (string) ($page['access_token'] ?? '');
            if ($token === '') {
                continue;
            }

            // Champ absent (sans erreur) = permission instagram_basic manquante.
            try {
                $node = $graph->get($brandId, $pageId, ['fields' => 'instagram_business_account{id,username}'], $token);
                $this->line(sprintf(
                    '  %-22s %s',
                    mb_substr((string) ($page['name'] ?? '?'), 0, 22),
                    array_key_exists('instagram_business_account', $node)
                        ? json_encode($node['instagram_business_account'], JSON_UNESCAPED_UNICODE)
                        : 'champ absent de la réponse'
                ));
            } catch (MetaApiException $e) {
                $this->line(sprintf('  %-22s ERREUR %s', mb_substr((string) ($page['name'] ?? '?'), 0, 22), $e->getMessage()));
            }

            if ($instagramId !== '') {
                try {
                    $ig = $graph->get($brandId, $instagramId, ['fields' => 'username,name'], $token);
                    $this->line('    → compte '.$instagramId.' lu : '.json_encode($ig, JSON_UNESCAPED_UNICODE));
                } catch (MetaApiException $e) {
                    $this->line('    → compte '.$instagramId.' refusé : '.$e->getMessage());
                }
            }
        }

        $this->newLine();
        $this->info('=== Connexion Instagram directe ===');
        $this->instagramDirect($brandId);

        return self::SUCCESS;
    }

    /** Jeton Instagram propre (graph.instagram.com), independant de Facebook. */
    private function instagramDirect(int $brandId): void
    {
        $service = app(\App\Services\Meta\InstagramGraphService::class);

        if ($service->tokenFor($brandId) === null) {
            $this->warn('Aucun jeton Instagram : cliquez « Connecter Instagram » dans Parametres -> Meta.');

            return;
        }

        try {
            $data = $service->overview($brandId, 3);
            $profile = $data['profile'];
            $this->line('Compte     : @'.($profile['handle'] ?: '?').' ('.($profile['name'] ?: '?').')');
            $this->line('Abonnes    : '.$profile['followers']);
            $this->line('Publications : '.count($data['posts']).' lue(s) sur '.$profile['media_count'].' au total');
            if (! empty($data['warning'])) {
                $this->warn($data['warning']);
            }
        } catch (MetaApiException $e) {
            $this->error('Jeton Instagram refuse : '.$e->getMessage());
        }
    }
}
