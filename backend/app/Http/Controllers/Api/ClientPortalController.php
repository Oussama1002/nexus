<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ClientPortalAccess;
use App\Models\User;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ClientPortalController extends Controller
{
    /** @var string[] */
    private const ALLOWED_WIDGETS = [
        'orders_overview',
        'delivery_overview',
        'ads_overview',
        'activity_timeline',
    ];

    /** @var string[] */
    private const DEFAULT_WIDGETS = [
        'orders_overview',
        'delivery_overview',
        'ads_overview',
        'activity_timeline',
    ];

    public function overview(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'client_portal.view');
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();

        $access = ClientPortalAccess::query()
            ->where('brand_id', $brandId)
            ->where('user_id', $user?->id)
            ->first();
        $widgets = $this->sanitizeWidgets($access?->enabled_widgets);

        $orders = DB::table('orders')
            ->where('brand_id', $brandId)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed")
            ->selectRaw("SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled")
            ->selectRaw("SUM(CASE WHEN status IN ('draft','pending') THEN 1 ELSE 0 END) as in_progress")
            ->first();

        $shipments = DB::table('shipments')
            ->where('brand_id', $brandId)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered")
            ->selectRaw("SUM(CASE WHEN status = 'returned' THEN 1 ELSE 0 END) as returned")
            ->selectRaw("SUM(CASE WHEN status IN ('pending','created','shipped') THEN 1 ELSE 0 END) as in_progress")
            ->first();

        $ads = DB::table('campaign_metrics')
            ->join('campaigns', 'campaigns.id', '=', 'campaign_metrics.campaign_id')
            ->where('campaigns.brand_id', $brandId)
            ->selectRaw('COALESCE(SUM(campaign_metrics.spend), 0) as spend')
            ->selectRaw('COALESCE(SUM(campaign_metrics.revenue), 0) as revenue')
            ->selectRaw('COALESCE(SUM(campaign_metrics.leads), 0) as leads')
            ->first();

        $timeline = AuditLog::query()
            ->with('user:id,name')
            ->whereIn('action', ['orders.create', 'orders.status', 'shipments.status', 'campaigns.create', 'campaigns.update'])
            ->latest('id')
            ->limit(12)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'at' => $log->created_at?->toIso8601String(),
                'actor' => $log->user?->name ?? 'Système',
            ])
            ->values();

        $spend = (float) ($ads->spend ?? 0);
        $revenue = (float) ($ads->revenue ?? 0);

        return ApiResponse::success([
            'widgets' => $widgets,
            'kpis' => [
                'orders' => [
                    'total' => (int) ($orders->total ?? 0),
                    'confirmed' => (int) ($orders->confirmed ?? 0),
                    'cancelled' => (int) ($orders->cancelled ?? 0),
                    'in_progress' => (int) ($orders->in_progress ?? 0),
                ],
                'delivery' => [
                    'total' => (int) ($shipments->total ?? 0),
                    'delivered' => (int) ($shipments->delivered ?? 0),
                    'returned' => (int) ($shipments->returned ?? 0),
                    'in_progress' => (int) ($shipments->in_progress ?? 0),
                ],
                'ads' => [
                    'spend' => round($spend, 2),
                    'revenue' => round($revenue, 2),
                    'leads' => (int) ($ads->leads ?? 0),
                    'roas' => $spend > 0 ? round($revenue / $spend, 4) : null,
                ],
            ],
            'timeline' => $timeline,
        ], 'Client portal overview retrieved.');
    }

    public function listAccesses(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'client_portal.manage');
        $brandId = ApiBrandContext::resolveBrandId($request);

        $users = User::query()
            ->whereHas('brands', fn ($q) => $q->where('brands.id', $brandId))
            ->whereHas('roles', fn ($q) => $q->where('slug', 'client_brand_owner'))
            ->with(['roles:id,slug,name'])
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        $accesses = ClientPortalAccess::query()
            ->where('brand_id', $brandId)
            ->get()
            ->keyBy('user_id');

        $rows = $users->map(function (User $user) use ($accesses) {
            /** @var ClientPortalAccess|null $access */
            $access = $accesses->get($user->id);

            return [
                'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
                'enabled_widgets' => $this->sanitizeWidgets($access?->enabled_widgets),
            ];
        })->values();

        return ApiResponse::success([
            'allowed_widgets' => self::ALLOWED_WIDGETS,
            'rows' => $rows,
        ], 'Client portal access list retrieved.');
    }

    public function updateAccess(Request $request, string $userId): JsonResponse
    {
        $this->requirePermission($request, 'client_portal.manage');
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'enabled_widgets' => ['required', 'array', 'min:1'],
            'enabled_widgets.*' => ['string'],
        ]);

        $user = User::query()
            ->whereKey((int) $userId)
            ->whereHas('brands', fn ($q) => $q->where('brands.id', $brandId))
            ->whereHas('roles', fn ($q) => $q->where('slug', 'client_brand_owner'))
            ->firstOrFail();

        $widgets = $this->sanitizeWidgets($data['enabled_widgets']);
        $access = ClientPortalAccess::query()->updateOrCreate(
            ['brand_id' => $brandId, 'user_id' => $user->id],
            ['enabled_widgets' => $widgets]
        );

        return ApiResponse::success([
            'user_id' => $user->id,
            'enabled_widgets' => $this->sanitizeWidgets($access->enabled_widgets),
        ], 'Client portal access updated.');
    }

    /**
     * @param  mixed  $widgets
     * @return string[]
     */
    private function sanitizeWidgets(mixed $widgets): array
    {
        if (! is_array($widgets)) {
            return self::DEFAULT_WIDGETS;
        }
        $rows = array_values(array_unique(array_filter(array_map(
            fn ($w) => in_array((string) $w, self::ALLOWED_WIDGETS, true) ? (string) $w : null,
            $widgets
        ))));

        return count($rows) > 0 ? $rows : self::DEFAULT_WIDGETS;
    }

    private function requirePermission(Request $request, string $slug): void
    {
        if (! $request->user()?->hasPermissionSlug($slug)) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
