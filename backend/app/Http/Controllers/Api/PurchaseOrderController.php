<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ReceivePurchaseOrderRequest;
use App\Http\Requests\Api\StorePurchaseOrderRequest;
use App\Http\Requests\Api\UpdatePurchaseOrderRequest;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\Supplier;
use App\Services\AuditLogger;
use App\Services\PurchaseOrderService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PurchaseOrderController extends Controller
{
    public function __construct(
        protected PurchaseOrderService $purchaseOrderService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');
        $status = $request->query('status');
        $supplierId = $request->query('supplier_id');
        $paymentStatus = $request->query('payment_status');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = PurchaseOrder::query()
            ->with(['supplier', 'brand', 'lines.product', 'creator:id,name,email', 'responsibleUser:id,name,email']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q
            ->orderByDesc('ordered_at')
            ->orderByDesc('id');
        if ($status) {
            $q->where('status', $status);
        }
        if ($supplierId) {
            $q->where('supplier_id', (int) $supplierId);
        }
        if ($paymentStatus) {
            $q->where('payment_status', $paymentStatus);
        }
        if ($from) {
            $q->whereDate('ordered_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('ordered_at', '<=', $to);
        }
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($qq) use ($s) {
                $qq->where('reference', 'like', $s)
                    ->orWhere('supplier_invoice_ref', 'like', $s)
                    ->orWhere('tracking_number', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Purchase orders retrieved successfully.');
    }

    public function store(StorePurchaseOrderRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        try {
            $po = DB::transaction(function () use ($request, $brandId, $data) {
                $this->assertSupplierBrand((int) $data['supplier_id'], $brandId);

                $ref = ! empty($data['reference'])
                    ? $data['reference']
                    : PurchaseOrderService::generateReference();

                $orderedAt = $data['ordered_at'] ?? now()->toDateString();

                $po = PurchaseOrder::query()->create([
                    'brand_id' => $brandId,
                    'supplier_id' => $data['supplier_id'],
                    'created_by' => $request->user()->id,
                    'responsible_user_id' => $data['responsible_user_id'] ?? null,
                    'reference' => $ref,
                    'status' => $data['status'] ?? 'draft',
                    'payment_status' => $data['payment_status'] ?? 'unpaid',
                    'currency' => $data['currency'] ?? 'MAD',
                    'discount' => round((float) ($data['discount'] ?? 0), 2),
                    'tax' => round((float) ($data['tax'] ?? 0), 2),
                    'shipping_fee' => isset($data['shipping_fee']) ? round((float) $data['shipping_fee'], 2) : null,
                    'paid_amount' => round((float) ($data['paid_amount'] ?? 0), 2),
                    'payment_method' => $data['payment_method'] ?? null,
                    'payment_due_date' => $data['payment_due_date'] ?? null,
                    'shipping_mode' => $data['shipping_mode'] ?? null,
                    'carrier_name' => $data['carrier_name'] ?? null,
                    'tracking_number' => $data['tracking_number'] ?? null,
                    'warehouse_destination' => $data['warehouse_destination'] ?? null,
                    'supplier_conditions' => $data['supplier_conditions'] ?? null,
                    'internal_notes' => $data['internal_notes'] ?? null,
                    'attachments_json' => $data['attachments_json'] ?? null,
                    'supplier_invoice_ref' => $data['supplier_invoice_ref'] ?? null,
                    'delivery_note_ref' => $data['delivery_note_ref'] ?? null,
                    'ordered_at' => $orderedAt,
                    'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                    'total_amount' => 0,
                    'subtotal' => 0,
                    'remaining_amount' => 0,
                ]);

                foreach ($data['lines'] as $line) {
                    $productId = (int) $line['product_id'];
                    $this->assertProductBrand($productId, $brandId);
                    $product = Product::query()->whereKey($productId)->firstOrFail();
                    $qty = (int) $line['quantity_ordered'];
                    $unit = round((float) $line['unit_price'], 2);
                    $disc = round((float) ($line['line_discount'] ?? 0), 4);
                    $tax = round((float) ($line['line_tax'] ?? 0), 4);
                    $lineTotal = round(max(0, $qty * $unit - $disc + $tax), 2);

                    PurchaseOrderLine::query()->create([
                        'purchase_order_id' => $po->id,
                        'product_id' => $productId,
                        'sku_snapshot' => $product->sku,
                        'product_name_snapshot' => $product->name,
                        'quantity_ordered' => $qty,
                        'quantity_received' => 0,
                        'unit_price' => $unit,
                        'line_discount' => $disc,
                        'line_tax' => $tax,
                        'line_total' => $lineTotal,
                    ]);
                }

                $this->purchaseOrderService->recalculateTotal($po->fresh(['lines']));

                return $po->fresh(['lines.product', 'supplier', 'brand', 'responsibleUser']);
            });
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'purchase_orders.create', $po, null, $po->toArray());

        return ApiResponse::success($po, 'Purchase order created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $po = PurchaseOrder::query()
            ->with(['lines.product', 'supplier', 'brand', 'creator', 'responsibleUser'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($po, 'Purchase order retrieved successfully.');
    }

    public function update(UpdatePurchaseOrderRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $po = PurchaseOrder::query()->with('lines')->where('brand_id', $brandId)->findOrFail($id);

        if ($po->status === 'received' && ! $request->user()->isAdmin()) {
            return ApiResponse::error('Received purchase orders cannot be modified.', null, 422);
        }

        $before = $po->toArray();
        $data = $request->validated();

        try {
            DB::transaction(function () use ($request, $brandId, $po, $data) {
                if (isset($data['supplier_id'])) {
                    $this->assertSupplierBrand((int) $data['supplier_id'], $brandId);
                }

                if (isset($data['lines'])) {
                    $receivedStarted = (int) $po->lines->sum('quantity_received') > 0;
                    if ($receivedStarted && ! $request->user()->isAdmin()) {
                        throw new RuntimeException('Cannot replace lines after reception has started.');
                    }
                    $po->lines()->delete();
                    foreach ($data['lines'] as $line) {
                        $productId = (int) $line['product_id'];
                        $this->assertProductBrand($productId, $brandId);
                        $product = Product::query()->whereKey($productId)->firstOrFail();
                        $qty = (int) $line['quantity_ordered'];
                        $unit = round((float) $line['unit_price'], 2);
                        $disc = round((float) ($line['line_discount'] ?? 0), 4);
                        $tax = round((float) ($line['line_tax'] ?? 0), 4);
                        $lineTotal = round(max(0, $qty * $unit - $disc + $tax), 2);

                        PurchaseOrderLine::query()->create([
                            'purchase_order_id' => $po->id,
                            'product_id' => $productId,
                            'sku_snapshot' => $product->sku,
                            'product_name_snapshot' => $product->name,
                            'quantity_ordered' => $qty,
                            'quantity_received' => 0,
                            'unit_price' => $unit,
                            'line_discount' => $disc,
                            'line_tax' => $tax,
                            'line_total' => $lineTotal,
                        ]);
                    }
                }

                $fill = collect($data)->only([
                    'supplier_id', 'responsible_user_id', 'reference', 'status', 'payment_status',
                    'currency', 'discount', 'tax', 'shipping_fee', 'paid_amount',
                    'payment_method', 'payment_due_date', 'shipping_mode', 'carrier_name',
                    'tracking_number', 'warehouse_destination', 'supplier_conditions',
                    'internal_notes', 'attachments_json', 'supplier_invoice_ref', 'delivery_note_ref',
                    'ordered_at', 'expected_delivery_date',
                ])->all();

                $po->fill($fill);
                $po->save();

                $this->purchaseOrderService->recalculateTotal($po->fresh(['lines']));
            });
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        $po = $po->fresh(['lines.product', 'supplier', 'responsibleUser']);

        AuditLogger::log($request, 'purchase_orders.update', $po, $before, $po->toArray());

        return ApiResponse::success($po, 'Purchase order updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $po = PurchaseOrder::query()->where('brand_id', $brandId)->findOrFail($id);

        if ($po->status !== 'draft') {
            return ApiResponse::error('Only draft purchase orders can be deleted.', null, 422);
        }

        $before = $po->toArray();
        $po->lines()->delete();
        $po->delete();

        AuditLogger::log($request, 'purchase_orders.delete', null, $before, null);

        return ApiResponse::success(null, 'Purchase order deleted successfully.');
    }

    public function receive(ReceivePurchaseOrderRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $po = PurchaseOrder::query()->where('brand_id', $brandId)->findOrFail($id);
        $payload = $request->validated()['lines'] ?? [];

        try {
            $received = $this->purchaseOrderService->receiveShipment($po, $request->user(), $payload);
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'purchase_orders.receive', $received, null, $received->toArray());

        return ApiResponse::success($received, 'Réception enregistrée et stock mis à jour.');
    }

    public function sendToSupplier(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $po = PurchaseOrder::query()->where('brand_id', $brandId)->findOrFail($id);

        if ($po->status !== 'draft') {
            return ApiResponse::error('Seuls les brouillons peuvent être envoyés au fournisseur.', null, 422);
        }

        $before = $po->toArray();
        $po->status = 'sent';
        $po->save();

        AuditLogger::log($request, 'purchase_orders.send', $po, $before, $po->toArray());

        return ApiResponse::success($po->fresh(['supplier', 'lines']), 'Bon de commande marqué comme envoyé.');
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $po = PurchaseOrder::query()->where('brand_id', $brandId)->findOrFail($id);

        if (in_array($po->status, ['received', 'partially_received'], true)) {
            return ApiResponse::error('Impossible d’annuler une commande déjà réceptionnée (partiellement ou totalement).', null, 422);
        }

        $before = $po->toArray();
        $po->status = 'cancelled';
        $po->save();

        AuditLogger::log($request, 'purchase_orders.cancel', $po, $before, $po->toArray());

        return ApiResponse::success($po->fresh(['supplier', 'lines']), 'Commande annulée.');
    }

    protected function assertSupplierBrand(int $supplierId, int $brandId): void
    {
        if (! Supplier::query()->whereKey($supplierId)->where('brand_id', $brandId)->exists()) {
            throw new RuntimeException('Supplier does not belong to this brand.');
        }
    }

    protected function assertProductBrand(int $productId, int $brandId): void
    {
        if (! Product::query()->whereKey($productId)->where('brand_id', $brandId)->exists()) {
            throw new RuntimeException('Product does not belong to this brand.');
        }
    }
}
