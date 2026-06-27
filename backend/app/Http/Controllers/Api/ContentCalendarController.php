<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreContentCalendarRequest;
use App\Http\Requests\Api\UpdateContentCalendarRequest;
use App\Models\ContentCalendar;
use App\Models\SocialAccount;
use App\Models\Strategy;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\SocialScope;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ContentCalendarController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $status = $request->query('status');
        $platform = $request->query('platform');
        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $assigned = $request->query('assigned_user_id');

        $q = ContentCalendar::query()
            ->with(['socialAccount', 'strategy', 'assignee', 'validatedByUser:id,name,email']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('planned_at');
        if ($status) {
            $q->where('status', $status);
        }
        if ($platform) {
            $q->where(function ($w) use ($platform) {
                $w->where('platform', $platform)
                    ->orWhereHas('socialAccount', fn ($s) => $s->where('platform', $platform));
            });
        }
        if ($from) {
            $q->whereDate('planned_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('planned_at', '<=', $to);
        }
        if ($assigned) {
            $q->where('assigned_to', (int) $assigned);
        }

        return ApiResponse::success($q->paginate($perPage), 'Content calendar retrieved successfully.');
    }

    public function store(StoreContentCalendarRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $this->assertForeignBrand($brandId, $data);
        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'draft';
        if (in_array($data['status'], ['approved', 'published'], true) && ! UserRoleHelper::canApproveContentCalendar($request->user())) {
            throw new AccessDeniedHttpException('Only SMM/Admin can create content as approved or published.');
        }

        $row = ContentCalendar::query()->create($data);

        AuditLogger::log($request, 'content_calendar.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['socialAccount', 'strategy', 'assignee']), 'Content item created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentCalendar::query()->with(['socialAccount', 'strategy', 'assignee', 'validatedByUser:id,name,email'])->where('brand_id', $brandId)->findOrFail($id);

        return ApiResponse::success($row, 'Content item retrieved successfully.');
    }

    public function update(UpdateContentCalendarRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentCalendar::query()->where('brand_id', $brandId)->findOrFail($id);
        SocialScope::assertCmCalendarAccess($request->user(), $row);
        $before = $row->toArray();
        $data = $request->validated();
        $this->assertForeignBrand($brandId, $data);
        SocialScope::stripCmCalendarAssignee($request->user(), $data);

        $newStatus = $data['status'] ?? $row->status;
        if (in_array($newStatus, ['approved', 'published'], true) && ! UserRoleHelper::canApproveContentCalendar($request->user())) {
            throw new AccessDeniedHttpException('Only SMM/Admin can approve or publish content.');
        }

        if (UserRoleHelper::isCommunityManager($request->user()) && ! UserRoleHelper::isAdmin($request->user()) && ! UserRoleHelper::isSmm($request->user())) {
            if (in_array($newStatus, ['approved', 'published'], true)) {
                throw new AccessDeniedHttpException('Community managers cannot publish or approve.');
            }
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'content_calendar.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['socialAccount', 'strategy', 'assignee']), 'Content item updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentCalendar::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'content_calendar.delete', null, $before, null);

        return ApiResponse::success(null, 'Content item deleted successfully.');
    }

    public function submitForReview(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentCalendar::query()->where('brand_id', $brandId)->findOrFail($id);
        SocialScope::assertCmCalendarAccess($request->user(), $row);
        $before = $row->toArray();

        if (! in_array($row->status, ['draft', 'planned', 'in_production'], true)) {
            abort(422, 'Ce contenu ne peut pas être soumis pour validation dans son état actuel.');
        }

        $row->status = 'review';
        $row->save();

        AuditLogger::log($request, 'content_calendar.submit_review', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success(
            $row->fresh()->load(['socialAccount', 'strategy', 'assignee', 'validatedByUser:id,name,email']),
            'Contenu soumis pour validation.'
        );
    }

    public function approveContent(Request $request, string $id): JsonResponse
    {
        if (! UserRoleHelper::canApproveContentCalendar($request->user())) {
            throw new AccessDeniedHttpException('Seuls le SMM ou l’admin peuvent valider le contenu.');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentCalendar::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        if ($row->status !== 'review') {
            abort(422, 'Seul un contenu en revue peut être approuvé.');
        }

        $row->status = 'approved';
        $row->validated_by = $request->user()?->id;
        $row->validated_at = now();
        $row->save();

        AuditLogger::log($request, 'content_calendar.approve', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success(
            $row->fresh()->load(['socialAccount', 'strategy', 'assignee', 'validatedByUser:id,name,email']),
            'Contenu approuvé.'
        );
    }

    public function requestRevision(Request $request, string $id): JsonResponse
    {
        if (! UserRoleHelper::canApproveContentCalendar($request->user())) {
            throw new AccessDeniedHttpException('Seuls le SMM ou l’admin peuvent demander des modifications.');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentCalendar::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        if ($row->status !== 'review') {
            abort(422, 'Les modifications ne peuvent être demandées que pour un contenu en revue.');
        }

        $row->status = 'in_production';
        $row->validated_by = null;
        $row->validated_at = null;
        $row->save();

        AuditLogger::log($request, 'content_calendar.request_revision', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success(
            $row->fresh()->load(['socialAccount', 'strategy', 'assignee', 'validatedByUser:id,name,email']),
            'Révision demandée au CM.'
        );
    }

    public function rejectContent(Request $request, string $id): JsonResponse
    {
        if (! UserRoleHelper::canApproveContentCalendar($request->user())) {
            throw new AccessDeniedHttpException('Seuls le SMM ou l’admin peuvent rejeter le contenu.');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ContentCalendar::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        if ($row->status !== 'review') {
            abort(422, 'Seul un contenu en revue peut être rejeté.');
        }

        $row->status = 'cancelled';
        $row->validated_by = $request->user()?->id;
        $row->validated_at = now();
        $row->save();

        AuditLogger::log($request, 'content_calendar.reject', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success(
            $row->fresh()->load(['socialAccount', 'strategy', 'assignee', 'validatedByUser:id,name,email']),
            'Contenu rejeté (annulé).'
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertForeignBrand(int $brandId, array $data): void
    {
        if (! empty($data['social_account_id'])) {
            $ok = SocialAccount::query()->where('brand_id', $brandId)->whereKey($data['social_account_id'])->exists();
            if (! $ok) {
                abort(422, 'Invalid social account for this brand.');
            }
        }
        if (! empty($data['strategy_id'])) {
            $ok = Strategy::query()->where('brand_id', $brandId)->whereKey($data['strategy_id'])->exists();
            if (! $ok) {
                abort(422, 'Invalid strategy for this brand.');
            }
        }
    }
}
