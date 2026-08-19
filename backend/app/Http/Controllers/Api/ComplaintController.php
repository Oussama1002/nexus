<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Complaint;
use App\Models\ComplaintThreadEntry;
use App\Services\AuditLogger;
use App\Services\CmNotificationService;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use App\Support\UserRoleHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class ComplaintController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);

        $q = Complaint::query()->with(['brand', 'sourceUser:id,name,email', 'assignedUser:id,name,email']);
        if ($brandId !== null) {
            $q->where('brand_id', $brandId);
        }

        $user = $request->user();
        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user)) {
            $q->where('source_user_id', $user->id);
        }

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($priority = $request->query('priority')) {
            $q->where('priority', $priority);
        }
        if ($sourceUserId = $request->query('source_user_id')) {
            $q->where('source_user_id', (int) $sourceUserId);
        }

        $q->orderByDesc('created_at');

        return ApiResponse::success($q->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $user = $request->user();

        $data = $request->validate([
            'customer_name' => 'required|string|max:255',
            'customer_phone' => 'nullable|string|max:50',
            'customer_handle' => 'nullable|string|max:255',
            'channel' => 'required|string|max:100',
            'category' => 'required|string|max:100',
            'priority' => 'required|string|in:P1,P2,P3',
            'description' => 'required|string',
        ]);

        $data['brand_id'] = $brandId;
        $data['source_user_id'] = $user->id;
        $data['source'] = 'community_manager';
        $data['status'] = 'nouvelle';
        $data['reference'] = 'REC-' . strtoupper(uniqid());

        $row = Complaint::create($data);

        AuditLogger::log($request, 'complaint.create', $row, null, $row->toArray());

        CmNotificationService::complaintCreatedFromCm($brandId, $row->id, $row->reference, $row->customer_name);

        return ApiResponse::success(
            $row->fresh()->load(['brand', 'sourceUser:id,name,email']),
            'Réclamation créée.',
            201
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Complaint::query()
            ->with(['brand', 'sourceUser:id,name,email', 'assignedUser:id,name,email', 'threadEntries.author:id,name,email'])
            ->where('brand_id', $brandId)
            ->findOrFail($id);

        $this->assertAccess($request->user(), $row);

        return ApiResponse::success($row);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Complaint::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->assertAccess($request->user(), $row);
        $before = $row->toArray();
        $user = $request->user();

        $isCm = UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user);

        if ($isCm) {
            $data = $request->validate([
                'priority' => 'nullable|string|in:P1,P2,P3',
                'customer_name' => 'nullable|string|max:255',
                'customer_phone' => 'nullable|string|max:50',
                'customer_handle' => 'nullable|string|max:255',
            ]);

            if (isset($data['status'])) {
                throw new AccessDeniedHttpException('Le CM ne peut pas modifier le statut.');
            }
        } else {
            $data = $request->validate([
                'status' => 'nullable|string|in:nouvelle,assignée,en_traitement,résolue,clôturée',
                'priority' => 'nullable|string|in:P1,P2,P3',
                'assigned_user_id' => 'nullable|integer|exists:users,id',
                'resolution_notes' => 'nullable|string',
                'customer_name' => 'nullable|string|max:255',
                'customer_phone' => 'nullable|string|max:50',
                'customer_handle' => 'nullable|string|max:255',
            ]);
        }

        $changedFields = [];
        foreach ($data as $field => $value) {
            if ($value !== null && $row->{$field} != $value) {
                $changedFields[$field] = ['old' => $row->{$field}, 'new' => $value];
            }
        }

        $newStatus = $data['status'] ?? $row->status;
        if (in_array($newStatus, ['résolue'], true) && empty($data['resolution_notes']) && empty($row->resolution_notes)) {
            abort(422, 'Les notes de résolution sont requises pour résoudre.');
        }
        if ($newStatus === 'résolue' && $row->status !== 'résolue') {
            $data['resolved_at'] = now();
        }
        if ($newStatus === 'clôturée' && $row->status !== 'clôturée') {
            $data['closed_at'] = now();
        }

        $row->fill($data);
        $row->save();

        if (count($changedFields) > 0 && $isCm) {
            foreach ($changedFields as $field => $change) {
                ComplaintThreadEntry::create([
                    'complaint_id' => $row->id,
                    'author_user_id' => $user->id,
                    'entry_type' => 'changement_de_champ',
                    'content' => "$field : {$change['old']} → {$change['new']}",
                ]);
            }
        }

        AuditLogger::log($request, 'complaint.update', $row, $before, $row->fresh()->toArray());

        if (isset($changedFields['status']) && $row->source_user_id) {
            CmNotificationService::complaintStatusChanged($brandId, $row->source_user_id, $row->id, $row->reference, $newStatus);
        }

        return ApiResponse::success(
            $row->fresh()->load(['brand', 'sourceUser:id,name,email', 'assignedUser:id,name,email']),
            'Réclamation mise à jour.'
        );
    }

    // ─── Thread ───

    public function threadEntries(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Complaint::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->assertAccess($request->user(), $row);

        $entries = $row->threadEntries()->with('author:id,name,email')->get();

        return ApiResponse::success($entries);
    }

    public function addThreadEntry(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = Complaint::query()->where('brand_id', $brandId)->findOrFail($id);
        $this->assertAccess($request->user(), $row);
        $user = $request->user();

        if (in_array($row->status, ['clôturée'], true)) {
            abort(422, 'Le fil est en lecture seule pour une réclamation clôturée.');
        }

        $data = $request->validate([
            'content' => 'required|string',
            'entry_type' => 'nullable|string|in:message,demande_information,réponse',
        ]);

        $entry = ComplaintThreadEntry::create([
            'complaint_id' => $row->id,
            'author_user_id' => $user->id,
            'entry_type' => $data['entry_type'] ?? 'message',
            'content' => $data['content'],
        ]);

        AuditLogger::log($request, 'complaint_thread.create', $entry, null, $entry->toArray());

        return ApiResponse::success(
            $entry->fresh()->load('author:id,name,email'),
            'Message ajouté.',
            201
        );
    }

    private function assertAccess($user, Complaint $row): void
    {
        if (UserRoleHelper::isCommunityManager($user) && ! UserRoleHelper::isAdmin($user)) {
            if ((int) $row->source_user_id !== (int) $user->id) {
                abort(404);
            }
        }
    }
}
