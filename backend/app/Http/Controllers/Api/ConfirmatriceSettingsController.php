<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConfirmatriceSettingsController extends Controller
{
    /** Valeurs par défaut GO-CENTER (spec Confirmatrice §6.8). */
    private const DEFAULTS = [
        'confirmatrice_threshold_improve' => 8,   // < 8 % = Danger
        'confirmatrice_threshold_good' => 12,     // >= 12 % = Objectif atteint
        'confirmatrice_alert_window_days' => 7,   // fenêtre d'évaluation de l'alerte
    ];

    public function show(): JsonResponse
    {
        return ApiResponse::success($this->current(), 'Réglages performance confirmatrice.');
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'threshold_improve' => ['required', 'numeric', 'min:0', 'max:100'],
            'threshold_good' => ['required', 'numeric', 'min:0', 'max:100', 'gte:threshold_improve'],
            'alert_window_days' => ['required', 'integer', 'min:1', 'max:90'],
        ], [
            'threshold_good.gte' => 'Le seuil « Objectif atteint » doit être supérieur ou égal au seuil « À améliorer ».',
        ]);

        $map = [
            'confirmatrice_threshold_improve' => $data['threshold_improve'],
            'confirmatrice_threshold_good' => $data['threshold_good'],
            'confirmatrice_alert_window_days' => $data['alert_window_days'],
        ];

        foreach ($map as $key => $value) {
            SystemSetting::query()->updateOrCreate(
                ['brand_id' => null, 'setting_key' => $key],
                ['setting_value' => (string) $value, 'setting_group' => 'confirmatrice', 'value_type' => 'number'],
            );
        }

        AuditLogger::log($request, 'confirmatrice.settings.update', null, null, $map);

        return ApiResponse::success($this->current(), 'Réglages enregistrés.');
    }

    /** @return array<string, int|float> */
    public static function values(): array
    {
        $stored = SystemSetting::query()
            ->whereNull('brand_id')
            ->whereIn('setting_key', array_keys(self::DEFAULTS))
            ->pluck('setting_value', 'setting_key');

        return [
            'threshold_improve' => (float) ($stored['confirmatrice_threshold_improve'] ?? self::DEFAULTS['confirmatrice_threshold_improve']),
            'threshold_good' => (float) ($stored['confirmatrice_threshold_good'] ?? self::DEFAULTS['confirmatrice_threshold_good']),
            'alert_window_days' => (int) ($stored['confirmatrice_alert_window_days'] ?? self::DEFAULTS['confirmatrice_alert_window_days']),
        ];
    }

    /** @return array<string, int|float> */
    private function current(): array
    {
        return self::values();
    }
}
