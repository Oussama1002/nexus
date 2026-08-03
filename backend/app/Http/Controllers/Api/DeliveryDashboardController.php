<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Shipment;
use App\Services\Delivery\AmeexInboundSyncService;
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
            $q->whereRaw('DATE(COALESCE(shipments.shipped_at, shipments.created_at)) >= ?', [$from]);
        }
        if ($to) {
            $q->whereRaw('DATE(COALESCE(shipments.shipped_at, shipments.created_at)) <= ?', [$to]);
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
        $codReceived = (clone $q)->where('payment_status', 'cod_received')->sum('cod_amount');
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
            'cod_received_amount' => round((float) $codReceived, 2),
            'cod_reconciled_amount' => round((float) $codReconciled, 2),
            'average_delivery_days' => $avgDays,
            'shipments_by_company' => $byCompany,
            'shipments_by_city' => $byCity,
            'delayed_shipments' => $delayed,
            'revenue' => round((float) $revenue, 2),
            'internal_statuses' => ShipmentOperationsService::STATUSES,
        ], 'Delivery dashboard.');
    }

    private function resolveBrandIds(Request $request): array
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        if ($brandId !== null) {
            return [$brandId];
        }

        return Brand::pluck('id')->all();
    }

    public function syncSendit(Request $request, SenditInboundSyncService $senditSync): JsonResponse
    {
        set_time_limit(600);

        try {
            $brandIds = $this->resolveBrandIds($request);
            $maxPages = min(max((int) $request->input('max_pages', 50), 1), 200);
            $startPage = max((int) $request->input('start_page', 1), 1);

            $merged = ['imported' => 0, 'updated' => 0, 'events' => 0, 'pages' => 0, 'total' => 0, 'errors' => [], 'has_more' => false, 'next_page' => 1];

            foreach ($brandIds as $bid) {
                $result = $senditSync->sync($bid, $request->user(), $maxPages, $startPage);
                $merged['imported'] += $result['imported'];
                $merged['updated'] += $result['updated'];
                $merged['events'] += $result['events'];
                $merged['pages'] += $result['pages'];
                $merged['total'] += $result['total'];
                $merged['errors'] = array_merge($merged['errors'], $result['errors']);
                if ($result['has_more']) {
                    $merged['has_more'] = true;
                    $merged['next_page'] = max($merged['next_page'], $result['next_page']);
                }
            }

            $message = sprintf(
                'Sendit synchronisé : %d colis traités (%d nouveaux, %d mis à jour, %d actions).',
                $merged['total'], $merged['imported'], $merged['updated'], $merged['events']
            );

            return ApiResponse::success($merged, $message);
        } catch (\Throwable $e) {
            return ApiResponse::error('Synchronisation Sendit interrompue : '.$e->getMessage(), null, 500);
        }
    }

    public function syncAmeex(Request $request, AmeexInboundSyncService $ameexSync): JsonResponse
    {
        set_time_limit(600);

        try {
            $brandIds = $this->resolveBrandIds($request);
            $maxPages = min(max((int) $request->input('max_pages', 50), 1), 200);
            $startPage = max((int) $request->input('start_page', 1), 1);

            $merged = ['imported' => 0, 'updated' => 0, 'events' => 0, 'pages' => 0, 'total' => 0, 'errors' => [], 'has_more' => false, 'next_page' => 1];

            foreach ($brandIds as $bid) {
                $result = $ameexSync->sync($bid, $request->user(), $maxPages, $startPage);
                $merged['imported'] += $result['imported'];
                $merged['updated'] += $result['updated'];
                $merged['events'] += $result['events'];
                $merged['pages'] += $result['pages'];
                $merged['total'] += $result['total'];
                $merged['errors'] = array_merge($merged['errors'], $result['errors']);
                if ($result['has_more']) {
                    $merged['has_more'] = true;
                    $merged['next_page'] = max($merged['next_page'], $result['next_page']);
                }
            }

            $message = sprintf(
                'Ameex synchronisé : %d colis traités (%d nouveaux, %d mis à jour, %d actions).',
                $merged['total'], $merged['imported'], $merged['updated'], $merged['events']
            );

            if ($merged['errors'] !== []) {
                $message .= ' Erreurs: ' . implode('; ', array_slice($merged['errors'], 0, 3));
            }

            return ApiResponse::success($merged, $message);
        } catch (\Throwable $e) {
            return ApiResponse::error('Synchronisation Ameex interrompue : '.$e->getMessage(), null, 500);
        }
    }
}
