<?php

namespace App\Console\Commands;

use App\Models\SystemSetting;
use App\Support\SystemSettingRegistry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MigrateLegacyWhatsappSettingsCommand extends Command
{
    protected $signature = 'settings:migrate-legacy-whatsapp {--dry-run : Afficher sans modifier}';

    protected $description = 'Migre les clés whatsapp_* (groupe integrations) vers le groupe whatsapp (wa_*). Ne remplace pas une wa_* déjà renseignée.';

    /** @var array<string, string> ancienne_clé => nouvelle_clé */
    private const MAP = [
        'whatsapp_provider' => 'wa_provider',
        'whatsapp_api_url' => 'wa_api_base_url',
        'whatsapp_api_token' => 'wa_api_token',
        'whatsapp_phone_id' => 'wa_phone_id',
        'whatsapp_business_account_id' => 'wa_business_account_id',
    ];

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $defs = SystemSettingRegistry::definitions('whatsapp');

        $migrated = 0;
        $skipped = 0;
        $removed = 0;

        $rows = SystemSetting::query()
            ->where('setting_group', 'integrations')
            ->whereIn('setting_key', array_merge(array_keys(self::MAP), ['whatsapp_webhook_secret']))
            ->get();

        foreach ($rows as $row) {
            $oldKey = $row->setting_key;
            $brandId = (int) $row->brand_id;

            if ($oldKey === 'whatsapp_webhook_secret') {
                $targetKey = 'wa_webhook_verify_token';
                $existing = SystemSetting::query()
                    ->where('brand_id', $brandId)
                    ->where('setting_key', $targetKey)
                    ->first();
                $existingVal = trim((string) ($existing?->setting_value ?? ''));
                if ($existingVal !== '') {
                    $this->line("[skip] brand {$brandId} {$oldKey} → {$targetKey} (cible déjà renseignée)");
                    $skipped++;

                    continue;
                }
                $sourceVal = trim((string) ($row->setting_value ?? ''));
                if ($sourceVal === '') {
                    continue;
                }
                if ($dry) {
                    $this->info("[dry-run] migrerait brand {$brandId} {$oldKey} → {$targetKey}");
                    $migrated++;

                    continue;
                }
                DB::transaction(function () use ($brandId, $targetKey, $sourceVal, $defs, $row) {
                    SystemSetting::query()->updateOrCreate(
                        ['brand_id' => $brandId, 'setting_key' => $targetKey],
                        [
                            'setting_group' => 'whatsapp',
                            'setting_value' => $sourceVal,
                            'is_sensitive' => true,
                            'description' => $defs[$targetKey]['description'] ?? null,
                        ]
                    );
                    $row->delete();
                });
                $this->info("[migrated] brand {$brandId} {$oldKey} → {$targetKey}");
                $migrated++;
                $removed++;

                continue;
            }

            if (! isset(self::MAP[$oldKey])) {
                continue;
            }

            $newKey = self::MAP[$oldKey];
            $meta = $defs[$newKey] ?? ['sensitive' => false, 'description' => null];
            $sensitive = $meta['sensitive'] ?? false;

            $target = SystemSetting::query()
                ->where('brand_id', $brandId)
                ->where('setting_key', $newKey)
                ->first();
            $targetVal = trim((string) ($target?->setting_value ?? ''));

            if ($targetVal !== '' && ! ($sensitive && preg_match('/^\*+$/', $targetVal))) {
                $this->line("[skip] brand {$brandId} {$oldKey} → {$newKey} (wa_* déjà configuré)");
                $skipped++;

                continue;
            }

            $value = (string) ($row->setting_value ?? '');
            if (trim($value) === '') {
                $this->line("[skip] brand {$brandId} {$oldKey} (valeur vide)");
                $skipped++;

                continue;
            }

            if ($dry) {
                $this->info("[dry-run] migrerait brand {$brandId} {$oldKey} → {$newKey}");
                $migrated++;

                continue;
            }

            DB::transaction(function () use ($brandId, $newKey, $value, $sensitive, $meta, $row) {
                SystemSetting::query()->updateOrCreate(
                    ['brand_id' => $brandId, 'setting_key' => $newKey],
                    [
                        'setting_group' => 'whatsapp',
                        'setting_value' => $value,
                        'is_sensitive' => $sensitive,
                        'description' => $meta['description'] ?? null,
                    ]
                );
                $row->delete();
            });

            $this->info("[migrated] brand {$brandId} {$oldKey} → {$newKey}");
            $migrated++;
            $removed++;
        }

        $this->newLine();
        $this->table(['Stat', 'Valeur'], [
            ['Migrés', $migrated],
            ['Ignorés', $skipped],
            ['Lignes legacy supprimées (après copie)', $removed],
            ['Mode', $dry ? 'dry-run' : 'écriture'],
        ]);

        return self::SUCCESS;
    }
}
