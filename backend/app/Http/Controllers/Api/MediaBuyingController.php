<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdAccount;
use App\Models\Campaign;
use App\Models\MediaBuyingEntry;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MediaBuyingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 30), 1), 100);
        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $format = trim((string) $request->query('format', ''));
        $winningOnly = filter_var((string) $request->query('winning_only', ''), FILTER_VALIDATE_BOOLEAN);

        $q = MediaBuyingEntry::query()
            ->with(['campaign:id,name', 'adAccount:id,account_name', 'sourceEntry:id,title,angle']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('repurpose_priority')
            ->orderByDesc('id');

        if ($status !== '') {
            $q->where('status', $status);
        }
        if ($format !== '') {
            $q->where('format', $format);
        }
        if ($winningOnly) {
            $q->where('status', 'winning');
        }
        if ($search !== '') {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('title', 'like', $s)
                    ->orWhere('angle', 'like', $s)
                    ->orWhere('script', 'like', $s)
                    ->orWhere('hook', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Media buying entries retrieved successfully.');
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $this->validatePayload($request, $brandId);
        $data['brand_id'] = $brandId;
        $entry = MediaBuyingEntry::query()->create($data);
        AuditLogger::log($request, 'media_buying.create', $entry, null, $entry->toArray());

        return ApiResponse::success($entry->fresh(['campaign:id,name', 'adAccount:id,account_name', 'sourceEntry:id,title,angle']), 'Media buying entry created successfully.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $entry = MediaBuyingEntry::query()
            ->where('brand_id', $brandId)
            ->with(['campaign:id,name', 'adAccount:id,account_name', 'sourceEntry:id,title,angle'])
            ->findOrFail($id);

        return ApiResponse::success($entry, 'Media buying entry retrieved successfully.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $entry = MediaBuyingEntry::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $entry->toArray();
        $data = $this->validatePayload($request, $brandId, true);
        $entry->fill($data);
        $entry->save();
        AuditLogger::log($request, 'media_buying.update', $entry, $before, $entry->fresh()->toArray());

        return ApiResponse::success($entry->fresh(['campaign:id,name', 'adAccount:id,account_name', 'sourceEntry:id,title,angle']), 'Media buying entry updated successfully.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $entry = MediaBuyingEntry::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $entry->toArray();
        $entry->delete();
        AuditLogger::log($request, 'media_buying.delete', null, $before, null);

        return ApiResponse::success(null, 'Media buying entry deleted successfully.');
    }

    public function repurpose(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $source = MediaBuyingEntry::query()->where('brand_id', $brandId)->findOrFail($id);
        $payload = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'campaign_id' => ['nullable', 'integer'],
            'ad_account_id' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);
        if (! empty($payload['campaign_id'])) {
            Campaign::query()->where('brand_id', $brandId)->findOrFail((int) $payload['campaign_id']);
        }
        if (! empty($payload['ad_account_id'])) {
            AdAccount::query()->where('brand_id', $brandId)->findOrFail((int) $payload['ad_account_id']);
        }

        $new = MediaBuyingEntry::query()->create([
            'brand_id' => $brandId,
            'campaign_id' => isset($payload['campaign_id']) ? (int) $payload['campaign_id'] : $source->campaign_id,
            'ad_account_id' => isset($payload['ad_account_id']) ? (int) $payload['ad_account_id'] : $source->ad_account_id,
            'source_entry_id' => $source->id,
            'title' => trim((string) ($payload['title'] ?? '')) ?: $source->title.' (repurpose)',
            'angle' => $source->angle,
            'format' => $source->format,
            'hook' => $source->hook,
            'script' => $source->script,
            'cta' => $source->cta,
            'asset_url' => $source->asset_url,
            'external_ad_id' => null,
            'status' => 'testing',
            'tested_at' => null,
            'spend' => 0,
            'revenue' => 0,
            'leads' => 0,
            'confirmed_orders' => 0,
            'cpa' => null,
            'ctr' => null,
            'roas' => null,
            'repurpose_priority' => max((int) $source->repurpose_priority, 1),
            'repurpose_notes' => trim((string) ($payload['notes'] ?? '')) ?: $source->repurpose_notes,
            'is_repurposed' => true,
        ]);

        AuditLogger::log($request, 'media_buying.repurpose', $new, null, [
            'source_entry_id' => $source->id,
            'new_entry_id' => $new->id,
        ]);

        return ApiResponse::success($new->fresh(['campaign:id,name', 'adAccount:id,account_name', 'sourceEntry:id,title,angle']), 'Winning ad repurposed into a new testing variation.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, int $brandId, bool $partial = false): array
    {
        $rules = [
            'campaign_id' => [$partial ? 'sometimes' : 'nullable', 'nullable', 'integer'],
            'ad_account_id' => [$partial ? 'sometimes' : 'nullable', 'nullable', 'integer'],
            'title' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'angle' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'format' => ['nullable', 'string', 'max:80'],
            'hook' => ['nullable', 'string'],
            'script' => ['nullable', 'string'],
            'cta' => ['nullable', 'string', 'max:255'],
            'asset_url' => ['nullable', 'url', 'max:2048'],
            'external_ad_id' => ['nullable', 'string', 'max:128'],
            'status' => ['nullable', 'in:testing,winning,losing,archived'],
            'tested_at' => ['nullable', 'date'],
            'spend' => ['nullable', 'numeric', 'min:0'],
            'revenue' => ['nullable', 'numeric', 'min:0'],
            'leads' => ['nullable', 'integer', 'min:0'],
            'confirmed_orders' => ['nullable', 'integer', 'min:0'],
            'cpa' => ['nullable', 'numeric', 'min:0'],
            'ctr' => ['nullable', 'numeric', 'min:0'],
            'roas' => ['nullable', 'numeric', 'min:0'],
            'traffic_source' => ['nullable', 'in:organic,sponsored'],
            'organic_reach' => ['nullable', 'integer', 'min:0'],
            'organic_impressions' => ['nullable', 'integer', 'min:0'],
            'organic_engagement' => ['nullable', 'numeric', 'min:0'],
            'organic_clicks' => ['nullable', 'integer', 'min:0'],
            'sponsored_reach' => ['nullable', 'integer', 'min:0'],
            'sponsored_impressions' => ['nullable', 'integer', 'min:0'],
            'sponsored_engagement' => ['nullable', 'numeric', 'min:0'],
            'sponsored_clicks' => ['nullable', 'integer', 'min:0'],
            'repurpose_priority' => ['nullable', 'integer', 'min:0', 'max:10'],
            'repurpose_notes' => ['nullable', 'string'],
            'is_repurposed' => ['nullable', 'boolean'],
        ];
        $data = $request->validate($rules);

        if (! empty($data['campaign_id'])) {
            Campaign::query()->where('brand_id', $brandId)->findOrFail((int) $data['campaign_id']);
        }
        if (! empty($data['ad_account_id'])) {
            AdAccount::query()->where('brand_id', $brandId)->findOrFail((int) $data['ad_account_id']);
        }

        return $data;
    }
}
