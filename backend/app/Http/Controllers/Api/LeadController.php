<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\AssignLeadRequest;
use App\Http\Requests\Api\ConvertLeadToOrderRequest;
use App\Http\Requests\Api\StoreLeadRequest;
use App\Http\Requests\Api\UpdateLeadRequest;
use App\Http\Requests\Api\UpdateLeadStatusRequest;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Order;
use App\Services\AuditLogger;
use App\Services\LeadService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class LeadController extends Controller
{
    public function __construct(
        protected LeadService $leadService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');
        $status = $request->query('status');
        $assigned = $request->query('assigned_user_id');

        $q = Lead::query()->with(['customer', 'assignedUser', 'conversation.assignedUser']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('id');

        $user = $request->user();
        if ($user && ! $user->isAdmin() && ! $user->isManagerOperational() && $user->shouldRestrictShipmentsToAssignedOrders()) {
            $q->where('assigned_user_id', $user->id);
        } elseif ($assigned !== null && $assigned !== '') {
            $q->where('assigned_user_id', (int) $assigned);
        }

        if ($request->boolean('without_customer')) {
            $q->whereNull('customer_id');
        }
        if ($status) {
            $q->where('status', $status);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('notes', 'like', $s)->orWhere('source', 'like', $s)
                    ->orWhereHas('customer', fn ($c) => $c->where('full_name', 'like', $s)->orWhere('phone', 'like', $s));
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Leads retrieved successfully.');
    }

    public function store(StoreLeadRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $nestedCustomer = $data['customer'] ?? null;
        unset($data['customer']);

        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'new';
        $data['assigned_user_id'] = $data['assigned_user_id'] ?? $request->user()->id;

        if (! empty($data['customer_id'])) {
            $this->assertCustomerInBrand((int) $data['customer_id'], $brandId);
        } elseif (is_array($nestedCustomer)) {
            $existing = Customer::query()
                ->where('brand_id', $brandId)
                ->where('phone', $nestedCustomer['phone'])
                ->first();

            if ($existing) {
                $customer = $existing;
            } else {
                $customer = Customer::query()->create([
                    'brand_id' => $brandId,
                    'full_name' => $nestedCustomer['full_name'],
                    'phone' => $nestedCustomer['phone'],
                    'city' => $nestedCustomer['city'],
                    'address' => $nestedCustomer['address'] ?? null,
                    'gender' => $nestedCustomer['gender'] ?? null,
                    'email' => $nestedCustomer['email'] ?? null,
                    'status' => 'active',
                ]);
            }
            $data['customer_id'] = $customer->id;
        } else {
            return ApiResponse::error('Informations client requises.', ['customer' => ['Fournissez un client existant ou les champs du nouveau contact.']], 422);
        }

        $lead = DB::transaction(function () use ($data) {
            return Lead::query()->create(Arr::only($data, [
                'brand_id',
                'customer_id',
                'assigned_user_id',
                'source',
                'status',
                'estimated_value',
                'product_interest',
                'interest_level',
                'notes',
            ]));
        });

        $this->leadService->recordEvent($lead, 'created', $request->user(), 'Lead created.');

        AuditLogger::log($request, 'leads.create', $lead, null, $lead->toArray());

        return ApiResponse::success($lead->fresh(['customer', 'assignedUser']), 'Lead created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lead = Lead::query()->with(['customer', 'assignedUser', 'events.actor'])->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($lead, 'Lead retrieved successfully.');
    }

    public function update(UpdateLeadRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lead = Lead::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $lead->toArray();
        $data = $request->validated();

        if (array_key_exists('customer_id', $data) && $data['customer_id']) {
            $this->assertCustomerInBrand((int) $data['customer_id'], $brandId);
        }

        $newStatus = $data['status'] ?? null;
        if ($newStatus !== null && $newStatus !== $lead->status) {
            $lead->fill(Arr::except($data, ['status']));
            $lead->status = $newStatus;
            if ($newStatus === 'contacted' && ! $lead->first_contact_at) {
                $lead->first_contact_at = now();
            }
            if (in_array($newStatus, ['lost', 'archived', 'confirmed'], true)) {
                $lead->closed_at = now();
            }
            $lead->save();
            $this->leadService->recordEvent($lead, 'status_changed', $request->user(), 'Status updated.', [
                'from' => $before['status'] ?? null,
                'to' => $newStatus,
            ]);
        } else {
            $lead->fill(Arr::except($data, ['status']));
            $lead->save();
        }

        AuditLogger::log($request, 'leads.update', $lead, $before, $lead->fresh()->toArray());

        return ApiResponse::success($lead->fresh(['customer', 'assignedUser']), 'Lead updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lead = Lead::query()->where('brand_id', $brandId)->findOrFail($id);

        if (Order::query()->where('lead_id', $lead->id)->exists()) {
            return ApiResponse::error('Cannot delete lead linked to an order.', null, 422);
        }

        $before = $lead->toArray();
        $lead->delete();
        AuditLogger::log($request, 'leads.delete', null, $before, null);

        return ApiResponse::success(null, 'Lead deleted successfully.');
    }

    public function assign(AssignLeadRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lead = Lead::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $lead->toArray();
        $lead->assigned_user_id = $request->validated()['assigned_user_id'] ?? null;
        $lead->save();

        $this->leadService->recordEvent($lead, 'assigned', $request->user(), 'Lead assignment updated.', [
            'assigned_user_id' => $lead->assigned_user_id,
        ]);
        AuditLogger::log($request, 'leads.assign', $lead, $before, $lead->fresh()->toArray());

        return ApiResponse::success($lead->fresh(['assignedUser']), 'Lead assignment updated.');
    }

    public function updateStatus(UpdateLeadStatusRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lead = Lead::query()->where('brand_id', $brandId)->findOrFail($id);
        $from = $lead->status;
        $to = $request->validated()['status'];
        $lead->status = $to;
        if ($to === 'contacted' && ! $lead->first_contact_at) {
            $lead->first_contact_at = now();
        }
        if (in_array($to, ['lost', 'archived', 'confirmed'], true)) {
            $lead->closed_at = now();
        }
        $lead->save();

        $this->leadService->recordEvent($lead, 'status_changed', $request->user(), 'Status changed.', ['from' => $from, 'to' => $to]);
        AuditLogger::log($request, 'leads.status', $lead, ['status' => $from], ['status' => $to]);

        return ApiResponse::success($lead->fresh(), 'Lead status updated.');
    }

    public function convertToOrder(ConvertLeadToOrderRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $lead = Lead::query()->where('brand_id', $brandId)->findOrFail($id);

        try {
            $order = $this->leadService->convertToOrder($lead, $request->validated(), $request->user());
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'leads.convert_to_order', $order, null, $order->toArray());

        return ApiResponse::success($order->load(['lines']), 'Lead converted to order successfully.', 201);
    }

    protected function assertCustomerInBrand(int $customerId, int $brandId): void
    {
        if (! Customer::query()->where('id', $customerId)->where('brand_id', $brandId)->exists()) {
            abort(422, 'Customer does not belong to this brand.');
        }
    }
}
