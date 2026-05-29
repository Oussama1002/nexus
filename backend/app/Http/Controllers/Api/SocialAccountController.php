<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreSocialAccountRequest;
use App\Http\Requests\Api\UpdateSocialAccountRequest;
use App\Models\SocialAccount;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SocialAccountController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $platform = $request->query('platform');
        $status = $request->query('status');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = SocialAccount::query()->with(['responsible:id,name,email'])->where('brand_id', $brandId)->orderByDesc('id');
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

        $paginator = $q->paginate($perPage);
        $paginator->getCollection()->transform(fn (SocialAccount $a) => $a->toSafeArray());

        return ApiResponse::success($paginator, 'Social accounts retrieved successfully.');
    }

    public function store(StoreSocialAccountRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'active';

        $account = SocialAccount::query()->create($data);

        AuditLogger::log($request, 'social_accounts.create', $account, null, $account->toSafeArray());

        return ApiResponse::success(
            $account->fresh()->load('responsible:id,name,email')->toSafeArray(),
            'Social account created successfully.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $account = SocialAccount::query()->with(['responsible:id,name,email'])->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($account->toSafeArray(), 'Social account retrieved successfully.');
    }

    public function update(UpdateSocialAccountRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $account = SocialAccount::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $account->toSafeArray();
        $account->fill($request->validated());
        $account->save();

        AuditLogger::log($request, 'social_accounts.update', $account, $before, $account->fresh()->toSafeArray());

        return ApiResponse::success(
            $account->fresh()->load('responsible:id,name,email')->toSafeArray(),
            'Social account updated successfully.'
        );
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $account = SocialAccount::query()->where('brand_id', $brandId)->findOrFail($id);
        if ($account->contentCalendar()->exists()) {
            return ApiResponse::error('Cannot delete social account linked to calendar entries.', null, 422);
        }
        $before = $account->toSafeArray();
        $account->delete();

        AuditLogger::log($request, 'social_accounts.delete', null, $before, null);

        return ApiResponse::success(null, 'Social account deleted successfully.');
    }
}
