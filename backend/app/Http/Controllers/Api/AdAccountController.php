<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAdAccountRequest;
use App\Http\Requests\Api\UpdateAdAccountRequest;
use App\Models\AdAccount;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdAccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $platform = $request->query('platform');
        $status = $request->query('status');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = AdAccount::query()->where('brand_id', $brandId)->orderByDesc('id');
        if ($platform) {
            $q->where('platform', $platform);
        }
        if ($status) {
            $q->where('status', $status);
        }
        if ($from) {
            $q->whereDate('updated_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('updated_at', '<=', $to);
        }

        $paginator = $q->with(['responsible:id,name', 'brand:id,name'])->paginate($perPage);
        $paginator->getCollection()->transform(fn (AdAccount $a) => $a->toSafeArray());

        return ApiResponse::success($paginator, 'Ad accounts retrieved successfully.');
    }

    public function store(StoreAdAccountRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['currency'] = $data['currency'] ?? 'MAD';
        $data['status'] = $data['status'] ?? 'active';
        $data['api_connected'] = array_key_exists('api_connected', $data) ? (bool) $data['api_connected'] : false;

        $account = AdAccount::query()->create($data);

        AuditLogger::log($request, 'ad_accounts.create', $account, null, $account->toSafeArray());

        return ApiResponse::success(
            $account->fresh()->load(['responsible:id,name', 'brand:id,name'])->toSafeArray(),
            'Ad account created successfully.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $account = AdAccount::query()->with(['responsible:id,name', 'brand:id,name'])->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($account->toSafeArray(), 'Ad account retrieved successfully.');
    }

    public function update(UpdateAdAccountRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $account = AdAccount::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $account->toSafeArray();
        $data = $request->validated();
        foreach (['access_token_ref', 'refresh_token_ref', 'webhook_secret_ref'] as $secretKey) {
            if (array_key_exists($secretKey, $data) && ($data[$secretKey] === null || $data[$secretKey] === '')) {
                unset($data[$secretKey]);
            }
        }
        $account->fill($data);
        $account->save();

        AuditLogger::log($request, 'ad_accounts.update', $account, $before, $account->fresh()->toSafeArray());

        return ApiResponse::success(
            $account->fresh()->load(['responsible:id,name', 'brand:id,name'])->toSafeArray(),
            'Ad account updated successfully.'
        );
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $account = AdAccount::query()->where('brand_id', $brandId)->findOrFail($id);

        if ($account->campaigns()->exists()) {
            return ApiResponse::error('Cannot delete ad account with campaigns.', null, 422);
        }

        $before = $account->toSafeArray();
        $account->delete();

        AuditLogger::log($request, 'ad_accounts.delete', null, $before, null);

        return ApiResponse::success(null, 'Ad account deleted successfully.');
    }
}
