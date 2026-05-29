<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreClientContractRequest;
use App\Http\Requests\Api\UpdateClientContractRequest;
use App\Models\ClientContract;
use App\Services\AuditService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ClientContractController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.view');
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $brandId = $request->query('brand_id');
        $status = $request->query('status');
        $customerId = $request->query('customer_id');
        $search = $request->query('search');

        $q = ClientContract::query()
            ->with(['brand', 'customer', 'creator'])
            ->orderByDesc('id');

        if ($brandId !== null && $brandId !== '') {
            $q->where('brand_id', (int) $brandId);
        }
        if ($status) {
            $q->where('status', (string) $status);
        }
        if ($customerId !== null && $customerId !== '') {
            $q->where('customer_id', (int) $customerId);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($qq) use ($s): void {
                $qq->where('title', 'like', $s)
                    ->orWhere('contract_number', 'like', $s)
                    ->orWhereHas('customer', fn ($cq) => $cq->where('full_name', 'like', $s)->orWhere('email', 'like', $s));
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Client contracts retrieved successfully.');
    }

    public function store(StoreClientContractRequest $request): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.create');
        $data = $request->validated();
        $data['created_by'] = $request->user()?->id;

        $row = ClientContract::query()->create($data);
        AuditService::log($request, 'client_contracts.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['brand', 'customer', 'creator']), 'Client contract created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.view');
        $row = ClientContract::query()->with(['brand', 'customer', 'creator'])->findOrFail($id);

        return ApiResponse::success($row, 'Client contract retrieved successfully.');
    }

    public function update(UpdateClientContractRequest $request, string $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.update');
        $row = ClientContract::query()->findOrFail($id);
        $before = $row->toArray();
        $row->fill($request->validated());
        $row->save();

        AuditService::log($request, 'client_contracts.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['brand', 'customer', 'creator']), 'Client contract updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->requireFinancePermission($request, 'finance.delete');
        $row = ClientContract::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditService::log($request, 'client_contracts.delete', null, $before, null);

        return ApiResponse::success(null, 'Client contract deleted successfully.');
    }

    private function requireFinancePermission(Request $request, string $slug): void
    {
        if (! $request->user()?->hasPermissionSlug($slug)) {
            throw new AccessDeniedHttpException('Forbidden.');
        }
    }
}
