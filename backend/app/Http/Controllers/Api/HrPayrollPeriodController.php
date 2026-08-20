<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrPayrollPeriod;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrPayrollPeriodController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = HrPayrollPeriod::query()
            ->with(['validatedBy:id,name'])
            ->withCount('bulletins')
            ->orderByDesc('year')
            ->orderByDesc('month');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($year = $request->query('year')) {
            $q->where('year', (int) $year);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2099'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
        ]);

        $exists = HrPayrollPeriod::query()
            ->where('brand_id', $brandId)
            ->where('year', $data['year'])
            ->where('month', $data['month'])
            ->exists();

        if ($exists) {
            return ApiResponse::error('Cette période existe déjà.', null, 422);
        }

        $data['brand_id'] = $brandId;
        $data['status'] = 'ouvert';

        $row = HrPayrollPeriod::query()->create($data);

        AuditLogger::log($request, 'hr_payroll_periods.create', $row, null, $row->toArray());

        return ApiResponse::success($row, 'Période de paie créée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = HrPayrollPeriod::query()
            ->with(['validatedBy:id,name', 'bulletins.employee:id,full_name,employee_code'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function validate_(Request $request, string $id): JsonResponse
    {
        $row = HrPayrollPeriod::query()->findOrFail($id);

        if ($row->status !== 'ouvert') {
            return ApiResponse::error('Seules les périodes ouvertes peuvent être validées.', null, 422);
        }

        $before = $row->toArray();

        $row->status = 'valide';
        $row->validated_by_user_id = $request->user()->id;
        $row->validated_at = now();
        $row->save();

        AuditLogger::log($request, 'hr_payroll_periods.validate', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Période validée.');
    }

    public function close(Request $request, string $id): JsonResponse
    {
        $row = HrPayrollPeriod::query()->findOrFail($id);

        if ($row->status !== 'valide') {
            return ApiResponse::error('Seules les périodes validées peuvent être clôturées.', null, 422);
        }

        $before = $row->toArray();

        $row->status = 'cloture';
        $row->save();

        AuditLogger::log($request, 'hr_payroll_periods.close', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Période clôturée.');
    }
}
