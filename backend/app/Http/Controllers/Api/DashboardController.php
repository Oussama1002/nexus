<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Shipment;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $ordersScope = Order::query()
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to));

        $leadsCount = Lead::query()
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
            ->count();

        $shipmentsScope = Shipment::query()
            ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to));

        $productsSoldQty = (int) OrderLine::query()
            ->whereHas('order', function ($q) use ($from, $to) {
                $q->when($from, fn ($qq) => $qq->whereDate('created_at', '>=', $from))
                    ->when($to, fn ($qq) => $qq->whereDate('created_at', '<=', $to));
            })
            ->sum('quantity');

        return ApiResponse::success([
            'counts' => [
                'brands' => Brand::query()->count(),
                'leads' => $leadsCount,
                'orders' => (clone $ordersScope)->count(),
                'customers' => Customer::query()->count(),
                'shipments' => (clone $shipmentsScope)->count(),
                'products_sold_qty' => $productsSoldQty,
                'revenue' => (float) (clone $ordersScope)->sum('total'),
            ],
            'orders_by_status' => (clone $ordersScope)
                ->selectRaw('status, count(*) as aggregate')
                ->groupBy('status')
                ->pluck('aggregate', 'status'),
            'shipments_by_status' => (clone $shipmentsScope)
                ->selectRaw('status, count(*) as aggregate')
                ->groupBy('status')
                ->pluck('aggregate', 'status'),
        ], 'Dashboard summary retrieved successfully.');
    }
}
