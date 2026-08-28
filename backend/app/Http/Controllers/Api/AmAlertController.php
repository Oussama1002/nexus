<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AmAlert;
use App\Models\AmAlertEscalation;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class AmAlertController extends Controller
{
    public function index(Request $request)
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $rows = AmAlert::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('severity'), fn ($q) => $q->where('severity', $request->string('severity')))
            ->with(['recipient:id,name', 'escalations'])
            ->orderByDesc('id')
            ->paginate((int) $request->integer('per_page', 25));
        return ApiResponse::success($rows);
    }

    public function take(Request $request, int $id)
    {
        $row = AmAlert::query()->findOrFail($id);
        if ($row->status !== 'ouverte') {
            return ApiResponse::error('Alerte non prenable.', null, 422);
        }
        $before = $row->only(['status', 'taken_at']);
        $row->fill([
            'status' => 'prise_en_charge',
            'taken_at' => now(),
            'recipient_user_id' => $row->recipient_user_id ?? $request->user()->id,
        ])->save();
        AuditLogger::log($request, 'am_alert.taken', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    public function resolve(Request $request, int $id)
    {
        $row = AmAlert::query()->findOrFail($id);
        $data = $request->validate(['resolution_action' => 'required|string|min:3']);
        $before = $row->only(['status', 'resolved_at']);
        $row->fill([
            'status' => 'resolue',
            'resolved_at' => now(),
            'resolution_action' => $data['resolution_action'],
        ])->save();
        AuditLogger::log($request, 'am_alert.resolved', $row, $before, $row->fresh()->toArray());
        return ApiResponse::success($row->fresh());
    }

    public function escalate(Request $request, int $id)
    {
        $row = AmAlert::query()->findOrFail($id);
        $data = $request->validate([
            'level' => 'required|integer|min:1|max:3',
            'escalated_to_user_id' => 'nullable|integer|exists:users,id',
        ]);
        AmAlertEscalation::query()->create([
            'alert_id' => $row->id,
            'level' => $data['level'],
            'escalated_to_user_id' => $data['escalated_to_user_id'] ?? null,
            'escalated_at' => now(),
        ]);
        $before = $row->only(['status']);
        $row->fill(['status' => 'escaladee'])->save();
        AuditLogger::log($request, 'am_alert.escalated', $row, $before, ['level' => $data['level']]);
        return ApiResponse::success($row->fresh(['escalations']));
    }
}
