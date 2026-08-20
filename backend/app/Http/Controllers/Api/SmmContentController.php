<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmmBrief;
use App\Models\SmmContent;
use App\Models\SmmContentRevision;
use App\Models\SmmContentVersion;
use App\Models\SmmPublicationSlip;
use App\Models\SmmQcChecklist;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmmContentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = SmmContent::query()
            ->with(['pillar:id,label', 'assignedTo:id,name', 'author:id,name'])
            ->orderByDesc('scheduled_publish_at')->orderByDesc('id');

        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($platform = $request->query('platform')) $q->where('platform', $platform);
        if ($format = $request->query('format')) $q->where('format', $format);
        if ($pillar = $request->query('pillar_id')) $q->where('pillar_id', (int) $pillar);
        if ($assigned = $request->query('assigned_user_id')) $q->where('assigned_user_id', (int) $assigned);
        if ($event = $request->query('event_id')) $q->where('event_id', (int) $event);
        if ($request->boolean('sensitive_only')) $q->where('is_sensitive', true);
        if ($request->boolean('late_only')) {
            $q->whereNotIn('status', ['publie', 'annule', 'non_publie'])
                ->whereNotNull('scheduled_publish_at')
                ->where('scheduled_publish_at', '<', now());
        }
        if ($from = $request->query('from')) $q->where('scheduled_publish_at', '>=', $from);
        if ($to = $request->query('to')) $q->where('scheduled_publish_at', '<=', $to);
        if ($search = $request->query('search')) $q->where('title', 'like', "%{$search}%");

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'monthly_plan_id' => ['nullable', 'integer', 'exists:smm_monthly_plans,id'],
            'pillar_id' => ['required', 'integer', 'exists:smm_content_pillars,id'],
            'event_id' => ['nullable', 'integer'],
            'source_content_id' => ['nullable', 'integer', 'exists:smm_contents,id'],
            'title' => ['required', 'string', 'max:255'],
            'concept' => ['nullable', 'string'],
            'platform' => ['required', 'string', 'max:40'],
            'format' => ['required', 'string', 'max:40'],
            'finality' => ['nullable', 'string', 'max:40'],
            'angle' => ['nullable', 'string', 'max:100'],
            'persona_id' => ['nullable', 'integer'],
            'social_account' => ['nullable', 'string', 'max:100'],
            'production_mode' => ['nullable', 'string', 'max:30'],
            'assigned_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'production_due_at' => ['nullable', 'date'],
            'scheduled_publish_at' => ['nullable', 'date'],
            'is_sensitive' => ['nullable', 'boolean'],
            'sensitivity_reason' => ['nullable', 'string', 'max:60'],
        ]);
        $data['brand_id'] = $brandId;
        $data['author_user_id'] = $request->user()->id;
        $data['status'] = 'a_briefer';
        $row = SmmContent::query()->create($data);
        $row->file_identifier = $this->buildFileIdentifier($row);
        $row->save();
        AuditLogger::log($request, 'smm_content.create', $row);
        return ApiResponse::success($row->fresh(), 'Contenu créé.', 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()
            ->with(['pillar', 'assignedTo:id,name', 'author:id,name', 'validatedBy:id,name',
                'brief', 'versions.uploadedBy:id,name', 'revisions.author:id,name',
                'qcChecklist', 'publicationSlip', 'performances', 'automations', 'insights'])
            ->findOrFail($id);
        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        if (in_array($row->status, ['publie', 'annule'], true)) {
            return ApiResponse::error('Contenu verrouillé.', null, 422);
        }
        $before = $row->toArray();
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'concept' => ['nullable', 'string'],
            'platform' => ['nullable', 'string', 'max:40'],
            'format' => ['nullable', 'string', 'max:40'],
            'finality' => ['nullable', 'string', 'max:40'],
            'angle' => ['nullable', 'string', 'max:100'],
            'persona_id' => ['nullable', 'integer'],
            'social_account' => ['nullable', 'string', 'max:100'],
            'production_mode' => ['nullable', 'string', 'max:30'],
            'assigned_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'production_due_at' => ['nullable', 'date'],
            'scheduled_publish_at' => ['nullable', 'date'],
            'is_sensitive' => ['nullable', 'boolean'],
            'sensitivity_reason' => ['nullable', 'string', 'max:60'],
        ]);
        $row->fill($data);
        $row->file_identifier = $this->buildFileIdentifier($row);
        $row->save();
        AuditLogger::log($request, 'smm_content.update', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    // ─── Brief ───

    public function upsertBrief(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        $data = $request->validate([
            'concept_intention' => ['nullable', 'string'],
            'objective_result' => ['nullable', 'string'],
            'copy_text' => ['nullable', 'string'],
            'script' => ['nullable', 'string'],
            'expected_structure' => ['nullable', 'string'],
            'visual_direction' => ['nullable', 'string'],
            'editing_structure' => ['nullable', 'string'],
            'raw_material' => ['nullable', 'string'],
            'technical_instructions' => ['nullable', 'string'],
            'references_text' => ['nullable', 'string'],
            'mandatory_info' => ['nullable', 'string'],
            'call_to_action' => ['nullable', 'string'],
        ]);
        $brief = SmmBrief::query()->updateOrCreate(['content_id' => $row->id], $data);
        AuditLogger::log($request, 'smm_brief.upsert', $brief);
        return ApiResponse::success($brief);
    }

    public function markBriefed(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->with('brief')->findOrFail($id);
        if (!$row->brief) return ApiResponse::error('Aucun brief.', null, 422);
        // Required brief fields per mode
        $mode = $row->production_mode ?? 'interne_smm';
        $required = ['concept_intention', 'objective_result', 'expected_structure', 'call_to_action'];
        if (in_array($mode, ['graphiste', 'interne_smm'], true)) {
            $required = array_merge($required, ['copy_text', 'visual_direction']);
        }
        if ($mode === 'monteur') {
            $required = array_merge($required, ['script', 'editing_structure', 'raw_material', 'technical_instructions']);
        }
        foreach ($required as $field) {
            if (empty($row->brief->{$field})) {
                return ApiResponse::error("Champ brief obligatoire manquant: {$field}", null, 422);
            }
        }
        $row->status = 'briefe';
        $row->briefed_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_content.briefed', $row);
        return ApiResponse::success($row->fresh());
    }

    public function acknowledgeReception(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        if ($row->status !== 'briefe') return ApiResponse::error('État invalide.', null, 422);
        $row->status = 'en_production';
        $row->save();
        AuditLogger::log($request, 'smm_content.ack_reception', $row);
        return ApiResponse::success($row->fresh());
    }

    // ─── Versions & Revisions ───

    public function uploadVersion(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        $data = $request->validate([
            'file_url' => ['required', 'string', 'max:500'],
            'file_type' => ['nullable', 'string', 'max:60'],
            'file_size' => ['nullable', 'integer'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['content_id'] = $row->id;
        $data['uploaded_by_user_id'] = $request->user()->id;
        $data['version_number'] = SmmContentVersion::query()->where('content_id', $row->id)->max('version_number') + 1;
        $v = SmmContentVersion::query()->create($data);
        if ($row->status === 'en_production' || $row->status === 'briefe') {
            $row->status = 'en_revision';
            $row->save();
        }
        AuditLogger::log($request, 'smm_content.version', $v);
        return ApiResponse::success($v, 'Version déposée.', 201);
    }

    public function addRevision(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        $data = $request->validate([
            'version_id' => ['nullable', 'integer', 'exists:smm_content_versions,id'],
            'feedback' => ['required', 'string'],
        ]);
        $data['content_id'] = $row->id;
        $data['author_user_id'] = $request->user()->id;
        $r = SmmContentRevision::query()->create($data);
        $row->increment('revision_rounds');
        AuditLogger::log($request, 'smm_content.revision', $r);
        return ApiResponse::success($r, 'Retour de révision ajouté.', 201);
    }

    // ─── QC ───

    public function runQc(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        $data = $request->validate([
            'items_json' => ['required', 'array'],
        ]);
        $allChecked = collect($data['items_json'])->every(fn ($it) => !empty($it['checked']));
        $qc = SmmQcChecklist::query()->updateOrCreate(
            ['content_id' => $row->id],
            [
                'items_json' => $data['items_json'],
                'is_complete' => $allChecked,
                'completed_at' => $allChecked ? now() : null,
                'completed_by_user_id' => $request->user()->id,
            ],
        );
        AuditLogger::log($request, 'smm_content.qc', $qc);
        return ApiResponse::success($qc);
    }

    // ─── Validation ───

    public function validateAction(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->with('qcChecklist')->findOrFail($id);
        if (!$row->qcChecklist || !$row->qcChecklist->is_complete) {
            return ApiResponse::error('Checklist de contrôle qualité non complète.', null, 422);
        }
        // Sensitive → route to Direction first
        if ($row->is_sensitive && $row->status !== 'a_valider_direction') {
            $row->status = 'a_valider_direction';
            $row->save();
            AuditLogger::log($request, 'smm_content.to_direction', $row);
            return ApiResponse::success($row->fresh(), 'Contenu sensible envoyé en validation Direction.');
        }
        if ($row->author_user_id === $request->user()->id && !$row->is_sensitive) {
            return ApiResponse::error('Un même utilisateur ne peut pas être auteur et validateur.', null, 422);
        }
        $row->status = 'valide';
        $row->validated_at = now();
        $row->validated_by_user_id = $request->user()->id;
        $row->save();
        AuditLogger::log($request, 'smm_content.validate', $row);
        return ApiResponse::success($row->fresh(), 'Contenu validé.');
    }

    public function directionValidate(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        if ($row->status !== 'a_valider_direction') return ApiResponse::error('Non en attente Direction.', null, 422);
        $row->status = 'valide';
        $row->validated_at = now();
        $row->validated_by_user_id = $request->user()->id;
        $row->save();
        AuditLogger::log($request, 'smm_content.direction_validate', $row);
        return ApiResponse::success($row->fresh(), 'Validation Direction enregistrée.');
    }

    // ─── Publication slip + transmit ───

    public function upsertSlip(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        $data = $request->validate([
            'platform' => ['required', 'string', 'max:40'],
            'publish_at' => ['required', 'date'],
            'caption' => ['nullable', 'string'],
            'call_to_action' => ['nullable', 'string'],
            'hashtags' => ['nullable', 'string'],
            'story_instructions' => ['nullable', 'string'],
            'specific_instructions' => ['nullable', 'string'],
            'sensitive_topics_watch' => ['nullable', 'string'],
            'linked_automation_ids_json' => ['nullable', 'array'],
        ]);
        $data['content_id'] = $row->id;
        // Fiche is complete if publish_at + caption present
        $data['is_complete'] = !empty($data['caption']) && !empty($data['publish_at']);
        $slip = SmmPublicationSlip::query()->updateOrCreate(['content_id' => $row->id], $data);
        AuditLogger::log($request, 'smm_slip.upsert', $slip);
        return ApiResponse::success($slip);
    }

    public function transmit(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->with('publicationSlip')->findOrFail($id);
        if ($row->status !== 'valide') return ApiResponse::error('Le contenu doit être validé avant transmission.', null, 422);
        if (!$row->publicationSlip || !$row->publicationSlip->is_complete) {
            return ApiResponse::error('Fiche de publication incomplète.', null, 422);
        }
        $row->status = 'transmis_cm';
        $row->transmitted_at = now();
        $row->save();
        AuditLogger::log($request, 'smm_content.transmit', $row);
        return ApiResponse::success($row->fresh(), 'Transmis au Community Manager.');
    }

    // ─── Publication state (CM only) ───

    public function setPublished(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        if ($row->status !== 'transmis_cm') return ApiResponse::error('Non transmis.', null, 422);
        $data = $request->validate([
            'published_platform_id' => ['nullable', 'string', 'max:191'],
        ]);
        $row->status = 'publie';
        $row->published_at = now();
        $row->published_platform_id = $data['published_platform_id'] ?? null;
        $row->save();
        AuditLogger::log($request, 'smm_content.published', $row);
        return ApiResponse::success($row->fresh(), 'Contenu marqué publié.');
    }

    public function setNotPublished(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        $data = $request->validate(['not_published_reason' => ['required', 'string']]);
        $row->status = 'non_publie';
        $row->not_published_reason = $data['not_published_reason'];
        $row->save();
        AuditLogger::log($request, 'smm_content.not_published', $row);
        return ApiResponse::success($row->fresh());
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $row = SmmContent::query()->findOrFail($id);
        $data = $request->validate(['cancellation_reason' => ['required', 'string']]);
        $row->status = 'annule';
        $row->cancellation_reason = $data['cancellation_reason'];
        $row->save();
        AuditLogger::log($request, 'smm_content.cancel', $row);
        return ApiResponse::success($row->fresh());
    }

    // ─── Helpers ───

    private function buildFileIdentifier(SmmContent $c): string
    {
        $date = $c->scheduled_publish_at ? $c->scheduled_publish_at->format('Ymd') : now()->format('Ymd');
        $platform = ucfirst(strtolower($c->platform ?? 'x'));
        $type = ucfirst(strtolower($c->format ?? 'x'));
        $slug = preg_replace('/[^A-Za-z0-9]+/', '', $c->title ?? 'sans_titre');
        $slug = substr($slug, 0, 30);
        $status = ucfirst($c->status ?? 'brouillon');
        return "{$date}_{$platform}_{$type}_{$slug}_{$status}";
    }
}
