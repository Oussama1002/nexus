<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Influencer;
use App\Models\InfluencerCollaboration;
use App\Models\InfluencerValidationRequest;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class InfluencerCollaborationController extends Controller
{
    private const STATUSES = [
        'brouillon', 'en_attente_validation', 'refusee', 'en_preparation',
        'en_cours', 'en_revue', 'en_pause', 'contractualisation_en_attente',
        'contractualisee', 'terminee', 'arretee',
    ];

    private const COLLAB_TYPES = ['story', 'reel', 'post', 'live', 'video', 'package', 'ambassador'];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = InfluencerCollaboration::query()
            ->with(['influencer:id,full_name,username,platform,status', 'campaign:id,name', 'owner:id,name']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('id');

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($influencerId = $request->query('influencer_id')) {
            $q->where('influencer_id', (int) $influencerId);
        }
        if ($search = $request->query('search')) {
            $q->where(function ($w) use ($search) {
                $w->where('title', 'like', "%{$search}%")
                    ->orWhereHas('influencer', fn ($i) => $i->where('full_name', 'like', "%{$search}%"));
            });
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
            'influencer_id' => ['required', 'integer', 'exists:influencers,id'],
            'campaign_id' => ['nullable', 'integer', 'exists:campaigns,id'],
            'owner_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'objectives' => ['nullable', 'string'],
            'collaboration_type' => ['required', Rule::in(self::COLLAB_TYPES)],
            'deliverables' => ['nullable', 'string'],
            'contract_url' => ['nullable', 'string', 'max:500'],
            'brief_url' => ['nullable', 'string', 'max:500'],
            'agreed_amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'status' => ['nullable', Rule::in(self::STATUSES)],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = $data['status'] ?? 'brouillon';
        $data['owner_user_id'] = $data['owner_user_id'] ?? $request->user()->id;

        $this->assertInfluencerBrandScope($brandId, (int) $data['influencer_id']);

        $row = InfluencerCollaboration::query()->create($data);

        AuditLogger::log($request, 'influencer_collaborations.create', $row, null, $row->toArray());

        return ApiResponse::success(
            $row->fresh()->load(['influencer:id,full_name,username,platform', 'campaign:id,name', 'owner:id,name']),
            'Collaboration créée.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()
            ->with([
                'influencer', 'campaign:id,name', 'owner:id,name',
                'deliverableItems', 'shipments', 'payments',
                'v1DecidedByUser:id,name', 'v2DecidedByUser:id,name', 'v4DecidedByUser:id,name',
                'reviewedByUser:id,name',
            ])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'influencer_id' => ['nullable', 'integer', 'exists:influencers,id'],
            'campaign_id' => ['nullable', 'integer', 'exists:campaigns,id'],
            'owner_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'objectives' => ['nullable', 'string'],
            'collaboration_type' => ['nullable', Rule::in(self::COLLAB_TYPES)],
            'deliverables' => ['nullable', 'string'],
            'contract_url' => ['nullable', 'string', 'max:500'],
            'brief_url' => ['nullable', 'string', 'max:500'],
            'agreed_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'onboarding_notes' => ['nullable', 'string'],
            'review_notes' => ['nullable', 'string'],
            'review_rating' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        if (isset($data['influencer_id'])) {
            $this->assertInfluencerBrandScope($brandId, (int) $data['influencer_id']);
        }

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_collaborations.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success(
            $row->fresh()->load(['influencer:id,full_name,username,platform', 'campaign:id,name', 'owner:id,name']),
            'Collaboration mise à jour.'
        );
    }

    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'pause_reason' => ['nullable', 'required_if:status,en_pause', 'string'],
            'stop_reason' => ['nullable', 'required_if:status,arretee', 'string'],
            'refuse_reason' => ['nullable', 'required_if:status,refusee', 'string'],
        ]);

        $row->status = $data['status'];

        if ($data['status'] === 'en_pause' && ! empty($data['pause_reason'])) {
            $row->pause_reason = $data['pause_reason'];
        }
        if ($data['status'] === 'arretee' && ! empty($data['stop_reason'])) {
            $row->stop_reason = $data['stop_reason'];
        }
        if ($data['status'] === 'refusee' && ! empty($data['refuse_reason'])) {
            $row->refuse_reason = $data['refuse_reason'];
        }

        $row->save();

        AuditLogger::log($request, 'influencer_collaborations.update_status', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer:id,full_name,username,platform']), 'Statut collaboration mis à jour.');
    }

    public function requestValidation(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'validation_type' => ['required', Rule::in(['V1', 'V2', 'V4'])],
            'comment' => ['nullable', 'string'],
        ]);

        $vType = $data['validation_type'];
        $prefix = strtolower($vType);
        $user = $request->user();

        $row->{$prefix . '_status'} = 'en_attente';
        $row->{$prefix . '_requested_by'} = $user->id;
        $row->{$prefix . '_requested_at'} = now();

        if ($vType === 'V1') {
            $row->status = 'en_attente_validation';
        } elseif ($vType === 'V2') {
            $row->status = 'contractualisation_en_attente';
        }

        $row->save();

        InfluencerValidationRequest::create([
            'brand_id' => $brandId,
            'validation_type' => $vType,
            'entity_type' => 'influencer_collaboration',
            'entity_id' => $row->id,
            'requested_by' => $user->id,
            'requested_at' => now(),
            'context_json' => ['comment' => $data['comment'] ?? null],
        ]);

        AuditLogger::log($request, "influencer_collaborations.request_{$prefix}", $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), "Demande de validation {$vType} envoyée.");
    }

    public function decideValidation(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->where('brand_id', $brandId)->findOrFail($id);

        if (! UserRoleHelper::canApproveCollaborations($request->user())) {
            throw new AccessDeniedHttpException('Seul le manager opérationnel peut valider.');
        }

        $before = $row->toArray();

        $data = $request->validate([
            'validation_type' => ['required', Rule::in(['V1', 'V2', 'V4'])],
            'decision' => ['required', Rule::in(['approuve', 'refuse'])],
            'comment' => ['nullable', 'string'],
        ]);

        $vType = $data['validation_type'];
        $prefix = strtolower($vType);
        $user = $request->user();

        $row->{$prefix . '_status'} = $data['decision'];
        $row->{$prefix . '_decided_by'} = $user->id;
        $row->{$prefix . '_decided_at'} = now();
        $row->{$prefix . '_comment'} = $data['comment'] ?? null;

        if ($data['decision'] === 'approuve') {
            if ($vType === 'V1') {
                $row->status = 'en_preparation';
            } elseif ($vType === 'V2') {
                $row->status = 'contractualisee';
            } elseif ($vType === 'V4') {
                $row->status = 'terminee';
            }
        } else {
            if ($vType === 'V1') {
                $row->status = 'refusee';
                $row->refuse_reason = $data['comment'] ?? null;
            } elseif ($vType === 'V2') {
                $row->status = 'en_revue';
            } elseif ($vType === 'V4') {
                $row->status = 'en_cours';
            }
        }

        $row->save();

        $vr = InfluencerValidationRequest::query()
            ->where('entity_type', 'influencer_collaboration')
            ->where('entity_id', $row->id)
            ->where('validation_type', $vType)
            ->whereNull('decided_by')
            ->latest()
            ->first();

        if ($vr) {
            $vr->update([
                'decided_by' => $user->id,
                'decided_at' => now(),
                'decision' => $data['decision'],
                'comment' => $data['comment'] ?? null,
            ]);
        }

        AuditLogger::log($request, "influencer_collaborations.decide_{$prefix}", $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), "Validation {$vType} : {$data['decision']}.");
    }

    public function submitReview(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'review_notes' => ['required', 'string'],
            'review_rating' => ['required', 'integer', 'min:1', 'max:5'],
        ]);

        $row->review_notes = $data['review_notes'];
        $row->review_rating = $data['review_rating'];
        $row->reviewed_at = now();
        $row->reviewed_by = $request->user()->id;
        $row->status = 'en_revue';
        $row->save();

        AuditLogger::log($request, 'influencer_collaborations.submit_review', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Revue soumise.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerCollaboration::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_collaborations.delete', null, $before, null);

        return ApiResponse::success(null, 'Collaboration supprimée.');
    }

    private function assertInfluencerBrandScope(int $brandId, int $influencerId): void
    {
        $inf = Influencer::query()->findOrFail($influencerId);
        if ($inf->brand_id !== null && (int) $inf->brand_id !== $brandId) {
            abort(422, 'Cette influenceuse n\'appartient pas à cette marque.');
        }
    }
}
