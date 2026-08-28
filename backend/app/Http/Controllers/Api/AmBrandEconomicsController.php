<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmBrandEconomics;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmBrandEconomicsController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmBrandEconomics::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $row = AmBrandEconomics::query()->updateOrCreate(
            ['brand_id' => $data['brand_id'], 'product_id' => $data['product_id'] ?? null, 'market' => $data['market'] ?? null],
            array_merge($data, [
                'updated_by_user_id' => $request->user()->id,
                'last_updated_at' => now(),
            ]),
        );
        $this->recompute($row);
        AuditLogger::log($request, 'am_brand_economics.upserted', $row, null, $row->toArray());
        return ApiResponse::success($row->fresh(), 'Modèle économique mis à jour.', 201);
    }

    public function update(Request $request, int $id)
    {
        $row = AmBrandEconomics::query()->findOrFail($id);
        $data = $this->validated($request, forUpdate: true);
        $before = $row->toArray();
        $row->fill($data + [
            'updated_by_user_id' => $request->user()->id,
            'last_updated_at' => now(),
        ])->save();
        $this->recompute($row);
        AuditLogger::log($request, 'am_brand_economics.updated', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    private function validated(Request $request, bool $forUpdate = false): array
    {
        $rules = [
            'brand_id' => ($forUpdate ? 'sometimes' : 'required') . '|integer|exists:brands,id',
            'product_id' => 'nullable|integer',
            'market' => 'nullable|string|max:50',
            'selling_price' => 'nullable|numeric|min:0',
            'cogs' => 'nullable|numeric|min:0',
            'packaging_cost' => 'nullable|numeric|min:0',
            'transaction_fee' => 'nullable|numeric|min:0',
            'shipping_cost' => 'nullable|numeric|min:0',
            'confirmation_cost_per_order' => 'nullable|numeric|min:0',
            'aov' => 'nullable|numeric|min:0',
            'gross_margin_target' => 'nullable|numeric|between:0,1',
            'target_cac' => 'nullable|numeric|min:0',
            'observed_cac' => 'nullable|numeric|min:0',
            'ltv' => 'nullable|numeric|min:0',
            'ltv_cac_threshold' => 'nullable|numeric|min:0',
        ];
        return $request->validate($rules);
    }

    private function recompute(AmBrandEconomics $row): void
    {
        $price = (float) $row->selling_price;
        $costs = (float) $row->cogs + (float) $row->packaging_cost + (float) $row->transaction_fee + (float) $row->shipping_cost + (float) $row->confirmation_cost_per_order;
        $margin = $price > 0 ? round(($price - $costs) / $price, 4) : null;
        $ratio = ($row->observed_cac > 0 && $row->ltv !== null) ? round((float) $row->ltv / (float) $row->observed_cac, 4) : null;
        $net = $price > 0 ? round($price - $costs - (float) ($row->observed_cac ?? 0), 2) : null;

        $row->fill([
            'gross_margin' => $margin,
            'ltv_cac_ratio' => $ratio,
            'net_margin_per_order' => $net,
        ])->save();
    }
}
