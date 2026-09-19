<?php

namespace App\Services;

use App\Models\CampaignMetric;
use App\Models\Charge;
use App\Models\Customer;
use App\Models\DeliveryCompany;
use App\Models\Lead;
use App\Models\Message;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\StockMovement;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * @return array<string, mixed>
     */
    public function dashboard(?int $brandId, string $dateFrom, string $dateTo): array
    {
        $from = Carbon::parse($dateFrom)->startOfDay();
        $to = Carbon::parse($dateTo)->endOfDay();

        $ordersBase = Order::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('created_at', [$from, $to]);

        $totalOrders = (clone $ordersBase)->count();
        $confirmedLiteral = (clone $ordersBase)->where('status', 'confirmed')->count();
        $deliveredOrders = (clone $ordersBase)->where('status', 'delivered')->count();
        $returnedOrders = (clone $ordersBase)->where('status', 'returned')->count();

        $revenue = (float) (clone $ordersBase)->where('status', 'delivered')->sum('total');

        $leads = Lead::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('created_at', [$from, $to])->count();

        $messages = Message::query()
            ->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
            ->when($brandId, fn ($q) => $q->where('conversations.brand_id', $brandId))
            ->whereBetween('messages.created_at', [$from, $to])
            ->count();

        $campaignIds = DB::table('campaigns')->when($brandId, fn ($q) => $q->where('brand_id', $brandId))->pluck('id');
        $adSpend = CampaignMetric::query()->whereIn('campaign_id', $campaignIds)
            ->whereBetween('metric_date', [$from->toDateString(), $to->toDateString()])
            ->sum('spend');

        $influencerSpend = Charge::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->where('type', 'influencer')
            ->whereBetween('charge_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $adsFeeCharges = Charge::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->where('type', 'ads')
            ->whereBetween('charge_date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $totalMarketingSpend = (float) $adSpend + (float) $influencerSpend + (float) $adsFeeCharges;

        $newCustomers = Customer::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('created_at', [$from, $to])->count();

        $cac = $newCustomers > 0 ? round($totalMarketingSpend / $newCustomers, 2) : null;
        $cpa = $confirmedLiteral > 0 ? round((float) $adSpend / $confirmedLiteral, 2) : null;
        $aov = $deliveredOrders > 0 ? round($revenue / $deliveredOrders, 2) : null;

        $confirmationRate = $totalOrders > 0 ? round($confirmedLiteral / $totalOrders, 4) : null;
        $deliveryRate = $confirmedLiteral > 0 ? round($deliveredOrders / $confirmedLiteral, 4) : null;

        $shippedOrders = $deliveredOrders + $returnedOrders;
        $returnRate = $shippedOrders > 0 ? round($returnedOrders / $shippedOrders, 4) : null;

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'brand_id' => $brandId,
            'total_leads' => $leads,
            'total_messages' => $messages,
            'total_orders' => $totalOrders,
            'confirmed_orders' => $confirmedLiteral,
            'delivered_orders' => $deliveredOrders,
            'returned_orders' => $returnedOrders,
            'revenue' => round($revenue, 2),
            'ad_spend' => round((float) $adSpend, 2),
            'ads_fee_charges' => round((float) $adsFeeCharges, 2),
            'influencer_spend' => round((float) $influencerSpend, 2),
            'total_marketing_spend' => round($totalMarketingSpend, 2),
            'new_customers' => $newCustomers,
            'cac' => $cac,
            'cpa' => $cpa,
            'aov' => $aov,
            'confirmation_rate' => $confirmationRate,
            'delivery_rate' => $deliveryRate,
            'return_rate' => $returnRate,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function commercial(?int $brandId, string $dateFrom, string $dateTo): array
    {
        $from = Carbon::parse($dateFrom)->startOfDay();
        $to = Carbon::parse($dateTo)->endOfDay();

        $leads = Lead::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('status, COUNT(*) as c')->groupBy('status')->pluck('c', 'status');

        $ordersByStatus = Order::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('status, COUNT(*) as c')->groupBy('status')->pluck('c', 'status');

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'leads_by_status' => $leads,
            'orders_by_status' => $ordersByStatus,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    /**
     * Ads dashboard aggregates with optional filters (platform, campaign, media buyer / confirmatrice).
     *
     * @return array<string, mixed>
     */
    public function ads(
        ?int $brandId,
        string $dateFrom,
        string $dateTo,
        ?string $platform = null,
        ?int $campaignId = null,
        ?int $mediaBuyerId = null,
    ): array {
        $from = Carbon::parse($dateFrom)->toDateString();
        $to = Carbon::parse($dateTo)->toDateString();

        $base = CampaignMetric::query()
            ->join('campaigns', 'campaigns.id', '=', 'campaign_metrics.campaign_id')
            ->leftJoin('ad_accounts', 'ad_accounts.id', '=', 'campaigns.ad_account_id')
            ->when($brandId, fn ($qq) => $qq->where('campaigns.brand_id', $brandId))
            ->whereBetween('campaign_metrics.metric_date', [$from, $to])
            ->when($platform, fn ($q) => $q->where('campaigns.source', $platform))
            ->when($campaignId, fn ($q) => $q->where('campaigns.id', $campaignId))
            ->when($mediaBuyerId, function ($q) use ($mediaBuyerId) {
                $q->where(function ($qq) use ($mediaBuyerId) {
                    $qq->where('campaigns.confirmatrice_user_id', $mediaBuyerId)
                        ->orWhere('ad_accounts.responsible_user_id', $mediaBuyerId);
                });
            });

        $spend = (float) (clone $base)->sum('campaign_metrics.spend');
        $impressions = (int) (clone $base)->sum('campaign_metrics.impressions');
        $clicks = (int) (clone $base)->sum('campaign_metrics.clicks');
        $leads = (int) (clone $base)->sum('campaign_metrics.leads');
        $messages = (int) (clone $base)->sum('campaign_metrics.messages');
        $confirmedOrders = (int) (clone $base)->sum('campaign_metrics.confirmed_orders');
        $deliveredOrders = (int) (clone $base)->sum('campaign_metrics.delivered_orders');
        $revenue = (float) (clone $base)->sum('campaign_metrics.revenue');

        $cpc = $clicks > 0 ? round($spend / $clicks, 4) : null;
        $cpm = $impressions > 0 ? round($spend / $impressions * 1000, 4) : null;
        $cpl = $leads > 0 ? round($spend / $leads, 4) : null;
        $cpa = $confirmedOrders > 0 ? round($spend / $confirmedOrders, 4) : null;
        $roas = $spend > 0 ? round($revenue / $spend, 4) : null;

        return [
            'period' => ['from' => $from, 'to' => $to],
            'filters' => [
                'brand_id' => $brandId,
                'platform' => $platform,
                'campaign_id' => $campaignId,
                'media_buyer_id' => $mediaBuyerId,
            ],
            'metrics_rollups' => [
                'spend' => round($spend, 2),
                'impressions' => $impressions,
                'reach' => (int) (clone $base)->sum('campaign_metrics.reach'),
                'clicks' => $clicks,
                'messages' => $messages,
                'leads' => $leads,
                'confirmed_orders' => $confirmedOrders,
                'delivered_orders' => $deliveredOrders,
                'revenue' => round($revenue, 2),
                'cpc' => $cpc,
                'cpm' => $cpm,
                'cpl' => $cpl,
                'cpa' => $cpa,
                'roas' => $roas,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function stock(?int $brandId, string $dateFrom, string $dateTo): array
    {
        $from = Carbon::parse($dateFrom)->startOfDay();
        $to = Carbon::parse($dateTo)->endOfDay();

        $movements = StockMovement::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('moved_at', [$from, $to])
            ->selectRaw('movement_type, SUM(quantity) as qty')
            ->groupBy('movement_type')
            ->pluck('qty', 'movement_type');

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'movements_by_type' => $movements,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function delivery(?int $brandId, string $dateFrom, string $dateTo, ?int $deliveryCompanyId = null): array
    {
        $from = Carbon::parse($dateFrom)->startOfDay();
        $to = Carbon::parse($dateTo)->endOfDay();

        // Same basis as Livraison — tableau de bord: carrier-imported parcels use their ship date, not the import date.
        $base = fn () => Shipment::query()
            ->when($brandId, fn ($q) => $q->where('shipments.brand_id', $brandId))
            ->when($deliveryCompanyId, fn ($q) => $q->where('shipments.delivery_company_id', $deliveryCompanyId))
            ->whereRaw('COALESCE(shipments.shipped_at, shipments.created_at) BETWEEN ? AND ?', [$from, $to]);

        $shipments = $base()->selectRaw('status, COUNT(*) as c')->groupBy('status')->pluck('c', 'status');

        $count = fn (string ...$s) => array_sum(array_map(fn ($k) => (int) ($shipments[$k] ?? 0), $s));
        $delivered = $count('delivered');
        $returned = $count('returned');
        $failed = $count('failed');
        $terminal = max(1, $delivered + $returned + $failed);

        $avgDays = $base()->where('status', 'delivered')->whereNotNull('delivered_at')
            ->get(['shipped_at', 'created_at', 'delivered_at'])
            ->map(fn (Shipment $s) => $s->delivered_at->diffInSeconds($s->shipped_at ?? $s->created_at, true) / 86400)
            ->avg();

        $kpis = [
            'total' => (int) $shipments->sum(),
            'pending' => $count('pending', 'created'),
            'in_transit' => $count('in_transit', 'out_for_delivery', 'picked_up', 'shipped'),
            'delivered' => $delivered,
            'returned' => $returned,
            'failed' => $failed,
            'cancelled' => $count('cancelled'),
            'delivery_rate' => round(100 * $delivered / $terminal, 1),
            'return_rate' => round(100 * $returned / $terminal, 1),
            'failure_rate' => round(100 * $failed / $terminal, 1),
            'revenue' => round((float) $base()->where('shipments.status', 'delivered')
                ->join('orders', 'orders.id', '=', 'shipments.order_id')->sum('orders.total'), 2),
            'cod_total' => round((float) $base()->sum('cod_amount'), 2),
            'cod_pending' => round((float) $base()->where('payment_status', 'cod_pending')->sum('cod_amount'), 2),
            'cod_received' => round((float) $base()->where('payment_status', 'cod_received')->sum('cod_amount'), 2),
            'cod_reconciled' => round((float) $base()->where('payment_status', 'reconciled')->sum('cod_amount'), 2),
            'fee_total' => round((float) $base()->sum('delivery_fee'), 2),
            'avg_delivery_days' => $avgDays !== null ? round((float) $avgDays, 1) : null,
            'delayed' => $base()->whereNotIn('status', ['delivered', 'returned', 'cancelled', 'failed'])
                ->where('shipments.created_at', '<', now()->subDays(7))->count(),
        ];

        $byCity = $base()
            ->selectRaw('COALESCE(recipient_city, city) AS city, COUNT(*) AS c, SUM(status = \'delivered\') AS delivered')
            ->groupBy(DB::raw('COALESCE(recipient_city, city)'))
            ->orderByDesc('c')->limit(10)->get()
            ->map(fn ($r) => ['city' => $r->city ?: '—', 'total' => (int) $r->c, 'delivered' => (int) $r->delivered]);

        // Per-carrier KPIs. Groups shipments by delivery_company (Ameex,
        // Sendit, …) — status breakdown, delivery rate, average COD, average
        // delivery fee, unlabelled shipments (no delivery_company set) fall
        // under "Sans transporteur" so nothing is dropped.
        $rows = $base()
            ->leftJoin('delivery_companies as dc', 'dc.id', '=', 'shipments.delivery_company_id')
            ->selectRaw("
                COALESCE(dc.name, 'Sans transporteur') AS carrier_name,
                COALESCE(dc.code, '')                   AS carrier_code,
                shipments.status                        AS status,
                COUNT(*)                                AS c,
                COALESCE(SUM(shipments.cod_amount), 0)  AS cod_total,
                COALESCE(SUM(shipments.delivery_fee), 0) AS fee_total
            ")
            ->groupBy('carrier_name', 'carrier_code', 'shipments.status')
            ->get();

        $byCarrier = [];
        foreach ($rows as $r) {
            $key = (string) $r->carrier_name;
            $bucket = $byCarrier[$key] ?? [
                'name' => (string) $r->carrier_name,
                'code' => (string) $r->carrier_code,
                'total' => 0,
                'delivered' => 0,
                'returned' => 0,
                'cancelled' => 0,
                'pending' => 0,
                'in_transit' => 0,
                'failed' => 0,
                'cod_total' => 0.0,
                'fee_total' => 0.0,
                'by_status' => [],
            ];
            $count = (int) $r->c;
            $bucket['total'] += $count;
            $bucket['cod_total'] += (float) $r->cod_total;
            $bucket['fee_total'] += (float) $r->fee_total;
            $status = (string) $r->status;
            $bucket['by_status'][$status] = ($bucket['by_status'][$status] ?? 0) + $count;
            $mapped = match ($status) {
                'delivered' => 'delivered',
                'returned' => 'returned',
                'cancelled' => 'cancelled',
                'in_transit', 'shipped', 'picked_up', 'out_for_delivery' => 'in_transit',
                'failed' => 'failed',
                default => 'pending',
            };
            $bucket[$mapped] += $count;
            $byCarrier[$key] = $bucket;
        }
        // Delivery rate per carrier (livrés / (livrés + retournés + annulés + échec) — colis à statut final).
        $carrierList = array_values(array_map(function (array $b) {
            $final = $b['delivered'] + $b['returned'] + $b['cancelled'] + $b['failed'];
            $b['delivery_rate'] = $final > 0 ? round($b['delivered'] * 100 / $final, 1) : null;
            $b['avg_cod'] = $b['delivered'] > 0 ? round($b['cod_total'] / $b['delivered'], 2) : null;
            $b['avg_fee'] = $b['total'] > 0 ? round($b['fee_total'] / $b['total'], 2) : null;
            $b['cod_total'] = round($b['cod_total'], 2);
            $b['fee_total'] = round($b['fee_total'], 2);
            return $b;
        }, $byCarrier));
        usort($carrierList, fn ($a, $b) => $b['total'] <=> $a['total']);

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'shipments_by_status' => $shipments,
            'kpis' => $kpis,
            'by_city' => $byCity,
            'by_carrier' => $carrierList,
            'carriers' => DeliveryCompany::query()->orderBy('name')->get(['id', 'name']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function finance(?int $brandId, string $dateFrom, string $dateTo): array
    {
        $from = Carbon::parse($dateFrom)->toDateString();
        $to = Carbon::parse($dateTo)->toDateString();

        $byType = Charge::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('charge_date', [$from, $to])
            ->selectRaw('type, SUM(amount) as total')->groupBy('type')->pluck('total', 'type');

        return [
            'period' => ['from' => $from, 'to' => $to],
            'charges_by_type' => $byType,
            'total' => round((float) $byType->sum(), 2),
        ];
    }
}
