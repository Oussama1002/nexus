<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCustomerRequest;
use App\Http\Requests\Api\UpdateCustomerRequest;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Order;
use App\Services\AuditLogger;
use App\Services\PhoneNormalizer;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');
        $statusFilter = $request->query('status');

        $q = Customer::query()
            ->with(['assignedUser:id,name', 'latestConversation.assignedUser:id,name'])
            ->where('brand_id', $brandId)
            ->orderByDesc('id');

        // Filter by status: 'archived' shows only inactive, 'all' shows everything, default hides archived
        if ($statusFilter === 'archived') {
            $q->where('status', 'inactive');
        } elseif ($statusFilter && $statusFilter !== 'all') {
            $q->where('status', $statusFilter);
        } elseif (! $statusFilter || $statusFilter === '') {
            $q->where('status', '!=', 'inactive');
        }

        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('full_name', 'like', $s)->orWhere('phone', 'like', $s)->orWhere('email', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Customers retrieved successfully.');
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $originLeadId = Arr::pull($data, 'origin_lead_id');

        $data['lifecycle_status'] = $data['lifecycle_status'] ?? 'new';

        if (PhoneNormalizer::existsForBrand($brandId, $data['phone'])) {
            return ApiResponse::error('Ce numéro de téléphone existe déjà pour cette marque.', ['phone' => ['Numéro en double.']], 422);
        }

        if ($originLeadId !== null) {
            $lead = Lead::query()->where('brand_id', $brandId)->whereKey($originLeadId)->first();
            if (! $lead) {
                return ApiResponse::error('Lead introuvable pour cette marque.', ['origin_lead_id' => ['Invalide.']], 422);
            }
            if ($lead->customer_id !== null) {
                return ApiResponse::error('Ce lead est déjà lié à un client.', ['origin_lead_id' => ['Déjà converti.']], 422);
            }
        }

        $customer = Customer::query()->create(array_merge($data, [
            'brand_id' => $brandId,
            'origin_lead_id' => $originLeadId,
            'status' => $data['status'] ?? 'active',
        ]));

        if ($originLeadId !== null) {
            Lead::query()->whereKey($originLeadId)->update(['customer_id' => $customer->id]);
        }

        AuditLogger::log($request, 'customers.create', $customer, null, $customer->toArray());

        return ApiResponse::success($customer->fresh(['assignedUser', 'originLead']), 'Customer created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $customer = Customer::query()
            ->with([
                'brand:id,name',
                'assignedUser:id,name,email',
                'originLead:id,source,status,notes,estimated_value,product_interest,interest_level',
            ])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $ordersQuery = Order::query()->where('customer_id', $customer->id);
        $ordersCount = (clone $ordersQuery)->count();
        $totalSpent = (clone $ordersQuery)->whereNotIn('status', ['cancelled', 'draft'])->sum('total');
        $lastOrder = (clone $ordersQuery)->orderByDesc('created_at')->first();

        $returnsCount = (clone $ordersQuery)->where('status', 'returned')->count();
        $cancelCount = (clone $ordersQuery)->where('status', 'cancelled')->count();

        $lastContactAt = Conversation::query()->where('customer_id', $customer->id)->max('updated_at');

        $score = $customer->risk_score;
        if ($score === null) {
            $score = max(0, min(100, 100 - ($returnsCount * 12) - ($cancelCount * 6)));
        }

        return ApiResponse::success([
            'customer' => $customer,
            'crm_stats' => [
                'orders_count' => $ordersCount,
                'total_spent' => round((float) $totalSpent, 2),
                'last_order_at' => $lastOrder?->created_at,
                'last_contact_at' => $lastContactAt,
                'returns_count' => $returnsCount,
                'cancellations_count' => $cancelCount,
                'complaints_count' => 0,
                'customer_score' => $score,
            ],
        ], 'Customer retrieved successfully.');
    }

    public function update(UpdateCustomerRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $customer = Customer::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $customer->toArray();

        $data = $request->validated();
        if (isset($data['phone']) && Customer::query()->where('brand_id', $brandId)->where('phone', $data['phone'])->where('id', '!=', $customer->id)->exists()) {
            return ApiResponse::error('This phone is already registered for the brand.', ['phone' => ['Duplicate phone.']], 422);
        }

        $customer->fill($data);
        $customer->save();

        AuditLogger::log($request, 'customers.update', $customer, $before, $customer->fresh()->toArray());

        return ApiResponse::success($customer->fresh(['assignedUser', 'originLead']), 'Customer updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $customer = Customer::query()->where('brand_id', $brandId)->findOrFail($id);

        if (Order::query()->where('customer_id', $customer->id)->exists()) {
            return ApiResponse::error('Cannot delete customer with orders.', null, 422);
        }

        $before = $customer->toArray();
        $customer->delete();
        AuditLogger::log($request, 'customers.delete', null, $before, null);

        return ApiResponse::success(null, 'Customer deleted successfully.');
    }
}
