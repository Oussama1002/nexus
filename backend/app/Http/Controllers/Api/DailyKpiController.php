<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyKpi;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DailyKpiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = DailyKpi::query()->where('brand_id', $brandId)->orderByDesc('kpi_date');
        if ($from) {
            $q->whereDate('kpi_date', '>=', $from);
        }
        if ($to) {
            $q->whereDate('kpi_date', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage), 'Daily KPIs retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'kpi_date' => ['required', 'date'],
            'leads_count' => ['nullable', 'integer', 'min:0'],
            'messages_count' => ['nullable', 'integer', 'min:0'],
            'orders_confirmed' => ['nullable', 'integer', 'min:0'],
            'orders_delivered' => ['nullable', 'integer', 'min:0'],
        ]);
        $data['brand_id'] = $brandId;

        $row = DailyKpi::query()->updateOrCreate(
            ['brand_id' => $brandId, 'kpi_date' => $data['kpi_date']],
            $data
        );

        AuditLogger::log($request, 'daily_kpis.upsert', $row, null, $row->toArray());

        return ApiResponse::success($row, 'Daily KPI saved successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = DailyKpi::query()->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($row, 'Daily KPI retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = DailyKpi::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $data = $request->validate([
            'leads_count' => ['nullable', 'integer', 'min:0'],
            'messages_count' => ['nullable', 'integer', 'min:0'],
            'orders_confirmed' => ['nullable', 'integer', 'min:0'],
            'orders_delivered' => ['nullable', 'integer', 'min:0'],
            'revenue' => ['nullable', 'numeric'],
            'ad_spend' => ['nullable', 'numeric'],
        ]);
        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'daily_kpis.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Daily KPI updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = DailyKpi::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'daily_kpis.delete', null, $before, null);

        return ApiResponse::success(null, 'Daily KPI deleted successfully.');
    }
}
