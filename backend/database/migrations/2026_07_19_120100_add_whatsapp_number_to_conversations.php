<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('whatsapp_number_id')->nullable()->after('brand_id')
                ->constrained('whatsapp_numbers')->nullOnDelete();
        });

        // Backfill: create one whatsapp_numbers row per brand that already has a
        // single-number config in system_settings, so existing setups keep working.
        $rows = DB::table('system_settings')
            ->whereIn('setting_key', ['wa_phone_id', 'wa_business_account_id', 'wa_api_token', 'wa_business_number', 'wa_api_base_url'])
            ->get(['brand_id', 'setting_key', 'setting_value']);

        $byBrand = [];
        foreach ($rows as $r) {
            $byBrand[$r->brand_id][$r->setting_key] = $r->setting_value;
        }

        foreach ($byBrand as $brandId => $vals) {
            $phoneId = trim((string) ($vals['wa_phone_id'] ?? ''));
            if ($phoneId === '') {
                continue;
            }
            $exists = DB::table('whatsapp_numbers')->where('phone_id', $phoneId)->exists();
            if ($exists) {
                continue;
            }
            $token = (string) ($vals['wa_api_token'] ?? '');
            if (preg_match('/^\*+$/', $token)) {
                $token = '';
            }
            $numberId = DB::table('whatsapp_numbers')->insertGetId([
                'brand_id' => $brandId,
                'phone_id' => $phoneId,
                'waba_id' => trim((string) ($vals['wa_business_account_id'] ?? '')) ?: null,
                'display_number' => trim((string) ($vals['wa_business_number'] ?? '')) ?: null,
                'verified_name' => null,
                'label' => trim((string) ($vals['wa_business_number'] ?? '')) ?: 'Numéro principal',
                'api_token' => $token !== '' ? $token : null,
                'api_base_url' => trim((string) ($vals['wa_api_base_url'] ?? '')) ?: null,
                'is_active' => true,
                'is_default' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Tag existing WhatsApp conversations of this brand with the backfilled number.
            DB::table('conversations')
                ->where('brand_id', $brandId)
                ->where('channel', 'whatsapp')
                ->whereNull('whatsapp_number_id')
                ->update(['whatsapp_number_id' => $numberId]);
        }
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropForeign(['whatsapp_number_id']);
            $table->dropColumn('whatsapp_number_id');
        });
    }
};
