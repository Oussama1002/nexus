<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Influencer;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InfluencerController extends Controller
{
    private const STATUSES = [
        'reperee', 'qualifiee', 'contactee', 'en_discussion',
        'en_negociation', 'active', 'inactive', 'ecartee', 'exclue',
    ];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = Influencer::query();
        if ($brandId !== null) {
            $q->where(function ($q2) use ($brandId) {
                $q2->where('brand_id', $brandId)->orWhereNull('brand_id');
            });
        }
        $q->orderByDesc('id');

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($platform = $request->query('platform')) {
            $q->where('platform', $platform);
        }
        if ($search = $request->query('search')) {
            $q->where(function ($w) use ($search) {
                $w->where('full_name', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%");
            });
        }
        if ($request->query('excluded') === '1') {
            $q->where('status', 'exclue');
        } elseif ($request->query('excluded') === '0') {
            $q->where('status', '!=', 'exclue');
        }
        if ($from = $request->query('date_from')) {
            $q->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->query('date_to')) {
            $q->whereDate('created_at', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'full_name' => ['required', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'platform' => ['nullable', 'string', 'max:100'],
            'platforms_json' => ['nullable', 'array'],
            'niche' => ['nullable', 'string', 'max:255'],
            'bio' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:100'],
            'audience_size' => ['nullable', 'integer', 'min:0'],
            'engagement_rate' => ['nullable', 'numeric'],
            'pricing_json' => ['nullable', 'array'],
            'contact_phone' => ['nullable', 'string', 'max:30'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'social_links_json' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
            'source' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $data['brand_id'] = $data['brand_id'] ?? $brandId;
        $data['status'] = $data['status'] ?? 'reperee';

        $row = Influencer::query()->create($data);

        AuditLogger::log($request, 'influencers.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh(), 'Influenceuse créée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()
            ->with(['collaborations', 'performance', 'qualifiedByUser:id,name', 'excludedByUser:id,name', 'contactedByUser:id,name'])
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->findOrFail($id);

        $before = $row->toArray();

        $data = $request->validate([
            'full_name' => ['nullable', 'string', 'max:255'],
            'username' => ['nullable', 'string', 'max:255'],
            'platform' => ['nullable', 'string', 'max:100'],
            'platforms_json' => ['nullable', 'array'],
            'niche' => ['nullable', 'string', 'max:255'],
            'bio' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:100'],
            'audience_size' => ['nullable', 'integer', 'min:0'],
            'engagement_rate' => ['nullable', 'numeric'],
            'pricing_json' => ['nullable', 'array'],
            'contact_phone' => ['nullable', 'string', 'max:30'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'social_links_json' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
            'source' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencers.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Influenceuse mise à jour.');
    }

    public function qualify(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->findOrFail($id);

        $before = $row->toArray();

        $data = $request->validate([
            'qualification_json' => ['required', 'array'],
            'qualification_json.pertinence' => ['required', 'integer', 'min:1', 'max:5'],
            'qualification_json.autorite' => ['required', 'integer', 'min:1', 'max:5'],
            'qualification_json.engagement' => ['required', 'integer', 'min:1', 'max:5'],
            'qualification_json.regularite' => ['required', 'integer', 'min:1', 'max:5'],
            'qualification_json.homogeneite' => ['required', 'integer', 'min:1', 'max:5'],
            'qualification_json.saturation' => ['required', 'integer', 'min:1', 'max:5'],
            'qualification_json.reputation' => ['required', 'integer', 'min:1', 'max:5'],
            'qualification_json.creativite' => ['required', 'integer', 'min:1', 'max:5'],
        ]);

        $scores = $data['qualification_json'];
        $avg = round(array_sum($scores) / count($scores), 2);

        $row->qualification_json = $scores;
        $row->qualification_score = $avg;
        $row->qualified_at = now();
        $row->qualified_by = $request->user()->id;
        if ($row->status === 'reperee') {
            $row->status = 'qualifiee';
        }
        $row->save();

        AuditLogger::log($request, 'influencers.qualify', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Influenceuse qualifiée.');
    }

    public function exclude(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->findOrFail($id);

        $before = $row->toArray();

        $data = $request->validate([
            'exclusion_reason' => ['required', 'string'],
        ]);

        $row->status = 'exclue';
        $row->exclusion_reason = $data['exclusion_reason'];
        $row->excluded_at = now();
        $row->excluded_by = $request->user()->id;
        $row->save();

        AuditLogger::log($request, 'influencers.exclude', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Influenceuse exclue.');
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()
            ->where(function ($q) use ($brandId) {
                $q->where('brand_id', $brandId)->orWhereNull('brand_id');
            })
            ->findOrFail($id);

        $before = $row->toArray();

        $data = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'ecartee_reason' => ['nullable', 'required_if:status,ecartee', 'string'],
            'exclusion_reason' => ['nullable', 'required_if:status,exclue', 'string'],
        ]);

        $row->status = $data['status'];

        if ($data['status'] === 'ecartee' && ! empty($data['ecartee_reason'])) {
            $row->ecartee_reason = $data['ecartee_reason'];
        }
        if ($data['status'] === 'exclue' && ! empty($data['exclusion_reason'])) {
            $row->exclusion_reason = $data['exclusion_reason'];
            $row->excluded_at = now();
            $row->excluded_by = $request->user()->id;
        }
        if ($data['status'] === 'contactee') {
            $row->contacted_at = $row->contacted_at ?? now();
            $row->contacted_by = $row->contacted_by ?? $request->user()->id;
        }

        $row->save();

        AuditLogger::log($request, 'influencers.update_status', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Statut mis à jour.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Influencer::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencers.delete', null, $before, null);

        return ApiResponse::success(null, 'Influenceuse supprimée.');
    }
}
