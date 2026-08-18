<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DailyChecklist;
use App\Models\DailyChecklistItem;
use App\Models\InfluencerContentLog;
use App\Models\InfluencerSignal;
use App\Models\ModerationAction;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\UserRoleHelper;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class CommunityManagerController extends Controller
{
    // ─── Checklists ───

    public function indexChecklists(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = DailyChecklist::query()->with(['items', 'cmUser']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('work_date');

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($from = $request->query('date_from')) {
            $q->whereDate('work_date', '>=', $from);
        }
        if ($to = $request->query('date_to')) {
            $q->whereDate('work_date', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function storeChecklist(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();

        $data = $request->validate([
            'work_date' => 'required|date',
            'notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.label' => 'required|string|max:255',
            'items.*.category' => 'nullable|string|max:100',
            'items.*.notes' => 'nullable|string',
        ]);

        $checklist = DailyChecklist::create([
            'brand_id' => $brandId,
            'cm_user_id' => $user->id,
            'work_date' => $data['work_date'],
            'status' => 'en_cours',
            'notes' => $data['notes'] ?? null,
        ]);

        foreach ($data['items'] as $item) {
            $checklist->items()->create([
                'label' => $item['label'],
                'category' => $item['category'] ?? null,
                'notes' => $item['notes'] ?? null,
            ]);
        }

        AuditLogger::log($request, 'daily_checklist.create', $checklist, null, $checklist->toArray());

        return ApiResponse::success($checklist->fresh()->load(['items', 'cmUser']), 'Checklist created.', 201);
    }

    public function showChecklist(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $checklist = DailyChecklist::query()
            ->with(['items', 'cmUser', 'validatedByUser'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($checklist);
    }

    public function updateChecklist(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $checklist = DailyChecklist::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $checklist->toArray();
        $user = $request->user();

        $data = $request->validate([
            'status' => 'nullable|string|in:en_cours,soumis,validé,rejeté',
            'rejection_reason' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user)) {
            if ((int) $checklist->cm_user_id !== (int) $user->id) {
                throw new AccessDeniedHttpException('Vous ne pouvez modifier que vos propres checklists.');
            }
        }

        $newStatus = $data['status'] ?? $checklist->status;
        if (in_array($newStatus, ['validé', 'rejeté'], true) && ! UserRoleHelper::canValidateCmDaily($user)) {
            throw new AccessDeniedHttpException('Seuls les SMM/Admin peuvent valider ou rejeter.');
        }

        $checklist->fill($data);

        if ($newStatus === 'validé') {
            $checklist->validated_by = $user->id;
            $checklist->validated_at = now();
        }

        $checklist->save();

        AuditLogger::log($request, 'daily_checklist.update', $checklist, $before, $checklist->fresh()->toArray());

        return ApiResponse::success($checklist->fresh()->load(['items', 'cmUser']), 'Checklist mise à jour.');
    }

    public function toggleChecklistItem(Request $request, string $checklistId, string $itemId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $checklist = DailyChecklist::query()->where('brand_id', $brandId)->findOrFail($checklistId);

        $user = $request->user();
        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user)) {
            if ((int) $checklist->cm_user_id !== (int) $user->id) {
                throw new AccessDeniedHttpException('Vous ne pouvez modifier que vos propres items.');
            }
        }

        $item = DailyChecklistItem::query()
            ->where('daily_checklist_id', $checklistId)
            ->findOrFail($itemId);

        $item->is_completed = ! $item->is_completed;
        $item->completed_at = $item->is_completed ? now() : null;
        $item->save();

        return ApiResponse::success($item->fresh(), 'Item mis à jour.');
    }

    // ─── Moderation ───

    public function indexModeration(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = ModerationAction::query()->with(['cmUser']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('action_date');

        if ($platform = $request->query('platform')) {
            $q->where('platform', $platform);
        }
        if ($actionType = $request->query('action_type')) {
            $q->where('action_type', $actionType);
        }
        if ($from = $request->query('date_from')) {
            $q->whereDate('action_date', '>=', $from);
        }
        if ($to = $request->query('date_to')) {
            $q->whereDate('action_date', '<=', $to);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function storeModeration(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();

        $data = $request->validate([
            'social_account_id' => 'nullable|integer|exists:social_accounts,id',
            'platform' => 'nullable|string|max:50',
            'action_type' => 'required|string|in:commentaire_supprimé,commentaire_masqué,message_envoyé,avis_signalé,ban_utilisateur,autre',
            'description' => 'nullable|string',
            'screenshot_url' => 'nullable|string|max:500',
            'action_date' => 'required|date',
        ]);

        $data['brand_id'] = $brandId;
        $data['cm_user_id'] = $user->id;

        $row = ModerationAction::create($data);

        AuditLogger::log($request, 'moderation_action.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load('cmUser'), 'Action de modération enregistrée.', 201);
    }

    public function showModeration(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = ModerationAction::query()
            ->with(['cmUser', 'socialAccount'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        return ApiResponse::success($row);
    }

    // ─── Influencer Content Logs ───

    public function indexInfluencerContent(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = InfluencerContentLog::query()->with(['influencer', 'cmUser']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('published_at');

        if ($influencerId = $request->query('influencer_id')) {
            $q->where('influencer_id', (int) $influencerId);
        }
        if ($platform = $request->query('platform')) {
            $q->where('platform', $platform);
        }
        if ($contentType = $request->query('content_type')) {
            $q->where('content_type', $contentType);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function storeInfluencerContent(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();

        $data = $request->validate([
            'influencer_id' => 'required|integer|exists:influencers,id',
            'collaboration_id' => 'nullable|integer|exists:influencer_collaborations,id',
            'content_type' => 'required|string|in:story,post,reel,vidéo,live',
            'platform' => 'required|string|max:50',
            'content_url' => 'nullable|string|max:500',
            'screenshot_url' => 'nullable|string|max:500',
            'published_at' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $data['brand_id'] = $brandId;
        $data['cm_user_id'] = $user->id;

        $row = InfluencerContentLog::create($data);

        AuditLogger::log($request, 'influencer_content_log.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer', 'cmUser']), 'Contenu influenceur enregistré.', 201);
    }

    public function archiveInfluencerContent(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = InfluencerContentLog::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $row->is_archived = true;
        $row->save();

        AuditLogger::log($request, 'influencer_content_log.archive', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh(), 'Contenu archivé.');
    }

    // ─── Influencer Signals ───

    public function indexSignals(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = InfluencerSignal::query()->with(['influencer', 'cmUser']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('created_at');

        if ($signalType = $request->query('signal_type')) {
            $q->where('signal_type', $signalType);
        }
        if ($severity = $request->query('severity')) {
            $q->where('severity', $severity);
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function storeSignal(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();

        $data = $request->validate([
            'influencer_id' => 'required|integer|exists:influencers,id',
            'signal_type' => 'required|string|in:retard,contenu_non_conforme,injoignable,comportement,autre',
            'severity' => 'nullable|string|in:faible,moyen,élevé,critique',
            'description' => 'required|string',
        ]);

        $data['brand_id'] = $brandId;
        $data['cm_user_id'] = $user->id;
        $data['status'] = 'ouvert';
        $data['severity'] = $data['severity'] ?? 'moyen';

        $row = InfluencerSignal::create($data);

        AuditLogger::log($request, 'influencer_signal.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer', 'cmUser']), 'Signal créé.', 201);
    }

    public function updateSignalStatus(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();
        $row = InfluencerSignal::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'status' => 'required|string|in:ouvert,en_traitement,résolu,escaladé',
        ]);

        if (in_array($data['status'], ['résolu', 'escaladé'], true) && ! UserRoleHelper::canValidateCmDaily($user)) {
            throw new AccessDeniedHttpException('Seuls les SMM/Admin peuvent résoudre ou escalader.');
        }

        $row->status = $data['status'];

        if ($data['status'] === 'résolu') {
            $row->resolved_by = $user->id;
            $row->resolved_at = now();
        }

        $row->save();

        AuditLogger::log($request, 'influencer_signal.status_update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh()->load(['influencer', 'cmUser']), 'Statut du signal mis à jour.');
    }

    // ─── Dashboard ───

    public function dailySummary(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();
        $today = Carbon::today();

        $checklist = DailyChecklist::query()
            ->where('brand_id', $brandId)
            ->where('cm_user_id', $user->id)
            ->whereDate('work_date', $today)
            ->with('items')
            ->first();

        $checklistCompletion = 0;
        if ($checklist && $checklist->items->count() > 0) {
            $checklistCompletion = round(
                ($checklist->items->where('is_completed', true)->count() / $checklist->items->count()) * 100
            );
        }

        $moderationCount = ModerationAction::query()
            ->where('brand_id', $brandId)
            ->where('cm_user_id', $user->id)
            ->whereDate('action_date', $today)
            ->count();

        $pendingSignals = InfluencerSignal::query()
            ->where('brand_id', $brandId)
            ->whereIn('status', ['ouvert', 'en_traitement'])
            ->count();

        $publicationsToday = InfluencerContentLog::query()
            ->where('brand_id', $brandId)
            ->where('cm_user_id', $user->id)
            ->whereDate('published_at', $today)
            ->count();

        return ApiResponse::success([
            'checklist_completion_percent' => $checklistCompletion,
            'moderation_actions_today' => $moderationCount,
            'pending_signals' => $pendingSignals,
            'publications_today' => $publicationsToday,
        ]);
    }
}
