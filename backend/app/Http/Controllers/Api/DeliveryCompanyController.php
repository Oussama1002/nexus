<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreDeliveryCompanyRequest;
use App\Http\Requests\Api\UpdateDeliveryCompanyRequest;
use App\Models\DeliveryCompany;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryCompanyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');
        $status = $request->query('status');

        $q = DeliveryCompany::query()->orderBy('name');
        if ($status) {
            $q->where('status', $status);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)->orWhere('contact_name', 'like', $s)->orWhere('phone', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Delivery companies retrieved successfully.');
    }

    public function store(StoreDeliveryCompanyRequest $request): JsonResponse
    {
        $company = DeliveryCompany::query()->create($request->validated());

        AuditLogger::log($request, 'delivery_companies.create', $company, null, $company->toArray());

        return ApiResponse::success($company->fresh(), 'Delivery company created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $company = DeliveryCompany::query()->findOrFail($id);

        return ApiResponse::success($company, 'Delivery company retrieved successfully.');
    }

    public function update(UpdateDeliveryCompanyRequest $request, string $id): JsonResponse
    {
        $company = DeliveryCompany::query()->findOrFail($id);
        $before = $company->toArray();
        $company->fill($request->validated());
        $company->save();

        AuditLogger::log($request, 'delivery_companies.update', $company, $before, $company->fresh()->toArray());

        return ApiResponse::success($company->fresh(), 'Delivery company updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $company = DeliveryCompany::query()->findOrFail($id);

        if ($company->shipments()->exists()) {
            return ApiResponse::error('Cannot delete delivery company referenced by shipments.', null, 422);
        }

        $before = $company->toArray();
        $company->delete();

        AuditLogger::log($request, 'delivery_companies.delete', null, $before, null);

        return ApiResponse::success(null, 'Delivery company deleted successfully.');
    }
}
