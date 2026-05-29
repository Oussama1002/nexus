<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreChargeRequest;
use App\Http\Requests\Api\UpdateChargeRequest;
use App\Models\Charge;
use App\Services\AuditService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ChargeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->requirePermission($request, 'finance.view');
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $brandId = $request->query('brand_id');
        $type = $request->query('charge_type') ?? $request->query('type');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $search = $request->query('search');

        $q = Charge::query()->with(['brand', 'creator'])->orderByDesc('charge_date');
        if ($brandId !== null && $brandId !== '') {
            $q->where('brand_id', (int) $brandId);
        }
        if ($type) {
            $q->where('type', $type);
        }
        if ($from) {
            $q->whereDate('charge_date', '>=', $from);
        }
        if ($to) {
            $q->whereDate('charge_date', '<=', $to);
        }
        if ($search) {
            $s = '%'.$search.'%';
            $q->where(function ($qq) use ($s) {
                $qq->where('note', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Charges retrieved successfully.');
    }

    public function store(StoreChargeRequest $request): JsonResponse
    {
        $this->requirePermission($request, 'finance.create');
        $data = $request->validated();
        $data['created_by'] = $request->user()?->id;

        $row = Charge::query()->create($data);

        AuditService::log($request, 'charges.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['brand', 'creator']), 'Charge created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'finance.view');
        $row = Charge::query()->with(['brand', 'creator'])->findOrFail($id);

        return ApiResponse::success($row, 'Charge retrieved successfully.');
    }

    public function update(UpdateChargeRequest $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'finance.update');
        $row = Charge::query()->findOrFail($id);
        $before = $row->toArray();
        $row->fill($request->validated());
        $row->save();

        AuditService::log($request, 'charges.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['brand', 'creator']), 'Charge updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->requirePermission($request, 'finance.delete');
        $row = Charge::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditService::log($request, 'charges.delete', null, $before, null);

        return ApiResponse::success(null, 'Charge deleted successfully.');
    }

    private function requirePermission(Request $request, string $slug): void
    {
        if (! $request->user()?->hasPermissionSlug($slug)) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
