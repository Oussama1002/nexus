<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\BudgetRequest;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetController extends Controller
{
    /**
     * Frontend expects: { id, name, department, allocated, spent, remaining, usage, period, status }
     * `spent` is derived: sum of approved BudgetRequests' approved_amount for the budget.
     */
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = Budget::query()->orderByDesc('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($status = $request->query('status')) $q->where('status', $status);
        if ($dep = $request->query('department')) $q->where('department', $dep);
        if ($search = $request->query('search')) {
            $q->where(function ($qq) use ($search) {
                $qq->where('name', 'like', "%{$search}%")->orWhere('department', 'like', "%{$search}%");
            });
        }

        $paginator = $q->paginate($perPage);

        // Compute spent for the paged budgets
        $budgetIds = $paginator->getCollection()->pluck('id')->all();
        $spentByBudget = [];
        if ($budgetIds) {
            $spentByBudget = BudgetRequest::query()
                ->whereIn('budget_id', $budgetIds)
                ->where('status', 'approved')
                ->selectRaw('budget_id, SUM(COALESCE(approved_amount, amount)) as s')
                ->groupBy('budget_id')
                ->pluck('s', 'budget_id')
                ->all();
        }

        $mapped = $paginator->getCollection()->map(function ($b) use ($spentByBudget) {
            $allocated = (float) $b->allocated;
            $spent = (float) ($spentByBudget[$b->id] ?? 0);
            $remaining = $allocated - $spent;
            $usage = $allocated > 0 ? round(($spent / $allocated) * 100, 1) : 0.0;
            $status = $b->status;
            if ($status === 'active' && $spent > $allocated) $status = 'exceeded';
            return [
                'id' => $b->id,
                'name' => $b->name,
                'department' => $b->department,
                'allocated' => $allocated,
                'spent' => $spent,
                'remaining' => $remaining,
                'usage' => $usage,
                'period' => $b->period_label ?: (
                    $b->period_start && $b->period_end
                        ? $b->period_start->format('d/m/Y') . ' → ' . $b->period_end->format('d/m/Y')
                        : ''
                ),
                'status' => $status,
            ];
        });
        $paginator->setCollection($mapped);

        return ApiResponse::success($paginator);
    }

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'department' => ['required', 'string', 'max:60'],
            'period_label' => ['nullable', 'string', 'max:40'],
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after_or_equal:period_start'],
            'allocated' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()->id;
        $data['status'] = 'active';
        $row = Budget::query()->create($data);
        AuditLogger::log($request, 'budget.create', $row);
        return ApiResponse::success($row->fresh(), 'Budget créé.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $row = Budget::query()->findOrFail($id);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:60'],
            'period_label' => ['nullable', 'string', 'max:40'],
            'period_start' => ['nullable', 'date'],
            'period_end' => ['nullable', 'date'],
            'allocated' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'in:active,closed,exceeded'],
            'notes' => ['nullable', 'string'],
        ]);
        $row->fill($data)->save();
        AuditLogger::log($request, 'budget.update', $row);
        return ApiResponse::success($row->fresh());
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = Budget::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();
        AuditLogger::log($request, 'budget.delete', null, $before, null);
        return ApiResponse::success(null, 'Budget supprimé.');
    }
}
