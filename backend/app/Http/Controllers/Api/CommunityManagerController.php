<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChecklistTemplate;
use App\Models\CmDecisionPoint;
use App\Models\CmNotification;
use App\Models\DailyChecklist;
use App\Models\DailyChecklistItem;
use App\Models\InfluencerContentLog;
use App\Models\InfluencerSignal;
use App\Models\ModerationAction;
use App\Services\AuditLogger;
use App\Services\CmAutomationService;
use App\Services\CmNotificationService;
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

        $q = DailyChecklist::query()->with(['items', 'cmUser', 'template']);
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
        if ($cmUserId = $request->query('cm_user_id')) {
            $q->where('cm_user_id', (int) $cmUserId);
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
            'template_id' => 'nullable|integer|exists:checklist_templates,id',
            'items' => 'required|array|min:1',
            'items.*.label' => 'required|string|max:255',
            'items.*.category' => 'nullable|string|max:100',
            'items.*.task_type' => 'nullable|string|in:publication,moderation,veille,reporting,custom',
            'items.*.scheduled_time' => 'nullable|date_format:H:i',
            'items.*.platform' => 'nullable|string|max:50',
            'items.*.content_item_id' => 'nullable|integer|exists:content_calendar,id',
            'items.*.notes' => 'nullable|string',
        ]);

        $checklist = DailyChecklist::create([
            'brand_id' => $brandId,
            'cm_user_id' => $user->id,
            'work_date' => $data['work_date'],
            'status' => 'en_cours',
            'notes' => $data['notes'] ?? null,
            'template_id' => $data['template_id'] ?? null,
        ]);

        foreach ($data['items'] as $item) {
            $checklist->items()->create([
                'label' => $item['label'],
                'category' => $item['category'] ?? null,
                'task_type' => $item['task_type'] ?? 'custom',
                'scheduled_time' => $item['scheduled_time'] ?? null,
                'platform' => $item['platform'] ?? null,
                'content_item_id' => $item['content_item_id'] ?? null,
                'status' => 'pending',
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
            ->with(['items.contentItem', 'cmUser', 'validatedByUser', 'closedByUser', 'template'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        // CM spec §14.3 rule 1 — a CM can only see their own checklist,
        // even if they know another CM's id.
        $user = $request->user();
        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user)
            && (int) $checklist->cm_user_id !== (int) $user->id) {
            throw new AccessDeniedHttpException('Accès refusé : cette checklist ne vous appartient pas.');
        }

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

        if ($newStatus === 'soumis' && $checklist->status !== $before['status']) {
            $checklist->recalculateRates();
            CmNotificationService::checklistSubmitted($brandId, $checklist->cm_user_id, $checklist->id, $user->name);
        }

        if ($newStatus === 'validé') {
            $checklist->validated_by = $user->id;
            $checklist->validated_at = now();
            $checklist->closed_at = now();
            $checklist->closed_by_user_id = $user->id;
            CmNotificationService::checklistValidated($brandId, $checklist->cm_user_id, $checklist->id, $user->name);
        }

        if ($newStatus === 'rejeté') {
            CmNotificationService::checklistRejected($brandId, $checklist->cm_user_id, $checklist->id, $user->name, $data['rejection_reason'] ?? '');
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

        if ($item->is_completed) {
            $item->status = 'completed';
            if ($item->scheduled_time) {
                $scheduled = Carbon::parse($item->scheduled_time);
                $now = Carbon::now();
                $delayMinutes = $scheduled->diffInMinutes($now, false);
                $item->delay_minutes = max(0, (int) $delayMinutes);
            }
        } else {
            $item->status = 'pending';
            $item->delay_minutes = null;
        }

        $item->save();

        $checklist->recalculateRates();
        $checklist->save();

        return ApiResponse::success($item->fresh(), 'Item mis à jour.');
    }

    public function updateChecklistItem(Request $request, string $checklistId, string $itemId): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $checklist = DailyChecklist::query()->where('brand_id', $brandId)->findOrFail($checklistId);

        $user = $request->user();
        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user)) {
            if ((int) $checklist->cm_user_id !== (int) $user->id) {
                throw new AccessDeniedHttpException('Vous ne pouvez modifier que vos propres items.');
            }
        }

        $item = DailyChecklistItem::query()->where('daily_checklist_id', $checklistId)->findOrFail($itemId);

        $data = $request->validate([
            'status' => 'nullable|string|in:pending,in_progress,completed,skipped,late',
            'justification' => 'nullable|string',
            'comment' => 'nullable|string',
        ]);

        if (isset($data['status'])) {
            $item->status = $data['status'];
            if ($data['status'] === 'completed' && ! $item->is_completed) {
                $item->is_completed = true;
                $item->completed_at = now();
            }
            if ($data['status'] === 'skipped') {
                $item->is_completed = false;
                $item->completed_at = null;
            }
        }

        if (isset($data['justification'])) {
            $item->justification = $data['justification'];
        }
        if (isset($data['comment'])) {
            $item->comment = $data['comment'];
        }

        $item->save();

        $checklist->recalculateRates();
        $checklist->save();

        return ApiResponse::success($item->fresh(), 'Item mis à jour.');
    }

    // ─── Moderation ───

    public function indexModeration(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = ModerationAction::query()->with(['cmUser', 'complaint']);
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
            'account_handle' => 'nullable|string|max:255',
            'public_comment_deleted' => 'nullable|boolean',
            'message_sent' => 'nullable|boolean',
            'complaint_id' => 'nullable|integer|exists:complaints,id',
            'screenshot_url' => 'nullable|string|max:500',
            'action_date' => 'required|date',
        ]);

        // CM spec §13 modération rule 3 — screenshot is the sole evidence
        // when a public comment has been deleted; refuse without it.
        $isCommentDeletion = ($data['action_type'] ?? '') === 'commentaire_supprimé'
            || !empty($data['public_comment_deleted']);
        if ($isCommentDeletion && empty($data['screenshot_url'])) {
            return ApiResponse::error(
                'Une capture d\'écran est obligatoire pour un commentaire supprimé (le commentaire public disparaît, la capture reste la seule preuve).',
                ['screenshot_url' => ['Capture obligatoire.']],
                422,
            );
        }

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
            ->with(['cmUser', 'socialAccount', 'complaint'])
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
        if ($request->query('no_publication') !== null) {
            $q->where('no_publication', (bool) $request->query('no_publication'));
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
            'content_type' => 'required|string|in:story,post,reel,video,vidéo,live',
            'platform' => 'required|string|max:50',
            'content_url' => 'nullable|string|max:500',
            'screenshot_url' => 'nullable|string|max:500',
            'published_at' => 'nullable|date',
            'notes' => 'nullable|string',
            'live_duration_minutes' => 'nullable|integer|min:0',
            'live_viewers_count' => 'nullable|integer|min:0',
            'cm_assisted_live' => 'nullable|boolean',
            'live_recording_archived' => 'nullable|boolean',
            'no_publication' => 'nullable|boolean',
            'quantity' => 'nullable|integer|min:1',
            'archive_url' => 'nullable|string|max:500',
            'archived' => 'nullable|boolean',
        ]);

        // CM spec §13 influenceurs rule 3 — no_publication is mutually
        // exclusive with content saisi.
        if (!empty($data['no_publication']) && (!empty($data['content_url']) || !empty($data['quantity']))) {
            return ApiResponse::error(
                '« Aucune publication » est incompatible avec la saisie d\'un contenu.',
                null, 422,
            );
        }

        // CM spec §13 influenceurs rule 4 — archive_url required when archived=true.
        if (!empty($data['archived']) && empty($data['archive_url'])) {
            return ApiResponse::error(
                'Le lien d\'archive est obligatoire lorsque le contenu est marqué archivé.',
                ['archive_url' => ['Lien d\'archive obligatoire.']], 422,
            );
        }

        // CM spec §13 influenceurs rule 5 — Live-type content requires all
        // three live-specific fields.
        if (($data['content_type'] ?? '') === 'live') {
            $missing = [];
            if (!isset($data['live_duration_minutes'])) $missing[] = 'live_duration_minutes';
            if (!isset($data['cm_assisted_live'])) $missing[] = 'cm_assisted_live';
            if (!isset($data['live_recording_archived'])) $missing[] = 'live_recording_archived';
            if ($missing) {
                return ApiResponse::error(
                    'Champs Live obligatoires manquants : ' . implode(', ', $missing) . '.',
                    array_fill_keys($missing, ['Requis pour un Live.']), 422,
                );
            }
        }

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

        // CM-A4: auto-create complaint from critical signal
        if ($data['severity'] === 'critique') {
            CmAutomationService::autoComplaintFromCriticalSignal($brandId, $row);
        }

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

        if ($data['status'] === 'escaladé') {
            CmNotificationService::signalEscalated(
                $brandId,
                $row->id,
                $row->influencer?->full_name ?? "Influenceur #{$row->influencer_id}",
                $row->signal_type,
            );
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

        $unreadNotifications = CmNotification::query()
            ->where('brand_id', $brandId)
            ->where('recipient_user_id', $user->id)
            ->where('is_read', false)
            ->count();

        return ApiResponse::success([
            'checklist_completion_percent' => $checklistCompletion,
            'moderation_actions_today' => $moderationCount,
            'pending_signals' => $pendingSignals,
            'publications_today' => $publicationsToday,
            'unread_notifications' => $unreadNotifications,
        ]);
    }

    // ─── Notifications ───

    public function indexNotifications(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $user = $request->user();
        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);

        $q = CmNotification::query()
            ->where('recipient_user_id', $user->id)
            ->orderByDesc('created_at');

        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }

        if ($request->query('unread_only') === '1') {
            $q->where('is_read', false);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    public function markNotificationRead(Request $request, string $id): JsonResponse
    {
        $notification = CmNotification::query()
            ->where('recipient_user_id', $request->user()->id)
            ->findOrFail($id);

        $notification->is_read = true;
        $notification->read_at = now();
        $notification->save();

        return ApiResponse::success($notification, 'Notification lue.');
    }

    public function markAllNotificationsRead(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        CmNotification::query()
            ->where('recipient_user_id', $request->user()->id)
            ->where('brand_id', $brandId)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        return ApiResponse::success(null, 'Toutes les notifications marquées comme lues.');
    }

    // ─── Templates ───

    public function indexTemplates(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        $templates = ChecklistTemplate::query()
            ->where('brand_id', $brandId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return ApiResponse::success($templates);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        if (! UserRoleHelper::canValidateCmDaily($request->user())) {
            throw new AccessDeniedHttpException('Seuls les SMM/Admin peuvent gérer les templates.');
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'items_json' => 'required|array|min:1',
            'items_json.*.label' => 'required|string|max:255',
            'items_json.*.category' => 'nullable|string|max:100',
            'items_json.*.task_type' => 'nullable|string|in:publication,moderation,veille,reporting,custom',
            'items_json.*.scheduled_time' => 'nullable|date_format:H:i',
            'items_json.*.platform' => 'nullable|string|max:50',
            'is_default' => 'nullable|boolean',
        ]);

        $data['brand_id'] = $brandId;

        if (! empty($data['is_default'])) {
            ChecklistTemplate::query()
                ->where('brand_id', $brandId)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $template = ChecklistTemplate::create($data);

        return ApiResponse::success($template, 'Template créé.', 201);
    }

    public function updateTemplate(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        if (! UserRoleHelper::canValidateCmDaily($request->user())) {
            throw new AccessDeniedHttpException('Seuls les SMM/Admin peuvent gérer les templates.');
        }

        $template = ChecklistTemplate::query()->where('brand_id', $brandId)->findOrFail($id);

        $data = $request->validate([
            'name' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'items_json' => 'nullable|array|min:1',
            'items_json.*.label' => 'required|string|max:255',
            'items_json.*.category' => 'nullable|string|max:100',
            'items_json.*.task_type' => 'nullable|string|in:publication,moderation,veille,reporting,custom',
            'items_json.*.scheduled_time' => 'nullable|date_format:H:i',
            'items_json.*.platform' => 'nullable|string|max:50',
            'is_default' => 'nullable|boolean',
            'is_active' => 'nullable|boolean',
        ]);

        if (! empty($data['is_default'])) {
            ChecklistTemplate::query()
                ->where('brand_id', $brandId)
                ->where('id', '!=', $template->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $template->fill($data);
        $template->save();

        return ApiResponse::success($template->fresh(), 'Template mis à jour.');
    }

    public function deleteTemplate(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);

        if (! UserRoleHelper::canValidateCmDaily($request->user())) {
            throw new AccessDeniedHttpException('Seuls les SMM/Admin peuvent gérer les templates.');
        }

        $template = ChecklistTemplate::query()->where('brand_id', $brandId)->findOrFail($id);
        $template->is_active = false;
        $template->save();

        return ApiResponse::success(null, 'Template désactivé.');
    }

    // ─── Decision Points ───

    public function indexDecisionPoints(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = CmDecisionPoint::query()->with('cmUser:id,name');
        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }
        $q->orderByDesc('created_at');

        if ($code = $request->query('decision_code')) {
            $q->where('decision_code', $code);
        }

        return ApiResponse::success($q->paginate($perPage));
    }

    // ─── Run automations (admin endpoint) ───

    public function runAutomations(Request $request): JsonResponse
    {
        if (! UserRoleHelper::isAdmin($request->user())) {
            throw new AccessDeniedHttpException('Admin uniquement.');
        }

        $brandId = ApiBrandContext::resolveBrandId($request);
        $results = CmAutomationService::runAllScheduled($brandId);

        return ApiResponse::success($results, 'Automatisations exécutées.');
    }
}
