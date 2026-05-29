<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StorePurchaseOrderLineRequest;
use App\Http\Requests\Api\UpdatePurchaseOrderLineRequest;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Services\AuditLogger;
use App\Services\PurchaseOrderService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class PurchaseOrderLineController extends Controller
{
    public function __construct(
        protected PurchaseOrderService $purchaseOrderService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $purchaseOrderId = (int) $request->query('purchase_order_id');
        if (! $purchaseOrderId) {
            return ApiResponse::error('purchase_order_id query parameter is required.', null, 422);
        }

        $po = PurchaseOrder::query()->where('brand_id', $brandId)->whereKey($purchaseOrderId)->firstOrFail();

        return ApiResponse::success(
            PurchaseOrderLine::query()->with('product')->where('purchase_order_id', $po->id)->orderBy('id')->get(),
            'Purchase order lines retrieved successfully.'
        );
    }

    public function store(StorePurchaseOrderLineRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();

        $po = PurchaseOrder::query()->where('brand_id', $brandId)->whereKey($data['purchase_order_id'])->firstOrFail();

        if (in_array($po->status, ['received', 'partially_received'], true) && ! $request->user()->isAdmin()) {
            return ApiResponse::error('Cannot add lines to a fully or partially received PO.', null, 422);
        }

        try {
            $this->assertProductBrand((int) $data['product_id'], $brandId);
            $product = Product::query()->whereKey((int) $data['product_id'])->firstOrFail();
            $qty = (int) $data['quantity_ordered'];
            $unit = round((float) $data['unit_price'], 2);
            $disc = round((float) ($data['line_discount'] ?? 0), 4);
            $tax = round((float) ($data['line_tax'] ?? 0), 4);
            $lineTotal = round(max(0, $qty * $unit - $disc + $tax), 2);

            $line = PurchaseOrderLine::query()->create([
                'purchase_order_id' => $po->id,
                'product_id' => (int) $data['product_id'],
                'sku_snapshot' => $product->sku,
                'product_name_snapshot' => $product->name,
                'quantity_ordered' => $qty,
                'quantity_received' => 0,
                'unit_price' => $unit,
                'line_discount' => $disc,
                'line_tax' => $tax,
                'line_total' => $lineTotal,
            ]);

            $this->purchaseOrderService->recalculateTotal($po->fresh(['lines']));
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        $line = $line->fresh(['product']);

        AuditLogger::log($request, 'purchase_order_lines.create', $line, null, $line->toArray());

        return ApiResponse::success($line, 'Line created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $line = PurchaseOrderLine::query()
            ->whereKey($id)
            ->whereHas('purchaseOrder', fn ($q) => $q->where('brand_id', $brandId))
            ->with('product')
            ->firstOrFail();

        return ApiResponse::success($line, 'Line retrieved successfully.');
    }

    public function update(UpdatePurchaseOrderLineRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $line = PurchaseOrderLine::query()
            ->whereKey($id)
            ->whereHas('purchaseOrder', fn ($q) => $q->where('brand_id', $brandId))
            ->firstOrFail();

        $po = $line->purchaseOrder;
        if (in_array($po->status, ['received', 'partially_received'], true) && ! $request->user()->isAdmin()) {
            return ApiResponse::error('Cannot edit lines on a received PO.', null, 422);
        }

        $before = $line->toArray();
        $data = $request->validated();

        if (isset($data['product_id'])) {
            try {
                $this->assertProductBrand((int) $data['product_id'], $brandId);
                $product = Product::query()->whereKey((int) $data['product_id'])->firstOrFail();
                $line->sku_snapshot = $product->sku;
                $line->product_name_snapshot = $product->name;
            } catch (RuntimeException $e) {
                return ApiResponse::error($e->getMessage(), null, 422);
            }
        }

        $line->fill($data);
        $qty = (int) $line->quantity_ordered;
        $unit = (float) $line->unit_price;
        $disc = (float) ($line->line_discount ?? 0);
        $tax = (float) ($line->line_tax ?? 0);
        $line->line_total = round(max(0, $qty * $unit - $disc + $tax), 2);
        $line->save();

        $this->purchaseOrderService->recalculateTotal($po->fresh(['lines']));

        $line = $line->fresh(['product']);

        AuditLogger::log($request, 'purchase_order_lines.update', $line, $before, $line->toArray());

        return ApiResponse::success($line, 'Line updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $line = PurchaseOrderLine::query()
            ->whereKey($id)
            ->whereHas('purchaseOrder', fn ($q) => $q->where('brand_id', $brandId))
            ->firstOrFail();

        $po = $line->purchaseOrder;
        if (in_array($po->status, ['received', 'partially_received'], true) && ! $request->user()->isAdmin()) {
            return ApiResponse::error('Cannot delete lines on a received PO.', null, 422);
        }

        $before = $line->toArray();
        $line->delete();
        $this->purchaseOrderService->recalculateTotal($po->fresh(['lines']));

        AuditLogger::log($request, 'purchase_order_lines.delete', null, $before, null);

        return ApiResponse::success(null, 'Line deleted successfully.');
    }

    protected function assertProductBrand(int $productId, int $brandId): void
    {
        if (! Product::query()->whereKey($productId)->where('brand_id', $brandId)->exists()) {
            throw new RuntimeException('Product does not belong to this brand.');
        }
    }
}
