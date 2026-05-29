<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\Supplier;
use Carbon\Carbon;

class ProcurementDashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function summary(?int $brandId, ?string $dateFrom, ?string $dateTo): array
    {
        $from = $dateFrom ? Carbon::parse($dateFrom)->startOfDay() : now()->startOfMonth();
        $to = $dateTo ? Carbon::parse($dateTo)->endOfDay() : now()->endOfDay();

        $poScope = PurchaseOrder::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId));

        $poPeriod = (clone $poScope)->whereBetween('ordered_at', [$from->toDateString(), $to->toDateString()]);

        $countOrders = (clone $poPeriod)->count();
        $purchaseAmount = (float) (clone $poPeriod)->sum('total_amount');

        $activeSuppliers = Supplier::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereHas('purchaseOrders', fn ($q) => $q->whereBetween('ordered_at', [$from->toDateString(), $to->toDateString()]))
            ->count();

        $pendingStatuses = ['draft', 'sent', 'confirmed', 'partially_received'];
        $pendingCount = (clone $poScope)
            ->whereIn('status', $pendingStatuses)
            ->count();

        $today = now()->toDateString();
        $lateDeliveries = (clone $poScope)
            ->whereNotIn('status', ['received', 'cancelled', 'returned'])
            ->whereNotNull('expected_delivery_date')
            ->whereDate('expected_delivery_date', '<', $today)
            ->count();

        $qtyReceived = (int) PurchaseOrderLine::query()
            ->whereHas('purchaseOrder', fn ($q) => $q->when($brandId, fn ($qq) => $qq->where('brand_id', $brandId)))
            ->whereBetween('updated_at', [$from, $to])
            ->sum('quantity_received');

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'kpis' => [
                'purchase_orders_count' => $countOrders,
                'purchase_amount_total' => round($purchaseAmount, 2),
                'active_suppliers_count' => $activeSuppliers,
                'pending_orders_count' => $pendingCount,
                'late_deliveries_count' => $lateDeliveries,
                'quantity_received_total' => $qtyReceived,
            ],
        ];
    }
}
