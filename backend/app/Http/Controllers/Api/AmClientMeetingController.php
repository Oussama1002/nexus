<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmClientMeeting;
use App\Models\AmMeetingAction;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmClientMeetingController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmClientMeeting::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->with(['actions'])
            ->orderByDesc('scheduled_at')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'brand_id' => 'required|integer|exists:brands,id',
            'scheduled_at' => 'required|date',
            'agenda' => 'nullable|string',
            'internal_participants_json' => 'nullable|array',
            'brand_participants_json' => 'nullable|array',
        ]);
        $row = AmClientMeeting::query()->create($data + ['status' => 'planifie']);
        AuditLogger::log($request, 'am_client_meeting.created', $row, null, $row->toArray());
        return ApiResponse::success($row, 'Réunion planifiée.', 201);
    }

    public function update(Request $request, int $id)
    {
        $row = AmClientMeeting::query()->findOrFail($id);
        $data = $request->validate([
            'topics_covered' => 'nullable|string',
            'decisions_taken' => 'nullable|string',
            'status' => 'sometimes|in:planifie,tenu,compte_rendu_a_rediger,cloture,annule',
            'minutes_author_user_id' => 'nullable|integer|exists:users,id',
            'held_at' => 'nullable|date',
            'closed_at' => 'nullable|date',
        ]);
        $before = $row->toArray();
        $row->fill($data)->save();
        AuditLogger::log($request, 'am_client_meeting.updated', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    public function addAction(Request $request, int $id)
    {
        $row = AmClientMeeting::query()->findOrFail($id);
        $data = $request->validate([
            'action' => 'required|string|min:3',
            'assignee_user_id' => 'nullable|integer|exists:users,id',
            'due_date' => 'nullable|date',
        ]);
        $act = AmMeetingAction::query()->create($data + ['meeting_id' => $row->id, 'status' => 'open']);
        AuditLogger::log($request, 'am_meeting_action.created', $act, null, $act->toArray());
        return ApiResponse::success($act, 'Action ajoutée.', 201);
    }

    public function closeAction(Request $request, int $actionId)
    {
        $act = AmMeetingAction::query()->findOrFail($actionId);
        $before = $act->only(['status', 'done_at']);
        $act->fill(['status' => 'done', 'done_at' => now()])->save();
        AuditLogger::log($request, 'am_meeting_action.done', $act, $before, $act->fresh()->toArray());
        return ApiResponse::success($act->fresh());
    }
}
