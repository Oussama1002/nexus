<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InfluencerPayment;
use App\Models\InfluencerValidationRequest;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class InfluencerPaymentController extends Controller
{
    private const NATURES = ['remuneration', 'bonus', 'commission'];

    private const STATUSES = [
        'brouillon', 'en_attente_validation_n1', 'valide_n1',
        'en_attente_validation_n2', 'valide_n2', 'paye', 'rejete',
    ];

    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = InfluencerPayment::query()
            ->with(['collaboration:id,title', 'influencer:id,full_name,username', 'createdByUser:id,name']);
        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        $q->orderByDesc('id');

        if ($collaborationId = $request->query('collaboration_id')) {
            $q->where('collaboration_id', (int) $collaborationId);
        }
        if ($influencerId = $request->query('influencer_id')) {
            $q->where('influencer_id', (int) $influencerId);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($nature = $request->query('nature')) {
            $q->where('nature', $nature);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'collaboration_id' => ['required', 'integer', 'exists:influencer_collaborations,id'],
            'influencer_id' => ['required', 'integer', 'exists:influencers,id'],
            'nature' => ['required', Rule::in(self::NATURES)],
            'amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['created_by'] = $request->user()->id;
        $data['status'] = 'brouillon';
        $data['reference'] = 'PAY-' . strtoupper(uniqid());

        $row = InfluencerPayment::query()->create($data);

        AuditLogger::log($request, 'influencer_payments.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['collaboration:id,title', 'influencer:id,full_name']), 'Paiement créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPayment::query()
            ->with([
                'collaboration:id,title', 'influencer:id,full_name,username',
                'createdByUser:id,name', 'v3N1DecidedByUser:id,name', 'v3N2DecidedByUser:id,name',
            ])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPayment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'nature' => ['nullable', Rule::in(self::NATURES)],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'proof_url' => ['nullable', 'string', 'max:500'],
            'notes' => ['nullable', 'string'],
        ]);

        $row->fill($data);
        $row->save();

        AuditLogger::log($request, 'influencer_payments.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Paiement mis à jour.');
    }

    public function submitForValidation(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPayment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        if (! in_array($row->status, ['brouillon', 'rejete'], true)) {
            abort(422, 'Ce paiement ne peut pas être soumis pour validation.');
        }

        $row->status = 'en_attente_validation_n1';
        $row->save();

        InfluencerValidationRequest::create([
            'brand_id' => $brandId,
            'validation_type' => 'V3',
            'entity_type' => 'influencer_payment',
            'entity_id' => $row->id,
            'requested_by' => $request->user()->id,
            'requested_at' => now(),
        ]);

        AuditLogger::log($request, 'influencer_payments.submit_validation', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Paiement soumis pour validation N1.');
    }

    public function validateN1(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPayment::query()->where('brand_id', $brandId)->findOrFail($id);

        if (! UserRoleHelper::canApproveCollaborations($request->user())) {
            throw new AccessDeniedHttpException('Non autorisé à valider les paiements N1.');
        }

        $before = $row->toArray();

        $data = $request->validate([
            'decision' => ['required', Rule::in(['approuve', 'refuse'])],
            'comment' => ['nullable', 'string'],
        ]);

        $row->v3_n1_status = $data['decision'];
        $row->v3_n1_decided_by = $request->user()->id;
        $row->v3_n1_decided_at = now();
        $row->v3_n1_comment = $data['comment'] ?? null;

        if ($data['decision'] === 'approuve') {
            $row->status = 'en_attente_validation_n2';
        } else {
            $row->status = 'rejete';
            $row->rejection_reason = $data['comment'] ?? null;
        }

        $row->save();

        AuditLogger::log($request, 'influencer_payments.validate_n1', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), "Validation N1 : {$data['decision']}.");
    }

    public function validateN2(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPayment::query()->where('brand_id', $brandId)->findOrFail($id);

        if (! UserRoleHelper::isAdmin($request->user())) {
            throw new AccessDeniedHttpException('Seul l\'admin / responsable financier peut valider N2.');
        }

        $before = $row->toArray();

        $data = $request->validate([
            'decision' => ['required', Rule::in(['approuve', 'refuse'])],
            'comment' => ['nullable', 'string'],
        ]);

        $row->v3_n2_status = $data['decision'];
        $row->v3_n2_decided_by = $request->user()->id;
        $row->v3_n2_decided_at = now();
        $row->v3_n2_comment = $data['comment'] ?? null;

        if ($data['decision'] === 'approuve') {
            $row->status = 'valide_n2';
        } else {
            $row->status = 'rejete';
            $row->rejection_reason = $data['comment'] ?? null;
        }

        $row->save();

        AuditLogger::log($request, 'influencer_payments.validate_n2', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), "Validation N2 : {$data['decision']}.");
    }

    public function markPaid(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPayment::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        if ($row->status !== 'valide_n2') {
            abort(422, 'Le paiement doit être validé N2 avant d\'être marqué payé.');
        }

        $data = $request->validate([
            'paid_at' => ['nullable', 'date'],
            'proof_url' => ['nullable', 'string', 'max:500'],
        ]);

        $row->status = 'paye';
        $row->paid_at = $data['paid_at'] ?? now()->toDateString();
        if (! empty($data['proof_url'])) {
            $row->proof_url = $data['proof_url'];
        }
        $row->save();

        AuditLogger::log($request, 'influencer_payments.mark_paid', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Paiement marqué comme payé.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerPayment::query()->where('brand_id', $brandId)->findOrFail($id);

        if (! in_array($row->status, ['brouillon', 'rejete'], true)) {
            abort(422, 'Seuls les paiements en brouillon ou rejetés peuvent être supprimés.');
        }

        $before = $row->toArray();
        $row->delete();

        AuditLogger::log($request, 'influencer_payments.delete', null, $before, null);

        return ApiResponse::success(null, 'Paiement supprimé.');
    }
}
