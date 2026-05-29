<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreSystemSettingRequest;
use App\Http\Requests\Api\SyncSystemSettingsGroupRequest;
use App\Http\Requests\Api\UpdateSystemSettingRequest;
use App\Models\SystemSetting;
use App\Services\AuditService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\SystemSettingRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class SystemSettingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->requireSettingsView($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 500);
        $group = $request->query('setting_group');
        $search = $request->query('search');

        if ($group === 'security' && ! $request->user()?->isAdmin()) {
            throw new AccessDeniedHttpException('Security settings are restricted to administrators.');
        }

        $q = SystemSetting::query()
            ->where('brand_id', $brandId)
            ->orderBy('setting_group')
            ->orderBy('setting_key');
        if ($group) {
            $q->where('setting_group', $group);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($qq) use ($s) {
                $qq->where('setting_key', 'like', $s)->orWhere('description', 'like', $s);
            });
        }

        $paginator = $q->paginate($perPage);
        $paginator->getCollection()->transform(fn ($row) => SystemSetting::maskSensitiveArray($row->toArray()));

        return ApiResponse::success($paginator, 'Settings retrieved successfully.');
    }

    /**
     * Enregistre en masse les clés d’un groupe pour la marque active (upsert).
     * Les secrets sensibles ne sont pas mis à jour si la valeur est vide ou masquée,
     * sauf pour les administrateurs qui fournissent une nouvelle valeur.
     */
    public function syncGroup(SyncSystemSettingsGroupRequest $request): JsonResponse
    {
        $this->requireSettingsUpdate($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $validated = $request->validated();
        $group = $validated['setting_group'];
        /** @var array<string, string|null> $settings */
        $settings = $validated['settings'];

        if ($group === 'security' && ! $request->user()?->isAdmin()) {
            throw new AccessDeniedHttpException('Security settings are restricted to administrators.');
        }

        $definitions = SystemSettingRegistry::definitions($group);
        if ($definitions === []) {
            return ApiResponse::error('Groupe inconnu ou vide.', ['setting_group' => ['Invalide.']], 422);
        }

        $isAdmin = $request->user()?->isAdmin() ?? false;

        foreach (array_keys($settings) as $key) {
            if (! array_key_exists($key, $definitions)) {
                return ApiResponse::error(
                    'Clé non autorisée pour ce groupe : '.$key,
                    ['settings' => ['Clé invalide.']],
                    422
                );
            }
        }

        $updatedKeys = [];

        DB::transaction(function () use ($brandId, $group, $settings, $definitions, $isAdmin, &$updatedKeys) {
            foreach ($settings as $key => $rawValue) {
                $value = $rawValue === null ? '' : (string) $rawValue;
                $meta = $definitions[$key];
                $sensitive = $meta['sensitive'] ?? false;

                if ($sensitive && ! $isAdmin) {
                    continue;
                }

                if ($sensitive && SystemSetting::valueIsUnchangedSecretPlaceholder($value)) {
                    continue;
                }

                $row = SystemSetting::query()->updateOrCreate(
                    [
                        'brand_id' => $brandId,
                        'setting_key' => $key,
                    ],
                    [
                        'setting_group' => $group,
                        'setting_value' => $value,
                        'is_sensitive' => $sensitive,
                        'description' => $meta['description'] ?? null,
                    ]
                );

                $updatedKeys[] = $row->setting_key;
            }
        });

        AuditService::log($request, 'settings.sync_group', null, null, [
            'setting_group' => $group,
            'updated_keys' => $updatedKeys,
        ]);

        return ApiResponse::success([
            'setting_group' => $group,
            'updated_keys' => $updatedKeys,
        ], 'Paramètres enregistrés.');
    }

    public function store(StoreSystemSettingRequest $request): JsonResponse
    {
        $this->requireSettingsCreate($request);
        $data = $request->validated();
        $data['brand_id'] = ApiBrandContext::resolveBrandId($request);
        $data['setting_group'] = $data['setting_group'] ?? 'general';
        $data['is_sensitive'] = $data['is_sensitive'] ?? false;

        if (($data['setting_group'] ?? '') === 'security' && ! $request->user()?->isAdmin()) {
            throw new AccessDeniedHttpException('Security settings are restricted to administrators.');
        }

        if (! empty($data['is_sensitive']) && ! $request->user()?->isAdmin()) {
            throw new AccessDeniedHttpException('Only administrators can create sensitive settings.');
        }

        $exists = SystemSetting::query()
            ->where('setting_key', $data['setting_key'])
            ->where('brand_id', $data['brand_id'])
            ->exists();
        if ($exists) {
            abort(422, 'Setting key already exists for this scope.');
        }

        $row = SystemSetting::query()->create($data);

        AuditService::log($request, 'settings.create', $row, null, SystemSetting::maskSensitiveArray($row->fresh()->toArray()));

        return ApiResponse::success(SystemSetting::maskSensitiveArray($row->fresh()->toArray()), 'Setting created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->requireSettingsView($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SystemSetting::query()->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success(SystemSetting::maskSensitiveArray($row->toArray()), 'Setting retrieved successfully.');
    }

    public function update(UpdateSystemSettingRequest $request, string $id): JsonResponse
    {
        $this->requireSettingsUpdate($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SystemSetting::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $data = $request->validated();

        if (array_key_exists('setting_value', $data) && $row->is_sensitive
            && SystemSetting::valueIsUnchangedSecretPlaceholder($data['setting_value'])) {
            unset($data['setting_value']);
        }

        $willBeSensitive = array_key_exists('is_sensitive', $data) ? (bool) $data['is_sensitive'] : $row->is_sensitive;
        $updatesSensitiveValue = ($willBeSensitive || $row->is_sensitive) && array_key_exists('setting_value', $data);

        if (($willBeSensitive || $updatesSensitiveValue) && ! $request->user()?->isAdmin()) {
            throw new AccessDeniedHttpException('Only administrators can update sensitive settings.');
        }

        $row->fill($data);
        $row->save();

        AuditService::log(
            $request,
            'settings.update',
            $row,
            SystemSetting::maskSensitiveArray($before),
            SystemSetting::maskSensitiveArray($row->fresh()->toArray())
        );

        return ApiResponse::success(SystemSetting::maskSensitiveArray($row->fresh()->toArray()), 'Setting updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->requireSettingsDelete($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SystemSetting::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = SystemSetting::maskSensitiveArray($row->toArray());
        $row->delete();

        AuditService::log($request, 'settings.delete', null, $before, null);

        return ApiResponse::success(null, 'Setting deleted successfully.');
    }

    private function requireSettingsView(Request $request): void
    {
        if (! $request->user()?->hasPermissionSlug('settings.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }

    private function requireSettingsCreate(Request $request): void
    {
        if (! $request->user()?->hasPermissionSlug('settings.create')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }

    private function requireSettingsUpdate(Request $request): void
    {
        if (! $request->user()?->hasPermissionSlug('settings.update')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }

    private function requireSettingsDelete(Request $request): void
    {
        if (! $request->user()?->hasPermissionSlug('settings.delete')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
