<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreSocialPublicationRequest;
use App\Http\Requests\Api\UpdateSocialPublicationRequest;
use App\Models\ContentCalendar;
use App\Models\SocialAccount;
use App\Models\SocialPublication;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SocialPublicationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $platform = $request->query('platform');
        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $q = SocialPublication::query()
            ->with(['contentCalendar:id,title,status', 'socialAccount:id,platform,account_name,handle'])
            ->where('brand_id', $brandId)
            ->orderByDesc('published_at')
            ->orderByDesc('id');
        if ($platform) {
            $q->where('platform', $platform);
        }
        if ($from) {
            $q->whereDate('published_at', '>=', $from);
        }
        if ($to) {
            $q->whereDate('published_at', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage), 'Publications retrieved successfully.');
    }

    public function store(StoreSocialPublicationRequest $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validated();
        $data['brand_id'] = $brandId;
        $data['source'] = $data['source'] ?? 'manual';

        $this->assertForeignBrand($brandId, $data);

        $row = SocialPublication::query()->create($data);

        AuditLogger::log($request, 'social_publications.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['contentCalendar', 'socialAccount']), 'Publication created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SocialPublication::query()
            ->with(['contentCalendar', 'socialAccount'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($row, 'Publication retrieved successfully.');
    }

    public function update(UpdateSocialPublicationRequest $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SocialPublication::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $data = $request->validated();
        $this->assertForeignBrand($brandId, $data);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'social_publications.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['contentCalendar', 'socialAccount']), 'Publication updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = SocialPublication::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'social_publications.delete', null, $before, null);

        return ApiResponse::success(null, 'Publication deleted successfully.');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertForeignBrand(int $brandId, array $data): void
    {
        if (! empty($data['content_calendar_id'])) {
            $ok = ContentCalendar::query()->where('brand_id', $brandId)->whereKey($data['content_calendar_id'])->exists();
            if (! $ok) {
                abort(422, 'Invalid content calendar item for this brand.');
            }
        }
        if (! empty($data['social_account_id'])) {
            $ok = SocialAccount::query()->where('brand_id', $brandId)->whereKey($data['social_account_id'])->exists();
            if (! $ok) {
                abort(422, 'Invalid social account for this brand.');
            }
        }
    }
}
