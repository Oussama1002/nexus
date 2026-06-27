<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(
        protected ReportService $reportService
    ) {}

    protected function parsePeriod(Request $request): array
    {
        $df = $request->query('date_from');
        $dt = $request->query('date_to');
        if ($df && $dt) {
            $request->merge(['date_from' => $df, 'date_to' => $dt]);
            $request->validate([
                'date_from' => ['required', 'date'],
                'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            ]);
        }

        $from = $df ?: now()->startOfMonth()->toDateString();
        $to = $dt ?: now()->toDateString();

        return [$from, $to];
    }

    public function dashboard(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        [$from, $to] = $this->parsePeriod($request);

        return ApiResponse::success(
            $this->reportService->dashboard($brandId, $from, $to),
            'Dashboard report retrieved successfully.'
        );
    }

    public function commercial(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        [$from, $to] = $this->parsePeriod($request);

        return ApiResponse::success(
            $this->reportService->commercial($brandId, $from, $to),
            'Commercial report retrieved successfully.'
        );
    }

    public function ads(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        [$from, $to] = $this->parsePeriod($request);
        $platform = $request->query('platform');
        $campaignId = $request->query('campaign_id');
        $mediaBuyerId = $request->query('media_buyer_id');

        return ApiResponse::success(
            $this->reportService->ads(
                $brandId,
                $from,
                $to,
                is_string($platform) && $platform !== '' ? $platform : null,
                $campaignId !== null && $campaignId !== '' ? (int) $campaignId : null,
                $mediaBuyerId !== null && $mediaBuyerId !== '' ? (int) $mediaBuyerId : null,
            ),
            'Ads report retrieved successfully.'
        );
    }

    public function stock(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        [$from, $to] = $this->parsePeriod($request);

        return ApiResponse::success(
            $this->reportService->stock($brandId, $from, $to),
            'Stock report retrieved successfully.'
        );
    }

    public function delivery(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        [$from, $to] = $this->parsePeriod($request);

        return ApiResponse::success(
            $this->reportService->delivery($brandId, $from, $to),
            'Delivery report retrieved successfully.'
        );
    }

    public function finance(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        [$from, $to] = $this->parsePeriod($request);

        return ApiResponse::success(
            $this->reportService->finance($brandId, $from, $to),
            'Finance report retrieved successfully.'
        );
    }
}
