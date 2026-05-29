<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\CampaignMetric;
use App\Models\Charge;
use App\Models\Customer;
use App\Models\DailyKpi;
use App\Models\Lead;
use App\Models\Message;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DailyKpiGeneratorService
{
    public function __construct(
        protected ReportService $reportService
    ) {}

    public function generateForDate(Carbon $date): int
    {
        $d = $date->toDateString();
        $brands = Brand::query()->pluck('id');
        $count = 0;

        foreach ($brands as $brandId) {
            $from = $date->copy()->startOfDay();
            $to = $date->copy()->endOfDay();

            $leads = Lead::query()->where('brand_id', $brandId)->whereDate('created_at', $d)->count();
            $messages = Message::query()
                ->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
                ->where('conversations.brand_id', $brandId)
                ->whereDate('messages.created_at', $d)
                ->count();

            $o = Order::query()->where('brand_id', $brandId)->whereDate('created_at', $d);
            $totalOrders = (clone $o)->count();
            $ordersConfirmed = (clone $o)->where('status', 'confirmed')->count();
            $ordersDelivered = (clone $o)->where('status', 'delivered')->count();
            $returned = (clone $o)->where('status', 'returned')->count();
            $revenue = (float) Order::query()->where('brand_id', $brandId)->where('status', 'delivered')->whereDate('delivered_at', $d)->sum('total');

            $campaignIds = DB::table('campaigns')->where('brand_id', $brandId)->pluck('id');
            $adSpend = CampaignMetric::query()->whereIn('campaign_id', $campaignIds)->whereDate('metric_date', $d)->sum('spend');

            $influencerSpend = Charge::query()->where('brand_id', $brandId)->where('type', 'influencer')->whereDate('charge_date', $d)->sum('amount');
            $adsFees = Charge::query()->where('brand_id', $brandId)->where('type', 'ads')->whereDate('charge_date', $d)->sum('amount');

            $newCustomers = Customer::query()->where('brand_id', $brandId)->whereDate('created_at', $d)->count();

            $marketing = (float) $adSpend + (float) $influencerSpend + (float) $adsFees;

            $dash = $this->reportService->dashboard((int) $brandId, $d, $d);

            DailyKpi::query()->updateOrCreate(
                ['brand_id' => $brandId, 'kpi_date' => $d],
                [
                    'leads_count' => $leads,
                    'messages_count' => $messages,
                    'orders_confirmed' => $ordersConfirmed,
                    'orders_delivered' => $ordersDelivered,
                    'total_orders' => $totalOrders,
                    'returned_orders' => $returned,
                    'shipped_orders' => $ordersDelivered + $returned,
                    'revenue' => round($revenue, 2),
                    'ad_spend' => round((float) $adSpend, 2),
                    'influencer_spend' => round((float) $influencerSpend, 2),
                    'total_marketing_spend' => round($marketing, 2),
                    'new_customers' => $newCustomers,
                    'cac' => $dash['cac'],
                    'cpa' => $dash['cpa'],
                    'cpc' => null,
                    'aov' => $dash['aov'],
                ]
            );

            $count++;
        }

        Log::info('kpis.generate-daily', ['date' => $d, 'brands_processed' => $count]);

        return $count;
    }
}
