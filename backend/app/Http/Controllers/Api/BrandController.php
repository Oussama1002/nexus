<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreBrandRequest;
use App\Http\Requests\Api\UpdateBrandRequest;
use App\Models\Brand;
use App\Models\Order;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->loadMissing(['roles', 'brands']);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');

        // Le nombre de campagnes et le numero WhatsApp configure viennent de
        // la base, pas d'une valeur saisie sur la fiche marque.
        // Les archivees sont exclues, comme dans le module Campagnes : deux
        // compteurs divergents sur le meme objet ne s'expliquent pas.
        $q = Brand::query()
            ->withCount(['campaigns' => fn ($c) => $c->whereNull('archived_at')])
            ->orderBy('name');
        if (! $user->isAdmin()) {
            $q->whereIn('id', $user->brands->pluck('id'));
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)->orWhere('code', 'like', $s);
            });
        }

        $paginator = $q->paginate($perPage);

        $brandIds = $paginator->getCollection()->pluck('id');

        // Source principale : les numeros declares dans Parametres -> WhatsApp.
        // L'ancien reglage unique ne sert plus que de repli.
        $declared = \App\Models\WhatsAppNumber::query()
            ->whereIn('brand_id', $brandIds)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->get(['brand_id', 'display_number', 'label'])
            ->groupBy('brand_id')
            ->map(fn ($rows) => $rows
                ->map(fn ($n) => trim((string) $n->display_number))
                ->filter()
                ->unique()
                ->implode(', '));

        $legacy = \App\Models\SystemSetting::query()
            ->whereIn('brand_id', $brandIds)
            ->where('setting_key', 'wa_business_number')
            ->pluck('setting_value', 'brand_id');

        $paginator->getCollection()->transform(function (Brand $brand) use ($declared, $legacy) {
            $configured = trim((string) ($declared[$brand->id] ?? '')) ?: trim((string) ($legacy[$brand->id] ?? ''));
            $brand->setAttribute('whatsapp_configured_number', $configured !== '' ? $configured : null);

            return $brand;
        });

        return ApiResponse::success($paginator, 'Brands retrieved successfully.');
    }

    public function store(StoreBrandRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['status'] = $data['status'] ?? 'active';

        $brand = Brand::query()->create($data);
        $request->user()->brands()->syncWithoutDetaching([$brand->id]);

        AuditLogger::log($request, 'brands.create', $brand, null, $brand->toArray());

        return ApiResponse::success($brand->fresh(), 'Brand created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brand = Brand::query()->findOrFail($id);
        $this->authorizeBrandAccess($request, $brand->id);

        return ApiResponse::success($brand, 'Brand retrieved successfully.');
    }

    public function update(UpdateBrandRequest $request, string $id): JsonResponse
    {
        $brand = Brand::query()->findOrFail($id);
        $this->authorizeBrandAccess($request, $brand->id);
        $before = $brand->toArray();
        $brand->fill($request->validated());
        $brand->save();

        AuditLogger::log($request, 'brands.update', $brand, $before, $brand->fresh()->toArray());

        return ApiResponse::success($brand->fresh(), 'Brand updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brand = Brand::query()->findOrFail($id);
        $this->authorizeBrandAccess($request, $brand->id);

        if (Order::query()->where('brand_id', $brand->id)->exists()) {
            return ApiResponse::error('Cannot delete brand with existing orders.', null, 422);
        }

        $before = $brand->toArray();
        $brand->delete();

        AuditLogger::log($request, 'brands.delete', null, $before, null);

        return ApiResponse::success(null, 'Brand deleted successfully.');
    }

    /**
     * Fiche de référence marque pour le Community Manager (spec Droits CM §6).
     * Lecture seule, limitée à la marque active (qui doit être attribuée au CM),
     * et seulement si l'admin a rendu la fiche visible. Aucune donnée de vente
     * ni financière n'est renvoyée.
     */
    public function cmReference(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: true);
        $this->authorizeBrandAccess($request, (int) $brandId);

        $brand = Brand::query()->findOrFail($brandId);

        // L'admin voit toujours la fiche (prévisualisation) ; les autres rôles
        // seulement quand elle est marquée visible.
        $visible = $request->user()->isAdmin() || (bool) $brand->cm_reference_visible;
        if (! $visible) {
            return ApiResponse::success([
                'visible' => false,
                'brand' => ['id' => $brand->id, 'name' => $brand->name, 'color' => $brand->color],
            ], 'Fiche non disponible.');
        }

        $products = $brand->products()
            ->where('status', 'active')
            ->orderBy('name')
            ->pluck('name')
            ->values();

        return ApiResponse::success([
            'visible' => true,
            'brand' => ['id' => $brand->id, 'name' => $brand->name, 'color' => $brand->color],
            'presentation' => $brand->cm_presentation,
            'tone_rules' => $brand->cm_tone_rules,
            'canned_replies' => $brand->cm_canned_replies,
            'faq' => $brand->cm_faq,
            'escalation_contacts' => $brand->cm_escalation_contacts,
            'products' => $products,
        ], 'Fiche de référence marque.');
    }

    protected function authorizeBrandAccess(Request $request, int $brandId): void
    {
        $user = $request->user();
        $user->loadMissing(['roles', 'brands']);
        if ($user->isAdmin()) {
            return;
        }
        if (! $user->brands->contains('id', $brandId)) {
            abort(403, 'Forbidden');
        }
    }
}
