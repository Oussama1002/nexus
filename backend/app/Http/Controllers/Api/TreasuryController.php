<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TreasuryAccount;
use App\Models\TreasuryTransaction;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TreasuryController extends Controller
{
    /**
     * Frontend expects: { id, date, label, type, category, amount, running_balance, reference, account }
     * running_balance is computed on-the-fly from the initial_balance + sum of previous
     * transactions across all accounts scoped to the current brand.
     */
    public function index(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 25), 1), 100);

        $q = TreasuryTransaction::query()
            ->with(['account:id,name,initial_balance'])
            ->orderBy('date')->orderBy('id');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        if ($type = $request->query('type')) $q->where('type', $type);
        if ($from = $request->query('date_from')) $q->where('date', '>=', $from);
        if ($to = $request->query('date_to')) $q->where('date', '<=', $to);
        if ($search = $request->query('search')) {
            $q->where(function ($qq) use ($search) {
                $qq->where('label', 'like', "%{$search}%")
                    ->orWhere('reference', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%");
            });
        }

        $paginator = $q->paginate($perPage);

        // Compute initial_balance seed once
        $seed = 0.0;
        if ($brandId !== null) {
            $seed = (float) TreasuryAccount::query()->where('brand_id', $brandId)->sum('initial_balance');
        }

        // For each row on this page, running balance = seed + sum(signed amount for all trx up to and including this one)
        // Do it in one round trip: pull ids + signed prefix sums scoped to same brand chronology.
        $rowIds = $paginator->getCollection()->pluck('id')->all();
        $balanceById = [];
        if ($rowIds) {
            $chronological = TreasuryTransaction::query()
                ->when($brandId !== null, fn ($qq) => $qq->where('brand_id', $brandId))
                ->orderBy('date')->orderBy('id')
                ->get(['id', 'type', 'amount']);
            $running = $seed;
            foreach ($chronological as $t) {
                $running += ($t->type === 'income' ? 1 : -1) * (float) $t->amount;
                if (in_array($t->id, $rowIds, true)) {
                    $balanceById[$t->id] = $running;
                }
            }
        }

        $mapped = $paginator->getCollection()->map(function ($t) use ($balanceById) {
            return [
                'id' => $t->id,
                'date' => $t->date?->toDateString(),
                'label' => $t->label,
                'type' => $t->type,
                'category' => $t->category ?? '',
                'amount' => (float) $t->amount,
                'running_balance' => $balanceById[$t->id] ?? 0.0,
                'reference' => $t->reference,
                'account' => $t->account?->name ?? '—',
            ];
        });
        $paginator->setCollection($mapped);

        return ApiResponse::success($paginator);
    }

    public function summary(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $scoped = fn ($q) => $brandId !== null ? $q->where('brand_id', $brandId) : $q;

        $seed = $brandId !== null
            ? (float) TreasuryAccount::query()->where('brand_id', $brandId)->sum('initial_balance')
            : 0.0;

        $income = (float) $scoped(TreasuryTransaction::query())->where('type', 'income')->sum('amount');
        $expense = (float) $scoped(TreasuryTransaction::query())->where('type', 'expense')->sum('amount');
        $total = $seed + $income - $expense;

        $monthStart = now()->startOfMonth();
        $monthEnd = now()->endOfMonth();
        $incomeThisMonth = (float) $scoped(TreasuryTransaction::query())
            ->where('type', 'income')->whereBetween('date', [$monthStart, $monthEnd])->sum('amount');
        $expenseThisMonth = (float) $scoped(TreasuryTransaction::query())
            ->where('type', 'expense')->whereBetween('date', [$monthStart, $monthEnd])->sum('amount');

        return ApiResponse::success([
            'total_balance' => $total,
            'income_this_month' => $incomeThisMonth,
            'expense_this_month' => $expenseThisMonth,
            'variation' => $incomeThisMonth - $expenseThisMonth,
        ]);
    }

    // ─── Accounts CRUD ───

    public function accountsIndex(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = TreasuryAccount::query()->orderBy('name');
        if ($brandId !== null) $q->where('brand_id', $brandId);
        return ApiResponse::success($q->get());
    }

    public function accountsStore(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'kind' => ['nullable', 'string', 'max:30'],
            'initial_balance' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string', 'max:10'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['brand_id'] = $brandId;
        $row = TreasuryAccount::query()->create($data);
        AuditLogger::log($request, 'treasury_account.create', $row);
        return ApiResponse::success($row, 'Compte créé.', 201);
    }

    // ─── Transactions CRUD ───

    public function store(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'account_id' => ['required', 'integer', 'exists:treasury_accounts,id'],
            'date' => ['required', 'date'],
            'label' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:income,expense'],
            'category' => ['nullable', 'string', 'max:60'],
            'amount' => ['required', 'numeric', 'min:0'],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
        ]);
        $data['brand_id'] = $brandId;
        $data['created_by_user_id'] = $request->user()->id;
        $row = TreasuryTransaction::query()->create($data);
        AuditLogger::log($request, 'treasury_trx.create', $row);
        return ApiResponse::success($row->fresh(), 'Mouvement enregistré.', 201);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $row = TreasuryTransaction::query()->findOrFail($id);
        $before = $row->toArray();
        $row->delete();
        AuditLogger::log($request, 'treasury_trx.delete', null, $before, null);
        return ApiResponse::success(null, 'Mouvement supprimé.');
    }
}
