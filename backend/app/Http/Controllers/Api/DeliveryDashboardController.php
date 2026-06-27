<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use App\Services\Delivery\SenditInboundSyncService;
use App\Services\ShipmentOperationsService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DeliveryDashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $dc = $request->query('delivery_company_id');
        $brandFilter = $request->query('brand_id');

        $q = Shipment::query();
        ApiBrandContext::scopeBrand($q, $brandId, 'shipments.brand_id');
        if ($brandFilter && ($brandId === null || (int) $brandFilter !== (int) $brandId)) {
            $q->where('shipments.brand_id', (int) $brandFilter);
        }
        if ($from) {
            $q->whereDate('shipments.created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('shipments.created_at', '<=', $to);
        }
        if ($dc) {
            $q->where('shipments.delivery_company_id', (int) $dc);
        }

        if ($request->user()->shouldRestrictShipmentsToAssignedOrders()) {
            $q->whereHas('order', fn ($w) => $w->where('assigned_user_id', $request->user()->id));
        }

        $base = (clone $q);
        $total = (clone $q)->count();

        $byStatus = (clone $q)
            ->select('status', DB::raw('count(*) as c'))
            ->groupBy('status')
            ->pluck('c', 'status')
            ->all();

        $count = fn (string $s) => (int) ($byStatus[$s] ?? 0);

        $inTransit = $count('in_transit') + $count('out_for_delivery') + $count('picked_up');
        $delivered = $count('delivered');
        $returned = $count('returned');
        $failed = $count('failed');
        $pending = $count('pending') + $count('created');

        $den = max(1, $delivered + $returned);
        $deliveryRate = round(100 * $delivered / $den, 2);
        $returnRate = round(100 * $returned / $den, 2);

        $codPending = (clone $q)->where('payment_status', 'cod_pending')->sum('cod_amount');
        $codReconciled = (clone $q)->where('payment_status', 'reconciled')->sum('cod_amount');

        $deliveredRows = (clone $q)
            ->where('status', 'delivered')
            ->whereNotNull('delivered_at')
            ->whereNotNull('shipped_at')
            ->get(['shipped_at', 'delivered_at']);
        $avgDays = null;
        if ($deliveredRows->isNotEmpty()) {
            $segments = $deliveredRows->map(function (Shipment $s) {
                if (! $s->delivered_at) {
                    return null;
                }
                $start = $s->shipped_at ?? $s->created_at;
                if (! $start) {
                    return null;
                }

                return $s->delivered_at->diffInSeconds($start) / 86400;
            })->filter(fn ($v) => $v !== null);

            if ($segments->isNotEmpty()) {
                $avgDays = round((float) $segments->avg(), 2);
            }
        }

        $byCompany = (clone $base)
            ->select('delivery_company_id', DB::raw('count(*) as c'))
            ->groupBy('delivery_company_id')
            ->get()
            ->map(fn ($r) => ['delivery_company_id' => $r->delivery_company_id, 'count' => $r->c]);

        $byCity = (clone $base)
            ->selectRaw('COALESCE(recipient_city, city) as city_label, count(*) as c')
            ->groupBy(DB::raw('COALESCE(recipient_city, city)'))
            ->orderByDesc('c')
            ->limit(15)
            ->get();

        $delayed = (clone $q)
            ->whereNotIn('status', ['delivered', 'returned', 'cancelled', 'failed'])
            ->where('created_at', '<', now()->subDays(7))
            ->count();

        $revenue = (clone $q)
            ->where('shipments.status', 'delivered')
            ->whereNotNull('shipments.order_id')
            ->join('orders', 'orders.id', '=', 'shipments.order_id')
            ->sum('orders.total');

        return ApiResponse::success([
            'total_shipments' => $total,
            'pending_shipments' => $pending,
            'in_transit_shipments' => $inTransit,
            'delivered_shipments' => $delivered,
            'returned_shipments' => $returned,
            'failed_shipments' => $failed,
            'delivery_rate' => $deliveryRate,
            'return_rate' => $returnRate,
            'cod_pending_amount' => round((float) $codPending, 2),
            'cod_reconciled_amount' => round((float) $codReconciled, 2),
            'average_delivery_days' => $avgDays,
            'shipments_by_company' => $byCompany,
            'shipments_by_city' => $byCity,
            'delayed_shipments' => $delayed,
            'revenue' => round((float) $revenue, 2),
            'internal_statuses' => ShipmentOperationsService::STATUSES,
        ], 'Delivery dashboard.');
    }

    public function syncSendit(Request $request, SenditInboundSyncService $senditSync): JsonResponse
    {
        set_time_limit(300);

        try {
            $brandId = ApiBrandContext::resolveBrandId($request);
            $maxPages = min(max((int) $request->input('max_pages', 5), 1), 20);
            $startPage = max((int) $request->input('start_page', 1), 1);

            $result = $senditSync->sync($brandId, $request->user(), $maxPages, $startPage);

            if ($result['total'] === 0 && $result['errors'] !== []) {
                return ApiResponse::error($result['errors'][0] ?? 'Synchronisation Sendit impossible.', $result, 422);
            }

            $message = sprintf(
                'Sendit synchronisé : %d colis traités (%d nouveaux, %d mis à jour, %d actions).',
                $result['total'],
                $result['imported'],
                $result['updated'],
                $result['events']
            );

            return ApiResponse::success($result, $message);
        } catch (\Throwable $e) {
            return ApiResponse::error('Synchronisation Sendit interrompue : '.$e->getMessage(), null, 500);
        }
    }
}
