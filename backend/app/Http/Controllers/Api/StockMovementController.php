<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreStockMovementRequest;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\AuditLogger;
use App\Services\StockService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class StockMovementController extends Controller
{
    public function __construct(
        protected StockService $stockService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $productId = $request->query('product_id');

        $q = StockMovement::query()->with(['product', 'actor']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q
            ->orderByDesc('moved_at');

        if ($productId) {
            $q->where('product_id', (int) $productId);
        }

        return ApiResponse::success($q->paginate($perPage), 'Stock movements retrieved successfully.');
    }

    public function store(StoreStockMovementRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $product = Product::query()->where('brand_id', $brandId)->findOrFail($data['product_id']);
        $type = $data['movement_type'];

        try {
            if ($type === 'adjustment') {
                $movement = $this->stockService->adjustStock(
                    $product,
                    (int) $data['signed_delta'],
                    $request->user(),
                    $data['reason'] ?? null
                );
            } else {
                $movement = $this->stockService->recordMovement(
                    $product,
                    $type,
                    (int) $data['quantity'],
                    $request->user(),
                    [
                        'reason' => $data['reason'] ?? null,
                        'reference_type' => $data['reference_type'] ?? null,
                        'reference_id' => $data['reference_id'] ?? null,
                    ]
                );
            }
        } catch (RuntimeException $e) {
            return ApiResponse::error($e->getMessage(), null, 422);
        }

        AuditLogger::log($request, 'stock.movement', $movement, null, $movement->toArray());

        return ApiResponse::success($movement->fresh(['product']), 'Stock movement recorded successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $movement = StockMovement::query()->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($movement->load(['product', 'actor']), 'Stock movement retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        return ApiResponse::error('Stock movements are immutable.', null, 405);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        return ApiResponse::error('Stock movement history cannot be deleted.', null, 422);
    }
}
