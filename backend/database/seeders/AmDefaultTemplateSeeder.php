<?php

namespace Database\Seeders;

use App\Models\AmAlertRuleTemplate;
use App\Models\AmChantierTemplate;
use App\Models\AmGateCriteriaTemplate;
use App\Models\AmGateTemplate;
use App\Models\AmHealthScoreConfig;
use App\Models\AmQaGridTemplate;
use App\Models\AmReportTemplate;
use App\Models\AmRoadmapTemplate;
use Illuminate\Database\Seeder;

/**
 * Seeds the reference AM configuration: 1 roadmap template, 8 chantiers
 * (SOP-01..08), 9 gates (G0..G8), their criteria, default health-score
 * weights, one QA grid per deliverable type, the 9 alert rules already
 * wired in AmRunAlertRulesCommand, and a default client-report template.
 *
 * Idempotent: uses updateOrCreate on natural keys so re-running is safe.
 */
class AmDefaultTemplateSeeder extends Seeder
{
    public function run(): void
    {
        // ─── Roadmap ───
        $roadmap = AmRoadmapTemplate::query()->updateOrCreate(
            ['code' => 'default'],
            [
                'label' => 'Feuille de route standard Brandna',
                'description' => 'Modèle par défaut : 8 chantiers SOP-01..08, 9 portes G0..G8 conformes à la spec §4-§6.',
                'is_active' => true,
                'is_default' => true,
            ],
        );

        // ─── Chantiers (SOP-01 to SOP-08) ───
        $chantiers = [
            ['SOP-01', 'Positionnement & offre',           'Définir la promesse, cible, USP.',                         [], 1],
            ['SOP-02', 'Modèle économique',                'Prix, coûts, marge, seuil CAC, seuil LTV/CAC.',            ['G0'], 2],
            ['SOP-03', 'Écosystème & funnel',              'Landing, checkout, WhatsApp, tracking.',                   ['G1'], 3],
            ['SOP-04', 'Production créative',              'Brand book, assets, contenus initiaux.',                   ['G1'], 4],
            ['SOP-05', 'Acquisition & media buying',       'Structure comptes, campagnes de test.',                    ['G3'], 5],
            ['SOP-06', 'Réseaux sociaux organiques',       'Ligne éditoriale, plan mensuel, exécution.',               ['G3'], 6],
            ['SOP-07', 'Influence & partenariats',         'Sélection, brief, activation, mesure.',                    ['G4'], 7],
            ['SOP-08', 'Scaling & optimisation',           'Amplification post-conversion prouvée.',                   ['G7'], 8],
        ];
        $chantierMap = [];
        foreach ($chantiers as [$code, $label, $objective, $prereq, $order]) {
            $chantierMap[$code] = AmChantierTemplate::query()->updateOrCreate(
                ['roadmap_template_id' => $roadmap->id, 'code' => $code],
                [
                    'label' => $label,
                    'objective' => $objective,
                    'prerequisite_gate_codes' => $prereq,
                    'sort_order' => $order,
                ],
            );
        }

        // ─── Gates (G0..G8) ───
        // Format: [code, label, description, validator_role, chantier_code|null, unlocks_modules, is_scaling, is_conversion, sort]
        $gates = [
            ['G0', 'Positionnement validé',      'Promesse, cible et USP confirmés par la Direction.',              'admin',                  'SOP-01', [],                   false, false, 1],
            ['G1', 'Modèle économique validé',   'Prix, marge cible et seuil LTV/CAC approuvés par la Direction.',  'admin',                  'SOP-02', [],                   false, false, 2],
            ['G2', 'Écosystème conforme',        'Landing, funnel, tracking et WhatsApp validés Direction.',         'admin',                  'SOP-03', [],                   false, false, 3],
            ['G3', 'Prêt à activer',             'Créatifs, comptes et budgets prêts — Media Buying débloqué.',      'manager_operationnel',   'SOP-04', ['media_buying', 'smm'], false, false, 4],
            ['G4', 'Contenu stable',             'Plan éditorial en cadence — Influence débloquée.',                  'manager_operationnel',   'SOP-06', ['influence'],         false, false, 5],
            ['G5', 'Scaling autorisé',           'Marché prouvé, marge tenue — amplification budgets ouverte.',      'manager_operationnel',   'SOP-08', [],                   true,  false, 6],
            ['G6', 'Rétention structurée',       'Fidélisation, LTV et cross-sell activés.',                          'manager_operationnel',   null,     [],                   false, false, 7],
            ['G7', 'Conversion prouvée',         'Ratio LTV/CAC ≥ seuil, marge nette positive.',                     'manager_operationnel',   'SOP-05', [],                   false, true,  8],
            ['G8', 'Marque de référence',        'Certification Direction : marque autonome et scalable.',            'admin',                  null,     [],                   false, false, 9],
        ];
        $gateMap = [];
        foreach ($gates as [$code, $label, $desc, $role, $chantierCode, $unlocks, $scaling, $conv, $order]) {
            $gateMap[$code] = AmGateTemplate::query()->updateOrCreate(
                ['roadmap_template_id' => $roadmap->id, 'code' => $code],
                [
                    'chantier_template_id' => $chantierCode ? $chantierMap[$chantierCode]->id : null,
                    'label' => $label,
                    'description' => $desc,
                    'validator_role' => $role,
                    'unlocks_gate_codes_json' => [],
                    'unlocks_modules_json' => $unlocks,
                    'is_scaling_gate' => $scaling,
                    'is_conversion_gate' => $conv,
                    'sort_order' => $order,
                ],
            );
        }

        // ─── Gate criteria ───
        // Format: [gate_code, label, verification_mode, source, operator, threshold, mandatory, order]
        $criteria = [
            // G0
            ['G0', 'Fiche positionnement rédigée',           'attestation',            null,                                 null, null,  true, 1],
            ['G0', 'USP validée par la Direction',           'attestation',            null,                                 null, null,  true, 2],
            // G1
            ['G1', 'Modèle économique renseigné',            'validated_deliverable',  'am_brand_economics',                 null, null,  true, 1],
            ['G1', 'Marge brute cible ≥ 70 %',               'calculated_indicator',   'brand_economics.gross_margin',       '>=', 0.70,  true, 2],
            // G2
            ['G2', 'Landing en ligne',                       'validated_deliverable',  'landing_page',                       null, null,  true, 1],
            ['G2', 'Tracking actif (pixel + events)',        'attestation',            null,                                 null, null,  true, 2],
            ['G2', 'WhatsApp Business connecté',             'attestation',            null,                                 null, null,  true, 3],
            // G3
            ['G3', 'Brand book validé',                      'validated_deliverable',  'brand_book',                         null, null,  true, 1],
            ['G3', 'Créatifs initiaux prêts',                'validated_deliverable',  'creative_video',                     null, null,  true, 2],
            ['G3', 'Comptes publicitaires connectés',        'attestation',            null,                                 null, null,  true, 3],
            // G4
            ['G4', 'Plan éditorial mensuel validé',          'validated_deliverable',  'monthly_plan',                       null, null,  true, 1],
            ['G4', 'Cadence de publication tenue > 4 sem',   'attestation',            null,                                 null, null,  true, 2],
            // G5
            ['G5', 'G7 franchie',                            'attestation',            'gate.G7.franchie',                   null, null,  true, 1],
            ['G5', 'Ratio LTV/CAC ≥ seuil',                  'calculated_indicator',   'brand_economics.ltv_cac_ratio',      '>=', 3.0,   true, 2],
            // G6
            ['G6', 'Programme fidélité opérationnel',        'attestation',            null,                                 null, null,  true, 1],
            // G7
            ['G7', 'Ratio LTV/CAC ≥ seuil',                  'calculated_indicator',   'brand_economics.ltv_cac_ratio',      '>=', 3.0,   true, 1],
            ['G7', 'Marge nette / commande > 0',             'calculated_indicator',   'brand_economics.net_margin_per_order', '>', 0,    true, 2],
            // G8
            ['G8', 'Autonomie opérationnelle attestée',      'attestation',            null,                                 null, null,  true, 1],
            ['G8', 'Rentabilité soutenue > 3 mois',          'attestation',            null,                                 null, null,  true, 2],
        ];
        foreach ($criteria as [$gateCode, $label, $mode, $source, $op, $thr, $mandatory, $order]) {
            AmGateCriteriaTemplate::query()->updateOrCreate(
                ['gate_template_id' => $gateMap[$gateCode]->id, 'label' => $label],
                [
                    'verification_mode' => $mode,
                    'source' => $source,
                    'operator' => $op,
                    'threshold' => $thr,
                    'is_mandatory' => $mandatory,
                    'sort_order' => $order,
                ],
            );
        }

        // ─── Health-score weights (default) ───
        AmHealthScoreConfig::query()->updateOrCreate(
            ['brand_id' => null, 'code' => 'default'],
            [
                'weights_json' => [
                    'economics'  => 0.40,
                    'conversion' => 0.25,
                    'execution'  => 0.20,
                    'risk'       => 0.15,
                ],
                'components_json' => [
                    'economics'  => ['sources' => ['gross_margin', 'ltv_cac_ratio']],
                    'conversion' => ['sources' => ['gate.G7.franchie', 'brand_economics.net_margin_per_order']],
                    'execution'  => ['sources' => ['deliverables.on_time_rate', 'chantiers.progress']],
                    'risk'       => ['sources' => ['alerts.open_high', 'compliance.non_conforme']],
                ],
                'is_active' => true,
            ],
        );

        // ─── QA grids ───
        $qaGrids = [
            'brand_book'      => 'Grille QA Brand Book',
            'landing_page'    => 'Grille QA Landing Page',
            'creative_video'  => 'Grille QA Créatif vidéo',
            'monthly_plan'    => 'Grille QA Plan mensuel',
        ];
        $defaultCriteria = [
            ['label' => 'Alignement à la charte',     'is_mandatory' => true,  'weight' => 30],
            ['label' => 'Qualité rédactionnelle',      'is_mandatory' => true,  'weight' => 25],
            ['label' => 'Respect du brief',            'is_mandatory' => true,  'weight' => 25],
            ['label' => 'Optimisation SEO / hooks',    'is_mandatory' => false, 'weight' => 10],
            ['label' => 'Conformité légale',           'is_mandatory' => true,  'weight' => 10],
        ];
        foreach ($qaGrids as $type => $label) {
            AmQaGridTemplate::query()->updateOrCreate(
                ['deliverable_type' => $type],
                ['label' => $label, 'criteria_json' => $defaultCriteria, 'is_active' => true],
            );
        }

        // ─── Alert rule templates (the 9 rules wired in AmRunAlertRulesCommand) ───
        $rules = [
            ['AM-01', 'Marque sans feuille de route active',           'low',      'manager_operationnel', null],
            ['AM-05', 'Marge brute sous la cible',                     'high',     'manager_operationnel', 240],
            ['AM-16', 'Ratio LTV/CAC sous seuil',                      'high',     'manager_operationnel', 240],
            ['AM-17', 'Livrable en retard',                            'medium',   'manager_operationnel', 480],
            ['AM-18', 'Feuille de route sans avancement > 15 jours',   'medium',   'manager_operationnel', 720],
            ['AM-19', 'Dérogation arrive à expiration',                'high',     'admin',                240],
            ['AM-20', 'Conformité produit non conforme',               'critical', 'admin',                120],
            ['AM-21', 'Révision de conformité en retard',              'medium',   'manager_operationnel', 720],
            ['AM-22', 'Compte rendu de réunion client à rédiger',      'medium',   'account_manager',      720],
        ];
        foreach ($rules as [$code, $label, $sev, $recipient, $sla]) {
            AmAlertRuleTemplate::query()->updateOrCreate(
                ['code' => $code],
                [
                    'label' => $label,
                    'severity' => $sev,
                    'trigger_type' => 'schedule',
                    'default_recipient_role' => $recipient,
                    'target_resolution_minutes' => $sla,
                    'is_active' => true,
                ],
            );
        }

        // ─── Client report template (whitelist enforced per spec §22) ───
        AmReportTemplate::query()->updateOrCreate(
            ['code' => 'monthly-client'],
            [
                'label' => 'Rapport client mensuel',
                'sections_json' => [
                    ['key' => 'summary',     'label' => 'Synthèse du mois'],
                    ['key' => 'kpis',        'label' => 'KPIs clés'],
                    ['key' => 'social',      'label' => 'Réseaux sociaux'],
                    ['key' => 'media',       'label' => 'Media buying'],
                    ['key' => 'next_month',  'label' => 'Plan du mois prochain'],
                ],
                'publishable_fields_whitelist' => [
                    'brand.name', 'period',
                    'social.reach', 'social.engagement_rate', 'social.posts_count',
                    'media.spend', 'media.impressions', 'media.clicks', 'media.conversions',
                    'health_score.composite',
                    'account_manager_comment',
                ],
                'is_active' => true,
            ],
        );
    }
}
