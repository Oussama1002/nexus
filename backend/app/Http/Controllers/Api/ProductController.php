<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreProductRequest;
use App\Http\Requests\Api\UpdateProductRequest;
use App\Models\OrderLine;
use App\Models\Product;
use App\Services\AuditLogger;
use App\Services\StockService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    public function __construct(
        protected StockService $stockService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $search = $request->query('search');

        $q = Product::query();
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('id');
        if ($search) {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], (string) $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('name', 'like', $s)->orWhere('sku', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Products retrieved successfully.');
    }

    public function store(StoreProductRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['cost'] = $data['cost'] ?? 0;
        $data['status'] = $data['status'] ?? 'active';
        $initial = (int) ($data['stock_quantity'] ?? 0);
        unset($data['stock_quantity'], $data['pack_items_array']);

        if (isset($data['pack_items']) && is_string($data['pack_items'])) {
            $data['pack_items'] = json_decode($data['pack_items'], true);
        }

        if ($request->hasFile('image')) {
            $data['image'] = '/storage/' . $request->file('image')->store('products', 'public');
        }

        if (empty($data['sku'])) {
            $data['sku'] = $this->generateSku($brandId);
        }

        $product = DB::transaction(function () use ($request, $data, $initial) {
            $p = Product::query()->create(array_merge($data, [
                'stock_quantity' => 0,
                'reserved_quantity' => 0,
            ]));
            if ($initial > 0) {
                $this->stockService->recordMovement($p->fresh(), 'in', $initial, $request->user(), [
                    'reason' => 'initial_stock_on_create',
                ]);
            }

            return $p->fresh();
        });

        AuditLogger::log($request, 'products.create', $product, null, $product->toArray());

        return ApiResponse::success($product, 'Product created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $product = Product::query()->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($product, 'Product retrieved successfully.');
    }

    public function update(UpdateProductRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $product = Product::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $product->toArray();
        $validated = $request->validated();
        unset($validated['pack_items_array']);
        if (isset($validated['pack_items']) && is_string($validated['pack_items'])) {
            $validated['pack_items'] = json_decode($validated['pack_items'], true);
        }
        $product->fill($validated);

        if ($request->hasFile('image')) {
            if ($product->getOriginal('image')) {
                $old = str_replace('/storage/', '', $product->getOriginal('image'));
                Storage::disk('public')->delete($old);
            }
            $product->image = '/storage/' . $request->file('image')->store('products', 'public');
        }

        $product->save();

        AuditLogger::log($request, 'products.update', $product, $before, $product->fresh()->toArray());

        return ApiResponse::success($product->fresh(), 'Product updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $product = Product::query()->where('brand_id', $brandId)->findOrFail($id);

        if (OrderLine::query()->where('product_id', $product->id)->exists()) {
            return ApiResponse::error('Cannot delete product referenced on order lines.', null, 422);
        }

        $before = $product->toArray();
        $product->delete();
        AuditLogger::log($request, 'products.delete', null, $before, null);

        return ApiResponse::success(null, 'Product deleted successfully.');
    }

    /**
     * Generate a unique SKU: PRD-{brandId}-{sequence}.
     */
    private function generateSku(int $brandId): string
    {
        $last = Product::query()
            ->where('brand_id', $brandId)
            ->where('sku', 'like', "PRD-{$brandId}-%")
            ->orderByDesc('id')
            ->value('sku');

        $seq = 1;
        if ($last && preg_match('/PRD-\d+-(\d+)$/', $last, $m)) {
            $seq = ((int) $m[1]) + 1;
        }

        return sprintf('PRD-%d-%04d', $brandId, $seq);
    }
}
