<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmContentPillar;
use App\Models\SmmStrategy;
use App\Models\SmmStrategyContribution;
use App\Services\AuditLogger;
use App\Services\Smm\SmmNotificationService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmStrategyController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = SmmStrategy::query()
            ->with(['author:id,name', 'validatedBy:id,name'])
            ->withCount(['pillars', 'contributions', 'monthlyPlans'])
            ->orderByDesc('year')->orderByDesc('quarter');

        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($year = $request->query('year')) $q->where('year', (int) $year);

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $data = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'quarter' => ['required', 'integer', 'min:1', 'max:4'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'social_objectives' => ['required', 'string'],
            'business_objectives' => ['required', 'string'],
            'brand_stage' => ['nullable', 'string', 'max:40'],
            'platforms_json' => ['nullable', 'array'],
            'platform_roles_json' => ['nullable', 'array'],
            'personas_json' => ['nullable', 'array'],
            'finalities_json' => ['nullable', 'array'],
            'angles_json' => ['nullable', 'array'],
            'tone_of_voice' => ['nullable', 'string'],
            'priority_formats_json' => ['nullable', 'array'],
            'publication_frequency_json' => ['nullable', 'array'],
            'kpi_targets_json' => ['nullable', 'array'],
            'quarter_priorities' => ['nullable', 'string'],
        ]);

        $data['brand_id'] = $brandId;
        $data['status'] = 'brouillon';
        $data['author_user_id'] = $request->user()->id;

        $row = SmmStrategy::query()->create($data);
        AuditLogger::log($request, 'smm_strategy.create', $row, null, $row->toArray());
        return ApiResponse::success($row->fresh(), 'Stratégie créée.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = SmmStrategy::query()
            ->with(['author:id,name', 'validatedBy:id,name', 'pillars', 'contributions.contributor:id,name'])
            ->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = SmmStrategy::query()->findOrFail($id);
        if (in_array($row->status, ['validee'], true)) {
            return ApiResponse::error('Une stratégie validée ne peut pas être modifiée.', null, 422);
        }
        $before = $row->toArray();
        $data = $request->validate([
            'social_objectives' => ['nullable', 'string'],
            'business_objectives' => ['nullable', 'string'],
            'brand_stage' => ['nullable', 'string', 'max:40'],
            'platforms_json' => ['nullable', 'array'],
            'platform_roles_json' => ['nullable', 'array'],
            'personas_json' => ['nullable', 'array'],
            'finalities_json' => ['nullable', 'array'],
            'angles_json' => ['nullable', 'array'],
            'tone_of_voice' => ['nullable', 'string'],
            'priority_formats_json' => ['nullable', 'array'],
            'publication_frequency_json' => ['nullable', 'array'],
            'kpi_targets_json' => ['nullable', 'array'],
            'quarter_priorities' => ['nullable', 'string'],
        ]);
        $row->fill($data)->save();
        AuditLogger::log($request, 'smm_strategy.update', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    public function submit(Request $request, string $id): JsonResponse
    {
        $row = SmmStrategy::query()->with('pillars', 'contributions')->findOrFail($id);
        if ($row->status !== 'brouillon' && $row->status !== 'modification_demandee') {
            return ApiResponse::error('Stratégie non soumissible.', null, 422);
        }
        // Validate: at least one contribution recorded
        if ($row->contributions->where('received_at', '!=', null)->count() === 0) {
            return ApiResponse::error('Aucune contribution enregistrée. Sollicitez au moins un contributeur.', null, 422);
        }
        // Validate: every pillar has business_objective
        foreach ($row->pillars as $p) {
            if (empty($p->business_objective)) {
                return ApiResponse::error("Le pilier « {$p->label} » n'est pas relié à un objectif business.", null, 422);
            }
        }
        // Validate: platforms have role + audience
        $roles = (array) ($row->platform_roles_json ?? []);
        $personas = (array) ($row->personas_json ?? []);
        foreach ((array) ($row->platforms_json ?? []) as $p) {
            if (empty($roles[$p] ?? null) || empty($personas[$p] ?? null)) {
                return ApiResponse::error("La plateforme {$p} n'a pas de rôle ou d'audience.", null, 422);
            }
        }
        // Validate: KPIs have target
        foreach ((array) ($row->kpi_targets_json ?? []) as $k) {
            if (!isset($k['target']) || $k['target'] === '' || $k['target'] === null) {
                return ApiResponse::error('Un KPI est sans valeur cible.', null, 422);
            }
        }

        $row->status = 'soumise';
        $row->submitted_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_strategy.submit', $row);
        SmmNotificationService::notifyDirection(
            $row->brand_id, 'strategy_submitted', 'Stratégie soumise',
            "T{$row->quarter} {$row->year} attend une décision.",
            ['strategy_id' => $row->id], 'smm_strategy', $row->id,
        );
        return ApiResponse::success($row->fresh(), 'Stratégie soumise.');
    }

    public function validateAction(Request $request, string $id): JsonResponse
    {
        $row = SmmStrategy::query()->findOrFail($id);
        if ($row->status !== 'soumise') return ApiResponse::error('Stratégie non validable dans son état actuel.', null, 422);
        if ($row->author_user_id === $request->user()->id) return ApiResponse::error('Un même utilisateur ne peut pas être auteur et validateur.', null, 422);
        $data = $request->validate(['validation_comment' => ['nullable', 'string']]);
        $row->status = 'validee';
        $row->validated_by_user_id = $request->user()->id;
        $row->validated_at = now();
        $row->validation_comment = $data['validation_comment'] ?? null;
        $row->save();
        AuditLogger::log($request, 'smm_strategy.validate', $row);
        // Broadcast: SMM + Media Buyer + Content Manager + CM (spec §10)
        SmmNotificationService::notifySmmAndOps(
            $row->brand_id, 'strategy_validated', 'Stratégie validée',
            "T{$row->quarter} {$row->year} est validée. Vous pouvez démarrer le plan mensuel.",
            ['strategy_id' => $row->id], 'smm_strategy', $row->id,
        );
        return ApiResponse::success($row->fresh(), 'Stratégie validée.');
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $row = SmmStrategy::query()->findOrFail($id);
        if ($row->status !== 'soumise') return ApiResponse::error('Non rejetable.', null, 422);
        $data = $request->validate(['rejection_reason' => ['required', 'string']]);
        $row->status = 'rejetee';
        $row->rejection_reason = $data['rejection_reason'];
        $row->save();
        AuditLogger::log($request, 'smm_strategy.reject', $row);
        // "Décision sur une stratégie" → Manager OPS
        SmmNotificationService::notifyManagerOps(
            $row->brand_id, 'strategy_rejected', 'Stratégie rejetée',
            "T{$row->quarter} {$row->year} — motif : {$row->rejection_reason}",
            ['strategy_id' => $row->id], 'smm_strategy', $row->id,
        );
        return ApiResponse::success($row->fresh(), 'Stratégie rejetée.');
    }

    public function requestModification(Request $request, string $id): JsonResponse
    {
        $row = SmmStrategy::query()->findOrFail($id);
        if ($row->status !== 'soumise') return ApiResponse::error('Non modifiable dans son état actuel.', null, 422);
        $data = $request->validate(['rejection_reason' => ['required', 'string']]);
        $row->status = 'modification_demandee';
        $row->rejection_reason = $data['rejection_reason'];
        $row->save();
        AuditLogger::log($request, 'smm_strategy.request_modification', $row);
        return ApiResponse::success($row->fresh(), 'Modification demandée.');
    }

    // ─── Contributions ───

    public function solicitContribution(Request $request, string $id): JsonResponse
    {
        $row = SmmStrategy::query()->findOrFail($id);
        $data = $request->validate([
            'contributor_user_id' => ['required', 'integer', 'exists:users,id'],
            'role_at_time' => ['nullable', 'string', 'max:40'],
        ]);
        $c = SmmStrategyContribution::query()->updateOrCreate(
            ['strategy_id' => $row->id, 'contributor_user_id' => $data['contributor_user_id']],
            ['role_at_time' => $data['role_at_time'] ?? null, 'requested_at' => now()],
        );
        AuditLogger::log($request, 'smm_strategy.solicit', $c);
        SmmNotificationService::notifyUser(
            (int) $data['contributor_user_id'], $row->brand_id, 'contribution_requested',
            'Contribution sollicitée', "Votre contribution est demandée sur T{$row->quarter} {$row->year}.",
            ['strategy_id' => $row->id], 'smm_strategy', $row->id,
        );
        return ApiResponse::success($c);
    }

    public function recordContribution(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'contribution' => ['required', 'string'],
        ]);
        $c = SmmStrategyContribution::query()
            ->where('strategy_id', $id)
            ->where('contributor_user_id', $request->user()->id)
            ->firstOrFail();
        $c->contribution = $data['contribution'];
        $c->received_at = now();
        $c->save();
        AuditLogger::log($request, 'smm_strategy.contribution', $c);
        return ApiResponse::success($c);
    }

    // ─── Pillars ───

    public function storePillar(Request $request, string $strategyId): JsonResponse
    {
        $strategy = SmmStrategy::query()->findOrFail($strategyId);
        $data = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'business_objective' => ['required', 'string'],
            'target_share_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'formats_json' => ['nullable', 'array'],
        ]);
        $data['strategy_id'] = $strategy->id;
        $data['brand_id'] = $strategy->brand_id;
        $p = SmmContentPillar::query()->create($data);
        AuditLogger::log($request, 'smm_pillar.create', $p);
        return ApiResponse::success($p, 'Pilier créé.', 201);
    }

    public function updatePillar(Request $request, string $strategyId, string $pillarId): JsonResponse
    {
        $p = SmmContentPillar::query()->where('strategy_id', $strategyId)->findOrFail($pillarId);
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'business_objective' => ['nullable', 'string'],
            'target_share_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'formats_json' => ['nullable', 'array'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $p->fill($data)->save();
        AuditLogger::log($request, 'smm_pillar.update', $p);
        return ApiResponse::success($p->fresh());
    }

    public function destroyPillar(Request $request, string $strategyId, string $pillarId): JsonResponse
    {
        $p = SmmContentPillar::query()->where('strategy_id', $strategyId)->findOrFail($pillarId);
        $p->delete();
        AuditLogger::log($request, 'smm_pillar.delete', null, ['id' => $pillarId]);
        return ApiResponse::success(null, 'Pilier supprimé.');
    }
}
