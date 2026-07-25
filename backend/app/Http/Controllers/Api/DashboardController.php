<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Charge;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Product;
use App\Models\Shipment;
use App\Models\StockMovement;
use App\Services\DashboardNotificationService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        protected DashboardNotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $ordersScope = Order::query()
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to));
        ApiBrandContext::scopeBrand($ordersScope, $brandId);

        $leadsScope = Lead::query()
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to));
        ApiBrandContext::scopeBrand($leadsScope, $brandId);

        $shipmentsScope = Shipment::query()
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to));
        ApiBrandContext::scopeBrand($shipmentsScope, $brandId);

        $productsSoldScope = OrderLine::query()
            ->whereHas('order', function ($q) use ($from, $to, $brandId) {
                $q->when($from, fn ($qq) => $qq->whereDate('created_at', '>=', $from))
                    ->when($to, fn ($qq) => $qq->whereDate('created_at', '<=', $to));
                ApiBrandContext::scopeBrand($q, $brandId);
            });
        $productsSoldQty = (int) $productsSoldScope->sum('quantity');

        $leadsCount = (clone $leadsScope)->count();
        $ordersCount = (clone $ordersScope)->count();
        $orderRevenue = (float) (clone $ordersScope)->sum('total');
        $shipmentRevenue = (float) (clone $shipmentsScope)->where('status', 'delivered')->sum('cod_amount');
        $revenue = $orderRevenue > 0 ? $orderRevenue : $shipmentRevenue;
        $confirmedOrders = (clone $ordersScope)->where('status', 'confirmed')->count();
        $deliveredShipments = (clone $shipmentsScope)->where('status', 'delivered')->count();
        $totalShipments = (clone $shipmentsScope)->count();

        $leadsConfirmed = (clone $leadsScope)->where('status', 'confirmed')->count();

        $productsScope = Product::query();
        ApiBrandContext::scopeBrand($productsScope, $brandId);
        $productsCount = (clone $productsScope)->count();
        $lowStockCount = (clone $productsScope)
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
            ->where('status', 'active')
            ->count();

        $customersScope = Customer::query();
        ApiBrandContext::scopeBrand($customersScope, $brandId);

        return ApiResponse::success([
            'counts' => [
                'brands' => Brand::query()->count(),
                'leads' => $leadsCount,
                'orders' => $ordersCount,
                'customers' => $customersScope->count(),
                'shipments' => $totalShipments,
                'products_sold_qty' => $productsSoldQty,
                'revenue' => $revenue,
                'confirmed_orders' => $confirmedOrders,
                'delivered_shipments' => $deliveredShipments,
                'leads_confirmed' => $leadsConfirmed,
                'products' => $productsCount,
                'low_stock' => $lowStockCount,
                'avg_order_value' => $ordersCount > 0 ? round($revenue / $ordersCount, 2) : 0,
                'confirmation_rate' => $leadsCount > 0 ? round(($leadsConfirmed / $leadsCount) * 100, 1) : 0,
                'delivery_rate' => $totalShipments > 0 ? round(($deliveredShipments / $totalShipments) * 100, 1) : 0,
            ],
            'orders_by_status' => (clone $ordersScope)
                ->selectRaw('status, count(*) as aggregate')
                ->groupBy('status')
                ->pluck('aggregate', 'status'),
            'shipments_by_status' => (clone $shipmentsScope)
                ->selectRaw('status, count(*) as aggregate')
                ->groupBy('status')
                ->pluck('aggregate', 'status'),
            'notifications' => $this->notifications->forUser($request->user()),
        ], 'Dashboard summary retrieved successfully.');
    }

    public function notifications(Request $request): JsonResponse
    {
        return ApiResponse::success(
            $this->notifications->forUser($request->user()),
            'Notifications retrieved.'
        );
    }
}
