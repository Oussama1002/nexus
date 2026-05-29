<?php

namespace App\Services;

use App\Models\CampaignMetric;
use App\Models\Charge;
use App\Models\Customer;
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
    public function delivery(?int $brandId, string $dateFrom, string $dateTo): array
    {
        $from = Carbon::parse($dateFrom)->startOfDay();
        $to = Carbon::parse($dateTo)->endOfDay();

        $shipments = Shipment::query()->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('status, COUNT(*) as c')->groupBy('status')->pluck('c', 'status');

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'shipments_by_status' => $shipments,
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
