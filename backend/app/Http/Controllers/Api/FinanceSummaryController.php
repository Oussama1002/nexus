<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FinanceSummaryService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class FinanceSummaryController extends Controller
{
    public function __construct(
        protected FinanceSummaryService $financeSummaryService
    ) {}

    public function summary(Request $request): JsonResponse
    {
        $this->requireFinanceView($request);
        $brandId = $request->query('brand_id') ? (int) $request->query('brand_id') : null;
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        return ApiResponse::success(
            $this->financeSummaryService->summary($brandId, $from, $to),
            'Finance summary retrieved successfully.'
        );
    }

    public function chargesByType(Request $request): JsonResponse
    {
        $this->requireFinanceView($request);
        $brandId = $request->query('brand_id') ? (int) $request->query('brand_id') : null;
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        return ApiResponse::success(
            $this->financeSummaryService->chargesByType($brandId, $from, $to),
            'Charges by type retrieved successfully.'
        );
    }

    public function monthly(Request $request): JsonResponse
    {
        $this->requireFinanceView($request);
        $brandId = $request->query('brand_id') ? (int) $request->query('brand_id') : null;
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        return ApiResponse::success(
            ['series' => $this->financeSummaryService->monthly($brandId, $from, $to)],
            'Monthly charges retrieved successfully.'
        );
    }

    private function requireFinanceView(Request $request): void
    {
        if (! $request->user()?->hasPermissionSlug('finance.view')) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
