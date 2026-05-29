<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCmDailyTrackingRequest;
use App\Http\Requests\Api\UpdateCmDailyTrackingRequest;
use App\Models\CmDailyTracking;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class CmDailyTrackingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $assigned = $request->query('assigned_user_id');

        $q = CmDailyTracking::query()->with(['cmUser'])->where('brand_id', $brandId)->orderByDesc('work_date');
        if ($status) {
            $q->where('status', $status);
        }
        if ($from) {
            $q->whereDate('work_date', '>=', $from);
        }
        if ($to) {
            $q->whereDate('work_date', '<=', $to);
        }
        if ($assigned) {
            $q->where('cm_user_id', (int) $assigned);
        }

        return ApiResponse::success($q->paginate($perPage), 'CM daily tracking retrieved successfully.');
    }

    public function store(StoreCmDailyTrackingRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();
        $data = $request->validated();

        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user)) {
            if ((int) $data['cm_user_id'] !== (int) $user->id) {
                throw new AccessDeniedHttpException('Community managers can only submit tracking for themselves.');
            }
        }

        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'pending';

        if (in_array($data['status'], ['validated', 'rejected'], true) && ! UserRoleHelper::canValidateCmDaily($user)) {
            throw new AccessDeniedHttpException('Validation restricted to SMM/Admin.');
        }

        $row = CmDailyTracking::query()->updateOrCreate(
            [
                'cm_user_id' => $data['cm_user_id'],
                'brand_id' => $brandId,
                'work_date' => $data['work_date'],
            ],
            $data
        );

        AuditLogger::log($request, 'cm_daily_tracking.upsert', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('cmUser'), 'CM daily tracking saved.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = CmDailyTracking::query()->with(['cmUser'])->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($row, 'CM daily tracking retrieved successfully.');
    }

    public function update(UpdateCmDailyTrackingRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = CmDailyTracking::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $data = $request->validated();

        $user = $request->user();
        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user)) {
            if ((int) $row->cm_user_id !== (int) $user->id) {
                throw new AccessDeniedHttpException('Cannot edit another CM tracking.');
            }
        }

        $newStatus = $data['status'] ?? $row->status;
        if (in_array($newStatus, ['validated', 'rejected'], true) && ! UserRoleHelper::canValidateCmDaily($user)) {
            throw new AccessDeniedHttpException('Only SMM/Admin can validate CM tracking.');
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'cm_daily_tracking.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load('cmUser'), 'CM daily tracking updated.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = CmDailyTracking::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'cm_daily_tracking.delete', null, $before, null);

        return ApiResponse::success(null, 'CM daily tracking deleted.');
    }
}
