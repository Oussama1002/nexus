<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\InfluenceDashboardService;
use App\Services\SocialDashboardService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SocialInfluenceDashboardController extends Controller
{
    public function __construct(
        protected SocialDashboardService $socialDashboard,
        protected InfluenceDashboardService $influenceDashboard
    ) {}

    public function social(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $platform = $request->query('platform');
        $assignedUserId = $request->query('assigned_user_id');
        $cmId = $assignedUserId !== null && $assignedUserId !== '' ? (int) $assignedUserId : null;

        return ApiResponse::success(
            $this->socialDashboard->summary($brandId, $from, $to, $platform ? (string) $platform : null, $cmId),
            'Social dashboard data retrieved successfully.'
        );
    }

    public function influence(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        return ApiResponse::success(
            $this->influenceDashboard->summary($brandId, $from, $to),
            'Influence dashboard data retrieved successfully.'
        );
    }
}
