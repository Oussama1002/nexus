<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetRequest;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetRequestController extends Controller
{
    /**
     * Frontend expects: { id, requester_name, budget_name, amount, reason, priority, status, created_at, approved_by }
     */
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = BudgetRequest::query()
            ->with(['requester:id,name', 'budget:id,name', 'approvedBy:id,name'])
            ->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($priority = $request->query('priority')) $q->where('priority', $priority);
        if ($search = $request->query('search')) {
            $q->where('reason', 'like', "%{$search}%");
        }

        $paginator = $q->paginate($perPage);
        $mapped = $paginator->getCollection()->map(fn ($r) => [
            'id' => $r->id,
            'requester_name' => $r->requester?->name ?? '—',
            'budget_name' => $r->budget?->name ?? '—',
            'amount' => (float) $r->amount,
            'reason' => $r->reason,
            'priority' => $r->priority,
            'status' => $r->status,
            'created_at' => $r->created_at?->toIso8601String(),
            'approved_by' => $r->approvedBy?->name,
        ]);
        $paginator->setCollection($mapped);
        return ApiResponse::success($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'budget_id' => ['nullable', 'integer', 'exists:budgets,id'],
            'amount' => ['required', 'numeric', 'min:0'],
            'reason' => ['required', 'string'],
            'priority' => ['required', 'string', 'in:high,medium,low'],
        ]);
        $data['brand_id'] = $brandId;
        $data['requester_user_id'] = $request->user()->id;
        $data['status'] = 'pending';
        $row = BudgetRequest::query()->create($data);
        AuditLogger::log($request, 'budget_request.create', $row);
        return ApiResponse::success($row->fresh(), 'Demande créée.', 201);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $row = BudgetRequest::query()->findOrFail($id);
        if ($row->status !== 'pending') return ApiResponse::error('Non actionnable.', null, 422);
        if ($row->requester_user_id === $request->user()->id) {
            return ApiResponse::error('Un même utilisateur ne peut pas être demandeur et validateur.', null, 422);
        }
        $data = $request->validate([
            'approved_amount' => ['nullable', 'numeric', 'min:0'],
            'decision_note' => ['nullable', 'string'],
        ]);
        $approved = $data['approved_amount'] ?? $row->amount;
        $row->status = $approved < $row->amount ? 'partial' : 'approved';
        $row->approved_amount = $approved;
        $row->approved_by_user_id = $request->user()->id;
        $row->decided_at = now();
        $row->decision_note = $data['decision_note'] ?? null;
        $row->save();
        AuditLogger::log($request, 'budget_request.approve', $row);
        return ApiResponse::success($row->fresh(), 'Demande approuvée.');
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $row = BudgetRequest::query()->findOrFail($id);
        if ($row->status !== 'pending') return ApiResponse::error('Non actionnable.', null, 422);
        $data = $request->validate(['decision_note' => ['required', 'string']]);
        $row->status = 'rejected';
        $row->approved_by_user_id = $request->user()->id;
        $row->decided_at = now();
        $row->decision_note = $data['decision_note'];
        $row->save();
        AuditLogger::log($request, 'budget_request.reject', $row);
        return ApiResponse::success($row->fresh(), 'Demande refusée.');
    }
}
