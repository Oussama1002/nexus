<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreEmployeeRequest;
use App\Http\Requests\Api\UpdateEmployeeRequest;
use App\Models\Employee;
use App\Models\HrLookupValue;
use App\Services\AuditService;
use App\Services\HrLookupService;
use App\Support\ApiResponse;
use App\Support\SalaryVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class EmployeeController extends Controller
{
    public function __construct(
        protected HrLookupService $hrLookups,
    ) {}

    public function lookups(Request $request, string $type): JsonResponse
    {
        $this->requirePermission($request, 'hr.view');
        if (! in_array($type, [HrLookupValue::TYPE_DEPARTMENT, HrLookupValue::TYPE_ROLE_TITLE], true)) {
            return ApiResponse::error('Type de liste invalide.', null, 422);
        }

        $brandId = $request->query('brand_id');
        $brandId = $brandId !== null && $brandId !== '' ? (int) $brandId : null;

        return ApiResponse::success([
            'values' => $this->hrLookups->values($type, $brandId),
        ], 'HR lookup values retrieved successfully.');
    }

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'hr.view');
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $department = $request->query('department');
        $search = $request->query('search');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = Employee::query()->with(['user', 'brand'])->orderByDesc('id');
        if ($status) {
            $q->where('status', $status);
        }
        if ($department) {
            $q->where('department', 'like', '%'.$department.'%');
        }
        if ($search) {
            $s = '%'.$search.'%';
            $q->where(function ($qq) use ($s) {
                $qq->where('full_name', 'like', $s)->orWhere('employee_code', 'like', $s)->orWhere('phone', 'like', $s);
            });
        }
        if ($from) {
            $q->whereDate('joined_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('joined_at', '<=', $to);
        }
        if ($request->boolean('without_user')) {
            $q->whereNull('user_id');
        }

        $paginator = $q->paginate($perPage);
        $mask = ! SalaryVisibility::canViewSalary($request);
        $paginator->getCollection()->transform(function (Employee $e) use ($mask) {
            $a = $e->toArray();
            if ($mask) {
                unset($a['salary']);
                $a['salary_hidden'] = true;
            }

            return $a;
        });

        return ApiResponse::success($paginator, 'Employees retrieved successfully.');
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $this->requirePermission($request, 'hr.create');
        $data = $request->validated();
        $data['status'] = $data['status'] ?? 'active';
        if (empty($data['employee_code'])) {
            $data['employee_code'] = 'EMP-'.strtoupper(bin2hex(random_bytes(3)));
        }

        $row = Employee::query()->create($data);

        $this->hrLookups->remember($row->brand_id, HrLookupValue::TYPE_DEPARTMENT, $row->department);
        $this->hrLookups->remember($row->brand_id, HrLookupValue::TYPE_ROLE_TITLE, $row->role_title);

        AuditService::log($request, 'employees.create', $row, null, $row->toArray());

        return ApiResponse::success($this->transformEmployee($request, $row->fresh()), 'Employee created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'hr.view');
        $row = Employee::query()->with(['user', 'brand'])->findOrFail($id);

        return ApiResponse::success($this->transformEmployee($request, $row), 'Employee retrieved successfully.');
    }

    public function update(UpdateEmployeeRequest $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'hr.update');
        $row = Employee::query()->findOrFail($id);
        $before = $row->toArray();
        $data = $request->validated();
        $row->fill($data);
        $row->save();

        $fresh = $row->fresh();
        $this->hrLookups->remember($fresh->brand_id, HrLookupValue::TYPE_DEPARTMENT, $fresh->department);
        $this->hrLookups->remember($fresh->brand_id, HrLookupValue::TYPE_ROLE_TITLE, $fresh->role_title);

        AuditService::log($request, 'employees.update', $row, $before, $fresh->toArray());

        return ApiResponse::success($this->transformEmployee($request, $row->fresh()), 'Employee updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'hr.delete');
        $row = Employee::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditService::log($request, 'employees.delete', null, $before, null);

        return ApiResponse::success(null, 'Employee deleted successfully.');
    }

    private function transformEmployee(Request $request, Employee $e): array
    {
        $a = $e->load(['user', 'brand'])->toArray();
        if (! SalaryVisibility::canViewSalary($request)) {
            unset($a['salary']);
            $a['salary_hidden'] = true;
        }

        return $a;
    }

    private function requirePermission(Request $request, string $slug): void
    {
        if (! $request->user()?->hasPermissionSlug($slug)) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
