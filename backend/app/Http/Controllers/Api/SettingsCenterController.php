<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SettingsCenterAuditLog;
use App\Services\SettingsCenterService;
use App\Services\SettingsConnectionTestService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\SettingsCenterRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class SettingsCenterController extends Controller
{
    private const SECTIONS = ['general', 'catalogue', 'integrations', 'delivery', 'whatsapp', 'meta', 'finance', 'security'];

    public function __construct(
        private SettingsCenterService $settingsCenter,
        private SettingsConnectionTestService $connectionTests,
    ) {}

    public function show(Request $request, string $section): JsonResponse
    {
        $this->requireView($request);
        $section = strtolower($section);
        if (! in_array($section, self::SECTIONS, true)) {
            abort(404);
        }
        if ($section === 'security' && ! $request->user()?->isAdmin()) {
            throw new AccessDeniedHttpException('Les paramètres de sécurité sont réservés aux administrateurs.');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);

        return ApiResponse::success($this->settingsCenter->get($section, $brandId), 'OK');
    }

    public function update(Request $request, string $section): JsonResponse
    {
        $this->requireUpdate($request);
        $section = strtolower($section);
        if (! in_array($section, self::SECTIONS, true)) {
            abort(404);
        }
        if ($section === 'security' && ! $request->user()?->isAdmin()) {
            throw new AccessDeniedHttpException('Les paramètres de sécurité sont réservés aux administrateurs.');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $payload = $request->validate(SettingsCenterRules::rules($section));
        $isAdmin = $request->user()?->isAdmin() ?? false;

        $this->settingsCenter->save($request, $section, $brandId, $payload, $isAdmin);

        return ApiResponse::success($this->settingsCenter->get($section, $brandId), 'Enregistré.');
    }

    /**
     * Lightweight endpoint — returns only sidebar-nav visibility for the active brand.
     * Accessible to ANY authenticated user (no settings.view required).
     */
    public function sidebarNavVisibility(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        return ApiResponse::success(
            ['items' => $this->settingsCenter->getSidebarNavVisibility($brandId)],
            'OK',
        );
    }

    /**
     * Lightweight endpoint — returns product categories & types for the active brand.
     * Accessible to ANY authenticated user (no settings.view required).
     */
    public function productOptions(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        return ApiResponse::success(
            $this->settingsCenter->getProductOptions($brandId),
            'OK',
        );
    }

    /**
     * Lightweight endpoint — returns supplier categories for the active brand.
     * Accessible to ANY authenticated user (no settings.view required).
     */
    public function supplierCategories(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        return ApiResponse::success(
            ['categories' => $this->settingsCenter->getSupplierCategories($brandId)],
            'OK',
        );
    }

    /**
     * Quick-add a single value to a known JSON list setting.
     * Used by the inline "Ajouter" buttons in forms.
     */
    public function quickAddListItem(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'list' => 'required|string|in:product_categories,product_types,supplier_categories',
            'value' => 'required|string|max:255',
        ]);

        $this->settingsCenter->appendToJsonList($brandId, 'general', $data['list'], $data['value']);

        return ApiResponse::success(null, 'Ajouté.');
    }

    public function auditHistory(Request $request): JsonResponse
    {
        $this->requireView($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 30), 1), 100);

        $paginator = SettingsCenterAuditLog::query()
            ->with(['user:id,name,email'])
            ->where('brand_id', $brandId)
            ->orderByDesc('created_at')
            ->paginate($perPage);

        $paginator->getCollection()->transform(function (SettingsCenterAuditLog $row) {
            return [
                'id' => $row->id,
                'section' => $row->section,
                'updated_at' => $row->created_at?->toIso8601String(),
                'updated_by' => $row->user ? [
                    'id' => $row->user->id,
                    'name' => $row->user->name,
                    'email' => $row->user->email,
                ] : null,
            ];
        });

        return ApiResponse::success($paginator, 'OK');
    }

    public function testSmtp(Request $request): JsonResponse
    {
        $this->requireUpdate($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $r = $this->connectionTests->smtp($brandId);
        if (! $r['success']) {
            return ApiResponse::error($r['message'], null, 422);
        }

        return ApiResponse::success(['ok' => true], $r['message']);
    }

    public function testWhatsapp(Request $request): JsonResponse
    {
        $this->requireUpdate($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $r = $this->connectionTests->whatsapp($brandId);
        if (! $r['success']) {
            return ApiResponse::error($r['message'], null, 422);
        }

        return ApiResponse::success(['ok' => true], $r['message']);
    }

    public function testMeta(Request $request): JsonResponse
    {
        $this->requireUpdate($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $r = $this->connectionTests->meta($brandId);
        if (! $r['success']) {
            return ApiResponse::error($r['message'], null, 422);
        }

        return ApiResponse::success(['ok' => true], $r['message']);
    }

    public function testDelivery(Request $request): JsonResponse
    {
        $this->requireUpdate($request);
        $brandId = ApiBrandContext::resolveBrandId($request);
        $r = $this->connectionTests->delivery($brandId);
        if (! $r['success']) {
            return ApiResponse::error($r['message'], null, 422);
        }

        return ApiResponse::success(['ok' => true], $r['message']);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $this->requireUpdate($request);
        $brandId = ApiBrandContext::resolveBrandId($request);

        $request->validate([
            'logo' => ['required', 'file', 'max:2048', 'mimes:jpg,jpeg,png,gif,webp,svg'],
        ]);

        try {
            $logoUrl = $this->settingsCenter->storeCompanyLogo($brandId, $request->file('logo'));
        } catch (\InvalidArgumentException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        return ApiResponse::success(['logoUrl' => $logoUrl], 'Logo enregistré.');
    }

    private function requireView(Request $request): void
    {
        if (! $request->user()?->hasPermissionSlug('settings.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }

    private function requireUpdate(Request $request): void
    {
        if (! $request->user()?->hasPermissionSlug('settings.update')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
