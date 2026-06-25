<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreOrderRequest;
use App\Http\Requests\Api\UpdateOrderRequest;
use App\Http\Requests\Api\UpdateOrderStatusRequest;
use App\Models\Customer;
use App\Models\Lead;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Charge;
use App\Models\Product;
use App\Services\AuditLogger;
use App\Services\AutomationEngineService;
use App\Services\ClientInvoiceService;
use App\Services\OrderStateService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OrderController extends Controller
{
    public function __construct(
        protected OrderStateService $orderStateService,
        protected AutomationEngineService $automationEngine,
        protected ClientInvoiceService $clientInvoices,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');
        $status = $request->query('status');

        $assigned = $request->query('assigned_user_id');

        $q = Order::query()->with(['customer', 'lines'])->where('brand_id', $brandId)->orderByDesc('id');

        $user = $request->user();
        if ($user && ! $user->isAdmin() && ! $user->isManagerOperational() && $user->shouldRestrictShipmentsToAssignedOrders()) {
            $q->where('assigned_user_id', $user->id);
        } elseif ($assigned !== null && $assigned !== '') {
            $q->where('assigned_user_id', (int) $assigned);
        }

        if ($status) {
            $q->where('status', $status);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('order_number', 'like', $s)
                    ->orWhereHas('customer', fn ($c) => $c->where('full_name', 'like', $s)->orWhere('phone', 'like', $s));
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Orders retrieved successfully.');
    }

    public function store(StoreOrderRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        try {
            $order = DB::transaction(function () use ($request, $brandId, $data) {
                if (! empty($data['customer_id'])) {
                    $this->assertCustomerBrand((int) $data['customer_id'], $brandId);
                }
                if (! empty($data['lead_id'])) {
                    $this->assertLeadBrand((int) $data['lead_id'], $brandId);
                }
                $this->assertNoDuplicateActiveOrder($brandId, $data);
                $transfer = $this->resolveBankTransferFields($data);

                $order = Order::query()->create([
                    'brand_id' => $brandId,
                    'customer_id' => $data['customer_id'] ?? null,
                    'lead_id' => $data['lead_id'] ?? null,
                    'assigned_user_id' => $data['assigned_user_id'] ?? $request->user()->id,
                    'order_number' => Order::generateUniqueOrderNumber(),
                    'source' => $data['source'] ?? null,
                    'status' => $data['status'] ?? 'pending',
                    'payment_method' => $data['payment_method'] ?? 'prepaid',
                    'payment_state' => $transfer['payment_state'] ?? ($data['payment_state'] ?? 'unpaid'),
                    'bank_transfer_declared_paid' => $transfer['bank_transfer_declared_paid'],
                    'bank_transfer_reference' => $transfer['bank_transfer_reference'],
                    'bank_transfer_declared_at' => $transfer['bank_transfer_declared_at'],
                    'bank_transfer_verified_at' => $transfer['bank_transfer_verified_at'],
                    'bank_transfer_verification_status' => $transfer['bank_transfer_verification_status'],
                    'bank_transfer_verification_note' => $transfer['bank_transfer_verification_note'],
                    'subtotal' => 0,
                    'shipping_fee' => (float) ($data['shipping_fee'] ?? 0),
                    'discount' => (float) ($data['discount'] ?? 0),
                    'total' => 0,
                    'shipping_address' => $data['shipping_address'] ?? null,
                    'notes' => $data['notes'] ?? null,
                ]);

                $this->syncLines($order, $data['lines'], $brandId);
                $this->orderStateService->recalculateTotals($order->fresh(['lines']));

                return $order->fresh(['lines', 'customer']);
            });
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'orders.create', $order, null, $order->toArray());

        $invoice = $this->clientInvoices->createFromOrder($order, $request->user()?->id);

        $payload = $order->toArray();
        if ($invoice) {
            $payload['client_invoice'] = $invoice->only(['id', 'invoice_number', 'status', 'total']);
        }

        return ApiResponse::success($payload, 'Order created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $order = Order::query()->with(['lines.product', 'customer', 'events.actor'])->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($order, 'Order retrieved successfully.');
    }

    public function update(UpdateOrderRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $order = Order::query()->where('brand_id', $brandId)->findOrFail($id);

        if (in_array($order->status, ['confirmed', 'delivered', 'cancelled'], true)) {
            return ApiResponse::error('Cannot modify order in this status.', null, 422);
        }

        $before = $order->toArray();
        $previousPaymentState = $order->payment_state;
        $data = $request->validated();

        if (array_key_exists('customer_id', $data) && $data['customer_id']) {
            $this->assertCustomerBrand((int) $data['customer_id'], $brandId);
        }
        if (array_key_exists('lead_id', $data) && $data['lead_id']) {
            $this->assertLeadBrand((int) $data['lead_id'], $brandId);
        }
        $transfer = $this->resolveBankTransferFields(array_merge($order->toArray(), $data));

        $order->fill(collect($data)->only([
            'customer_id', 'lead_id', 'assigned_user_id', 'source', 'payment_method', 'payment_state',
            'shipping_fee', 'discount', 'shipping_address', 'notes',
        ])->all());
        $order->payment_state = $transfer['payment_state'] ?? $order->payment_state;
        $order->bank_transfer_declared_paid = $transfer['bank_transfer_declared_paid'];
        $order->bank_transfer_reference = $transfer['bank_transfer_reference'];
        $order->bank_transfer_declared_at = $transfer['bank_transfer_declared_at'];
        $order->bank_transfer_verified_at = $transfer['bank_transfer_verified_at'];
        $order->bank_transfer_verification_status = $transfer['bank_transfer_verification_status'];
        $order->bank_transfer_verification_note = $transfer['bank_transfer_verification_note'];

        if (array_key_exists('lines', $data)) {
            $order->lines()->delete();
            $this->syncLines($order, $data['lines'], $brandId);
        }

        $order->save();
        $this->orderStateService->recalculateTotals($order->fresh(['lines']));

        $this->createDeliveryChargeIfPaid($order->fresh(), $previousPaymentState, $request->user());

        AuditLogger::log($request, 'orders.update', $order, $before, $order->fresh()->toArray());

        return ApiResponse::success($order->fresh(['lines', 'customer']), 'Order updated successfully.');
    }

    public function updateStatus(UpdateOrderStatusRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $order = Order::query()->where('brand_id', $brandId)->findOrFail($id);
        $from = $order->status;
        $previousPaymentState = $order->payment_state;
        $to = $request->validated()['status'];
        $note = $request->validated()['note'] ?? null;
        $cancellationReason = $request->validated()['cancellation_reason'] ?? null;

        if ($order->status === 'delivered' && $to === 'cancelled') {
            return ApiResponse::error('Cannot cancel a delivered order.', null, 422);
        }

        if ($to === 'cancelled' && $cancellationReason) {
            $order->cancellation_reason = $cancellationReason;
            $order->save();
        }

        try {
            $order = $this->orderStateService->updateStatus($order, $to, $request->user(), $note);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        $this->createDeliveryChargeIfPaid($order->fresh(), $previousPaymentState, $request->user());

        AuditLogger::log($request, 'orders.status', $order, null, ['status' => $to]);
        $this->automationEngine->runForEvent($brandId, 'order.status_changed', [
            'order_id' => $order->id,
            'from_status' => $from,
            'to_status' => $to,
            'customer_id' => $order->customer_id,
            'lead_id' => $order->lead_id,
            'total' => (float) $order->total,
            'order_number' => $order->order_number,
        ]);

        return ApiResponse::success($order->load(['lines', 'events']), 'Order status updated.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $order = Order::query()->where('brand_id', $brandId)->findOrFail($id);

        if (! in_array($order->status, ['draft', 'pending', 'cancelled'], true)) {
            return ApiResponse::error('Seules les commandes brouillon, en attente ou annulées peuvent être supprimées.', null, 422);
        }

        $before = $order->toArray();
        $order->lines()->delete();
        $order->events()->delete();
        $order->delete();

        AuditLogger::log($request, 'orders.delete', null, $before, null);

        return ApiResponse::success(null, 'Order deleted successfully.');
    }

    /**
     * @param  array<int, array<string, mixed>>  $lines
     */
    protected function syncLines(Order $order, array $lines, int $brandId): void
    {
        $subtotal = 0;
        foreach ($lines as $line) {
            $qty = (int) ($line['quantity'] ?? 0);
            $unit = (float) ($line['unit_price'] ?? 0);
            if (! empty($line['product_id'])) {
                $pid = (int) $line['product_id'];
                if (! Product::query()->whereKey($pid)->where('brand_id', $brandId)->exists()) {
                    throw new RuntimeException('Product '.$pid.' does not belong to this brand.');
                }
            }
            $lineTotal = round($qty * $unit, 2);
            $subtotal += $lineTotal;
            OrderLine::query()->create([
                'order_id' => $order->id,
                'product_id' => isset($line['product_id']) ? (int) $line['product_id'] : null,
                'product_name' => (string) $line['product_name'],
                'quantity' => $qty,
                'unit_price' => $unit,
                'line_total' => $lineTotal,
            ]);
        }
    }

    protected function assertCustomerBrand(int $customerId, int $brandId): void
    {
        if (! Customer::query()->whereKey($customerId)->where('brand_id', $brandId)->exists()) {
            throw new RuntimeException('Customer does not belong to this brand.');
        }
    }

    protected function assertLeadBrand(int $leadId, int $brandId): void
    {
        if (! Lead::query()->whereKey($leadId)->where('brand_id', $brandId)->exists()) {
            throw new RuntimeException('Lead does not belong to this brand.');
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    protected function assertNoDuplicateActiveOrder(int $brandId, array $data): void
    {
        $customerId = isset($data['customer_id']) ? (int) $data['customer_id'] : null;
        $leadId = isset($data['lead_id']) ? (int) $data['lead_id'] : null;

        $phone = null;
        if ($customerId) {
            $phone = Customer::query()->whereKey($customerId)->where('brand_id', $brandId)->value('phone');
        } elseif ($leadId) {
            $phone = Lead::query()->whereKey($leadId)->where('brand_id', $brandId)->value('phone');
        }

        if (! $customerId && ! $leadId && ! $phone) {
            return;
        }

        $normalizedPhone = $this->normalizePhone((string) $phone);

        $base = Order::query()
            ->with('customer:id,phone')
            ->where('brand_id', $brandId)
            ->whereNotIn('status', ['delivered', 'cancelled', 'returned']);

        $duplicate = null;
        if ($customerId || $leadId) {
            $duplicate = (clone $base)
                ->where(function ($query) use ($customerId, $leadId) {
                    if ($customerId) {
                        $query->orWhere('customer_id', $customerId);
                    }
                    if ($leadId) {
                        $query->orWhere('lead_id', $leadId);
                    }
                })
                ->orderByDesc('id')
                ->first();
        }

        if (! $duplicate && $normalizedPhone !== '') {
            $candidates = (clone $base)
                ->whereNotNull('customer_id')
                ->orderByDesc('id')
                ->limit(200)
                ->get();

            $duplicate = $candidates->first(function (Order $order) use ($normalizedPhone) {
                return $this->normalizePhone((string) ($order->customer?->phone ?? '')) === $normalizedPhone;
            });
        }

        if (! $duplicate) {
            return;
        }

        throw new RuntimeException(
            sprintf(
                'Commande potentiellement en doublon détectée (%s, statut %s). Vérifiez avant de créer une nouvelle commande.',
                $duplicate->order_number,
                $duplicate->status
            )
        );
    }

    protected function normalizePhone(string $phone): string
    {
        return preg_replace('/\D+/', '', $phone) ?? '';
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{
     *   payment_state: string,
     *   bank_transfer_declared_paid: bool,
     *   bank_transfer_reference: ?string,
     *   bank_transfer_declared_at: mixed,
     *   bank_transfer_verified_at: mixed,
     *   bank_transfer_verification_status: string,
     *   bank_transfer_verification_note: ?string
     * }
     */
    protected function resolveBankTransferFields(array $data): array
    {
        $method = (string) ($data['payment_method'] ?? 'prepaid');
        $state = (string) ($data['payment_state'] ?? 'unpaid');
        $declared = (bool) ($data['bank_transfer_declared_paid'] ?? false);
        $referenceRaw = isset($data['bank_transfer_reference']) ? trim((string) $data['bank_transfer_reference']) : '';
        $noteRaw = isset($data['bank_transfer_verification_note']) ? trim((string) $data['bank_transfer_verification_note']) : '';
        $verifiedStatusRaw = isset($data['bank_transfer_verification_status']) ? (string) $data['bank_transfer_verification_status'] : '';
        $declaredAt = $data['bank_transfer_declared_at'] ?? null;
        $verifiedAt = $data['bank_transfer_verified_at'] ?? null;

        if ($method !== 'transfer') {
            return [
                'payment_state' => $state,
                'bank_transfer_declared_paid' => false,
                'bank_transfer_reference' => null,
                'bank_transfer_declared_at' => null,
                'bank_transfer_verified_at' => null,
                'bank_transfer_verification_status' => 'not_required',
                'bank_transfer_verification_note' => null,
            ];
        }

        if ($declared && $declaredAt === null) {
            $declaredAt = now();
        }

        $status = $verifiedStatusRaw;
        if (! in_array($status, ['pending', 'verified', 'failed', 'not_required'], true)) {
            $status = $declared ? 'pending' : 'pending';
        }

        if ($state === 'paid') {
            $status = 'verified';
            if ($verifiedAt === null) {
                $verifiedAt = now();
            }
        }

        if ($status !== 'verified') {
            $verifiedAt = null;
            if ($state === 'paid') {
                $state = 'unpaid';
            }
        }

        if ($status === 'not_required') {
            $status = 'pending';
        }

        return [
            'payment_state' => $state,
            'bank_transfer_declared_paid' => $declared,
            'bank_transfer_reference' => $referenceRaw !== '' ? $referenceRaw : null,
            'bank_transfer_declared_at' => $declaredAt,
            'bank_transfer_verified_at' => $verifiedAt,
            'bank_transfer_verification_status' => $status,
            'bank_transfer_verification_note' => $noteRaw !== '' ? $noteRaw : null,
        ];
    }

    protected function createDeliveryChargeIfPaid(Order $order, string $previousPaymentState, ?\App\Models\User $actor): void
    {
        if ($order->payment_state !== 'paid' || $previousPaymentState === 'paid') {
            return;
        }
        if ((float) $order->shipping_fee <= 0) {
            return;
        }
        if (Charge::query()->where('order_id', $order->id)->where('type', 'delivery')->exists()) {
            return;
        }

        Charge::query()->create([
            'brand_id' => $order->brand_id,
            'order_id' => $order->id,
            'created_by' => $actor?->id,
            'charge_date' => now()->toDateString(),
            'type' => 'delivery',
            'amount' => (float) $order->shipping_fee,
            'note' => 'Frais de livraison – Commande '.$order->order_number,
        ]);
    }
}
