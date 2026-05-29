<?php

namespace Database\Seeders;

use App\Models\SystemSetting;
use Illuminate\Database\Seeder;

class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            [
                'brand_id' => null,
                'setting_key' => 'app.display_name',
                'setting_group' => 'general',
                'setting_value' => 'Nexus CRM',
                'value_type' => 'string',
                'is_sensitive' => false,
            ],
            [
                'brand_id' => null,
                'setting_key' => 'app.locale',
                'setting_group' => 'general',
                'setting_value' => 'fr',
                'value_type' => 'string',
                'is_sensitive' => false,
            ],
            [
                'brand_id' => null,
                'setting_key' => 'app.timezone',
                'setting_group' => 'general',
                'setting_value' => 'Africa/Casablanca',
                'value_type' => 'string',
                'is_sensitive' => false,
            ],
            [
                'brand_id' => null,
                'setting_key' => 'features.maintenance_mode',
                'setting_group' => 'general',
                'setting_value' => '0',
                'value_type' => 'bool',
                'is_sensitive' => false,
            ],
            [
                'brand_id' => null,
                'setting_key' => 'whatsapp.default_reply_hint',
                'setting_group' => 'whatsapp',
                'setting_value' => '',
                'value_type' => 'string',
                'is_sensitive' => false,
            ],
            [
                'brand_id' => null,
                'setting_key' => 'integrations.http_timeout_seconds',
                'setting_group' => 'integrations',
                'setting_value' => '30',
                'value_type' => 'int',
                'is_sensitive' => false,
            ],
            [
                'brand_id' => null,
                'setting_key' => 'meta.ads_report_currency',
                'setting_group' => 'meta',
                'setting_value' => 'MAD',
                'value_type' => 'string',
                'is_sensitive' => false,
            ],
            [
                'brand_id' => null,
                'setting_key' => 'finance.default_tax_display',
                'setting_group' => 'finance',
                'setting_value' => 'TTC',
                'value_type' => 'string',
                'is_sensitive' => false,
            ],
            [
                'brand_id' => null,
                'setting_key' => 'delivery.tracking_url_template',
                'setting_group' => 'delivery',
                'setting_value' => '',
                'value_type' => 'string',
                'is_sensitive' => false,
            ],
        ];

        foreach ($rows as $row) {
            SystemSetting::query()->updateOrCreate(
                ['brand_id' => $row['brand_id'], 'setting_key' => $row['setting_key']],
                $row
            );
        }
    }
}
