<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ProcurementDashboardService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementDashboardController extends Controller
{
    public function __construct(
        protected ProcurementDashboardService $procurementDashboard
    ) {}

    public function summary(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        return ApiResponse::success(
            $this->procurementDashboard->summary($brandId, $from ? (string) $from : null, $to ? (string) $to : null),
            'Procurement KPIs retrieved successfully.'
        );
    }
}
