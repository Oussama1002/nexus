<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrPayrollBulletin;
use App\Models\HrPayrollPeriod;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\SalaryVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrPayrollBulletinController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        if (! SalaryVisibility::canViewSalary($request)) {
            return ApiResponse::error('Accès refusé aux données de paie.', null, 403);
        }

        $q = HrPayrollBulletin::query()
            ->with(['employee:id,full_name,employee_code,department', 'payrollPeriod:id,year,month,status', 'validatedBy:id,name'])
            ->orderByDesc('id');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        if ($periodId = $request->query('payroll_period_id')) {
            $q->where('payroll_period_id', (int) $periodId);
        }
        if ($employeeId = $request->query('employee_id')) {
            $q->where('employee_id', (int) $employeeId);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'payroll_period_id' => ['required', 'integer', 'exists:hr_payroll_periods,id'],
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'base_salary' => ['required', 'numeric', 'min:0'],
            'days_worked' => ['nullable', 'integer', 'min:0'],
            'days_absent_unjustified' => ['nullable', 'integer', 'min:0'],
            'days_absent_justified' => ['nullable', 'integer', 'min:0'],
            'days_leave' => ['nullable', 'integer', 'min:0'],
            'overtime_hours' => ['nullable', 'numeric', 'min:0'],
            'overtime_amount' => ['nullable', 'numeric', 'min:0'],
            'primes' => ['nullable', 'numeric', 'min:0'],
            'indemnites' => ['nullable', 'numeric', 'min:0'],
            'retenues' => ['nullable', 'numeric', 'min:0'],
            'absence_deduction' => ['nullable', 'numeric', 'min:0'],
            'cnss_employee' => ['nullable', 'numeric', 'min:0'],
            'ir' => ['nullable', 'numeric', 'min:0'],
            'net_salary' => ['required', 'numeric', 'min:0'],
            'details_json' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
        ]);

        $period = HrPayrollPeriod::query()->findOrFail($data['payroll_period_id']);
        if ($period->status !== 'ouvert') {
            return ApiResponse::error('La période de paie n\'est pas ouverte.', null, 422);
        }

        $data['brand_id'] = $brandId;
        $data['status'] = 'brouillon';

        $row = HrPayrollBulletin::query()->create($data);

        AuditLogger::log($request, 'hr_payroll_bulletins.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('employee:id,full_name'), 'Bulletin créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        if (! SalaryVisibility::canViewSalary($request)) {
            return ApiResponse::error('Accès refusé.', null, 403);
        }

        $row = HrPayrollBulletin::query()
            ->with(['employee:id,full_name,employee_code,department', 'payrollPeriod:id,year,month', 'validatedBy:id,name'])
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = HrPayrollBulletin::query()->findOrFail($id);

        if ($row->status === 'valide') {
            return ApiResponse::error('Un bulletin validé ne peut pas être modifié.', null, 422);
        }

        $before = $row->toArray();

        $data = $request->validate([
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'days_worked' => ['nullable', 'integer', 'min:0'],
            'days_absent_unjustified' => ['nullable', 'integer', 'min:0'],
            'days_absent_justified' => ['nullable', 'integer', 'min:0'],
            'days_leave' => ['nullable', 'integer', 'min:0'],
            'overtime_hours' => ['nullable', 'numeric', 'min:0'],
            'overtime_amount' => ['nullable', 'numeric', 'min:0'],
            'primes' => ['nullable', 'numeric', 'min:0'],
            'indemnites' => ['nullable', 'numeric', 'min:0'],
            'retenues' => ['nullable', 'numeric', 'min:0'],
            'absence_deduction' => ['nullable', 'numeric', 'min:0'],
            'cnss_employee' => ['nullable', 'numeric', 'min:0'],
            'ir' => ['nullable', 'numeric', 'min:0'],
            'net_salary' => ['nullable', 'numeric', 'min:0'],
            'details_json' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'hr_payroll_bulletins.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Bulletin mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = HrPayrollBulletin::query()->findOrFail($id);

        if ($row->status === 'valide') {
            return ApiResponse::error('Un bulletin validé ne peut pas être supprimé.', null, 422);
        }

        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'hr_payroll_bulletins.delete', null, $before, null);

        return ApiResponse::success(null, 'Bulletin supprimé.');
    }

    public function validate_(Request $request, string $id): JsonResponse
    {
        $row = HrPayrollBulletin::query()->findOrFail($id);

        if ($row->status === 'valide') {
            return ApiResponse::error('Bulletin déjà validé.', null, 422);
        }

        $before = $row->toArray();

        $row->status = 'valide';
        $row->validated_by_user_id = $request->user()->id;
        $row->validated_at = now();
        $row->save();

        AuditLogger::log($request, 'hr_payroll_bulletins.validate', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Bulletin validé.');
    }
}
