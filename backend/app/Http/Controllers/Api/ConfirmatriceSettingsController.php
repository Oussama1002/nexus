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

    /** Niveaux/badges par défaut (progression par nombre de commandes confirmées). */
    private const DEFAULT_LEVELS = [
        ['name' => 'Débutante', 'badge' => '🌱', 'color' => '#64748b', 'min_confirmed' => 0],
        ['name' => 'Bronze', 'badge' => '🥉', 'color' => '#b45309', 'min_confirmed' => 50],
        ['name' => 'Argent', 'badge' => '🥈', 'color' => '#6b7280', 'min_confirmed' => 150],
        ['name' => 'Or', 'badge' => '🥇', 'color' => '#ca8a04', 'min_confirmed' => 400],
        ['name' => 'Platine', 'badge' => '💎', 'color' => '#0e7490', 'min_confirmed' => 1000],
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

    /** Met à jour la liste des niveaux/badges (spec §6.8). */
    public function updateLevels(Request $request): JsonResponse
    {
        $data = $request->validate([
            'levels' => ['required', 'array', 'min:1'],
            'levels.*.name' => ['required', 'string', 'max:40'],
            'levels.*.badge' => ['nullable', 'string', 'max:8'],
            'levels.*.color' => ['nullable', 'string', 'max:9'],
            'levels.*.min_confirmed' => ['required', 'integer', 'min:0'],
        ]);

        $levels = collect($data['levels'])
            ->map(fn ($l) => [
                'name' => trim($l['name']),
                'badge' => $l['badge'] ?? '',
                'color' => $l['color'] ?? '#64748b',
                'min_confirmed' => (int) $l['min_confirmed'],
            ])
            ->sortBy('min_confirmed')
            ->values()
            ->all();

        SystemSetting::query()->updateOrCreate(
            ['brand_id' => null, 'setting_key' => 'confirmatrice_levels'],
            ['setting_value' => json_encode($levels), 'setting_group' => 'confirmatrice', 'value_type' => 'json'],
        );

        AuditLogger::log($request, 'confirmatrice.levels.update', null, null, ['count' => count($levels)]);

        return ApiResponse::success($this->current(), 'Niveaux enregistrés.');
    }

    /**
     * Niveau atteint selon le nombre de commandes confirmées (spec §6.8).
     *
     * @param  array<int, array<string, mixed>>  $levels
     * @return array<string, mixed>|null
     */
    public static function resolveLevel(int $confirmed, array $levels): ?array
    {
        $current = null;
        foreach ($levels as $level) {
            if ($confirmed >= (int) ($level['min_confirmed'] ?? 0)) {
                $current = $level;
            }
        }

        return $current;
    }

    /** @return array<string, mixed> */
    public static function values(): array
    {
        $keys = array_merge(array_keys(self::DEFAULTS), ['confirmatrice_levels']);
        $stored = SystemSetting::query()
            ->whereNull('brand_id')
            ->whereIn('setting_key', $keys)
            ->pluck('setting_value', 'setting_key');

        $levels = self::DEFAULT_LEVELS;
        if (! empty($stored['confirmatrice_levels'])) {
            $decoded = json_decode((string) $stored['confirmatrice_levels'], true);
            if (is_array($decoded) && $decoded !== []) {
                $levels = $decoded;
            }
        }

        return [
            'threshold_improve' => (float) ($stored['confirmatrice_threshold_improve'] ?? self::DEFAULTS['confirmatrice_threshold_improve']),
            'threshold_good' => (float) ($stored['confirmatrice_threshold_good'] ?? self::DEFAULTS['confirmatrice_threshold_good']),
            'alert_window_days' => (int) ($stored['confirmatrice_alert_window_days'] ?? self::DEFAULTS['confirmatrice_alert_window_days']),
            'levels' => $levels,
        ];
    }

    /** @return array<string, int|float> */
    private function current(): array
    {
        return self::values();
    }
}
