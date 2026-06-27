<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreContentProductionRequest;
use App\Http\Requests\Api\UpdateContentProductionRequest;
use App\Models\ContentCalendar;
use App\Models\ContentProduction;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\SocialScope;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ContentProductionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $type = $request->query('type');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $assigned = $request->query('assigned_user_id');

        $q = ContentProduction::query()->with(['contentCalendar', 'owner']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('id');
        if ($status) {
            $q->where('status', $status);
        }
        if ($type) {
            $q->where('production_type', $type);
        }
        if ($from) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('created_at', '<=', $to);
        }
        if ($assigned) {
            $q->where('owner_user_id', (int) $assigned);
        }

        return ApiResponse::success($q->paginate($perPage), 'Content production tasks retrieved successfully.');
    }

    public function store(StoreContentProductionRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        if (! empty($data['content_calendar_id'])) {
            $ok = ContentCalendar::query()->where('brand_id', $brandId)->whereKey($data['content_calendar_id'])->exists();
            if (! $ok) {
                abort(422, 'Invalid content calendar item.');
            }
        }
        SocialScope::forceCmOwnerOnCreate($request->user(), $data);

        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'todo';

        if (in_array($data['status'], ['validated', 'rejected'], true) && ! UserRoleHelper::canValidateProduction($request->user())) {
            throw new AccessDeniedHttpException('Validation restricted to SMM/Admin.');
        }

        $row = ContentProduction::query()->create($data);

        AuditLogger::log($request, 'content_production.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['contentCalendar', 'owner']), 'Production task created.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentProduction::query()->with(['contentCalendar', 'owner'])->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($row, 'Production task retrieved.');
    }

    public function update(UpdateContentProductionRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentProduction::query()->where('brand_id', $brandId)->findOrFail($id);
        SocialScope::assertCmProductionAccess($request->user(), $row);
        $before = $row->toArray();
        $data = $request->validated();
        SocialScope::stripCmProductionOwner($request->user(), $data);

        $newStatus = $data['status'] ?? $row->status;
        if (in_array($newStatus, ['validated', 'rejected'], true) && ! UserRoleHelper::canValidateProduction($request->user())) {
            throw new AccessDeniedHttpException('Only SMM/Admin can validate or reject production.');
        }

        if (! empty($data['content_calendar_id'])) {
            $ok = ContentCalendar::query()->where('brand_id', $brandId)->whereKey($data['content_calendar_id'])->exists();
            if (! $ok) {
                abort(422, 'Invalid content calendar item.');
            }
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'content_production.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['contentCalendar', 'owner']), 'Production task updated.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentProduction::query()->where('brand_id', $brandId)->findOrFail($id);
        SocialScope::assertCmProductionAccess($request->user(), $row);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'content_production.delete', null, $before, null);

        return ApiResponse::success(null, 'Production task deleted.');
    }
}
