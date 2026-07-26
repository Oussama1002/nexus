<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountingAccount;
use App\Models\AccountingEntry;
use App\Models\Order;
use App\Models\Shipment;
use App\Services\AuditLogger;
use App\Support\ApiBrandContext;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccountingController extends Controller
{
    // ── Accounts (plan comptable) ──

    public function accountsIndex(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $q = AccountingAccount::query()->with('parent:id,code,label');
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderBy('code');

        $type = $request->query('type');
        if ($type) {
            $q->where('type', $type);
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('code', 'like', $s)->orWhere('label', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate(100), 'Accounts retrieved.');
    }

    public function accountsStore(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20'],
            'label' => ['required', 'string', 'max:255'],
            'type' => ['required', 'in:actif,passif,charge,produit'],
            'parent_id' => ['nullable', 'integer', 'exists:accounting_accounts,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $data['brand_id'] = $brandId;

        $exists = AccountingAccount::query()
            ->where('brand_id', $brandId)
            ->where('code', $data['code'])
            ->exists();
        if ($exists) {
            return ApiResponse::error('Ce code compte existe deja pour cette marque.', null, 422);
        }

        $row = AccountingAccount::query()->create($data);
        AuditLogger::log($request, 'accounting_accounts.create', $row, null, $row->toArray());

        return ApiResponse::success($row->fresh('parent:id,code,label'), 'Compte cree.', 201);
    }

    public function accountsUpdate(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = AccountingAccount::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:20'],
            'label' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', 'in:actif,passif,charge,produit'],
            'parent_id' => ['nullable', 'integer', 'exists:accounting_accounts,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (isset($data['code']) && $data['code'] !== $row->code) {
            $exists = AccountingAccount::query()
                ->where('brand_id', $brandId)
                ->where('code', $data['code'])
                ->where('id', '!=', $row->id)
                ->exists();
            if ($exists) {
                return ApiResponse::error('Ce code compte existe deja.', null, 422);
            }
        }

        $row->fill($data);
        $row->save();
        AuditLogger::log($request, 'accounting_accounts.update', $row, $before, $row->fresh()->toArray());

        return ApiResponse::success($row->fresh('parent:id,code,label'), 'Compte mis a jour.');
    }

    public function accountsDestroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = AccountingAccount::query()->where('brand_id', $brandId)->findOrFail($id);

        if ($row->entries()->exists()) {
            return ApiResponse::error('Impossible de supprimer un compte avec des ecritures.', null, 422);
        }

        $before = $row->toArray();
        $row->delete();
        AuditLogger::log($request, 'accounting_accounts.delete', null, $before, null);

        return ApiResponse::success(null, 'Compte supprime.');
    }

    // ── Entries (ecritures comptables) ──

    public function entriesIndex(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        $q = AccountingEntry::query()->with(['account:id,code,label', 'creator:id,name', 'brand:id,name']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderByDesc('entry_date')->orderByDesc('id');

        $from = $request->query('date_from');
        $to = $request->query('date_to');
        $journal = $request->query('journal');
        $accountId = $request->query('account_id');
        $search = trim((string) $request->query('search', ''));

        if ($from) {
            $q->whereDate('entry_date', '>=', $from);
        }
        if ($to) {
            $q->whereDate('entry_date', '<=', $to);
        }
        if ($journal) {
            $q->where('journal', $journal);
        }
        if ($accountId) {
            $q->where('account_id', (int) $accountId);
        }
        if ($search !== '') {
            $s = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $q->where(function ($w) use ($s) {
                $w->where('label', 'like', $s)
                    ->orWhere('reference', 'like', $s);
            });
        }

        return ApiResponse::success($q->paginate($perPage), 'Entries retrieved.');
    }

    public function entriesStore(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $data = $request->validate([
            'account_id' => ['required', 'integer', 'exists:accounting_accounts,id'],
            'entry_date' => ['required', 'date'],
            'journal' => ['nullable', 'string', 'max:30'],
            'reference' => ['nullable', 'string', 'max:100'],
            'label' => ['required', 'string', 'max:255'],
            'debit' => ['nullable', 'numeric', 'min:0'],
            'credit' => ['nullable', 'numeric', 'min:0'],
        ]);

        $data['brand_id'] = $brandId;
        $data['created_by'] = $request->user()?->id;
        $data['journal'] = $data['journal'] ?? 'OD';
        $data['debit'] = $data['debit'] ?? 0;
        $data['credit'] = $data['credit'] ?? 0;

        if ($data['debit'] == 0 && $data['credit'] == 0) {
            return ApiResponse::error('Le debit ou le credit doit etre renseigne.', null, 422);
        }

        $row = AccountingEntry::query()->create($data);
        AuditLogger::log($request, 'accounting_entries.create', $row, null, $row->toArray());

        return ApiResponse::success(
            $row->fresh(['account:id,code,label', 'creator:id,name', 'brand:id,name']),
            'Ecriture enregistree.',
            201
        );
    }

    public function entriesDestroy(Request $request, string $id): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request);
        $row = AccountingEntry::query()->where('brand_id', $brandId)->findOrFail($id);
        $before = $row->toArray();
        $row->delete();
        AuditLogger::log($request, 'accounting_entries.delete', null, $before, null);

        return ApiResponse::success(null, 'Ecriture supprimee.');
    }

    // ── Summary ──

    public function summary(Request $request): JsonResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        $baseQ = AccountingEntry::query();
        ApiBrandContext::scopeBrand($baseQ, $brandId);

        $from = $request->query('date_from');
        $to = $request->query('date_to');
        if ($from) {
            $baseQ->whereDate('entry_date', '>=', $from);
        }
        if ($to) {
            $baseQ->whereDate('entry_date', '<=', $to);
        }

        $totalDebit = (clone $baseQ)->sum('debit');
        $totalCredit = (clone $baseQ)->sum('credit');
        $entryCount = (clone $baseQ)->count();
        $accountCount = AccountingAccount::query()
            ->when($brandId, fn ($q) => $q->where('brand_id', $brandId))
            ->where('is_active', true)
            ->count();

        $ordersQ = Order::query();
        ApiBrandContext::scopeBrand($ordersQ, $brandId);
        if ($from) { $ordersQ->whereDate('created_at', '>=', $from); }
        if ($to) { $ordersQ->whereDate('created_at', '<=', $to); }

        $shipmentsQ = Shipment::query();
        ApiBrandContext::scopeBrand($shipmentsQ, $brandId);
        if ($from) { $shipmentsQ->whereDate('created_at', '>=', $from); }
        if ($to) { $shipmentsQ->whereDate('created_at', '<=', $to); }

        $orderRevenue = (float) (clone $ordersQ)->sum('total');
        $deliveredCod = (float) (clone $shipmentsQ)->where('status', 'delivered')->sum('cod_amount');
        $revenue = $orderRevenue > 0 ? $orderRevenue : $deliveredCod;
        $totalOrders = (clone $ordersQ)->count();
        $deliveredOrders = (clone $ordersQ)->where('status', 'delivered')->count();
        $returnedOrders = (clone $ordersQ)->where('status', 'returned')->count();
        $totalShipments = (clone $shipmentsQ)->count();
        $deliveredShipments = (clone $shipmentsQ)->where('status', 'delivered')->count();
        $returnedShipments = (clone $shipmentsQ)->where('status', 'returned')->count();
        $deliveryFees = (float) (clone $shipmentsQ)->sum('delivery_fee');
        $codCollected = (float) (clone $shipmentsQ)->where('status', 'delivered')->sum('cod_amount');
        $codPending = (float) (clone $shipmentsQ)->whereNotIn('status', ['delivered', 'returned', 'cancelled'])->sum('cod_amount');

        return ApiResponse::success([
            'total_debit' => round((float) $totalDebit, 2),
            'total_credit' => round((float) $totalCredit, 2),
            'balance' => round((float) $totalDebit - (float) $totalCredit, 2),
            'entry_count' => $entryCount,
            'account_count' => $accountCount,
            'business' => [
                'revenue' => round($revenue, 2),
                'order_revenue' => round($orderRevenue, 2),
                'delivered_cod' => round($deliveredCod, 2),
                'total_orders' => $totalOrders,
                'delivered_orders' => $deliveredOrders,
                'returned_orders' => $returnedOrders,
                'total_shipments' => $totalShipments,
                'delivered_shipments' => $deliveredShipments,
                'returned_shipments' => $returnedShipments,
                'delivery_fees' => round($deliveryFees, 2),
                'cod_collected' => round($codCollected, 2),
                'cod_pending' => round($codPending, 2),
            ],
        ], 'Accounting summary.');
    }

    // ── CSV Export ──

    public function exportCsv(Request $request): StreamedResponse
    {
        $brandId = ApiBrandContext::resolveBrandId($request, required: false);

        $q = AccountingEntry::query()->with(['account:id,code,label', 'brand:id,name']);
        ApiBrandContext::scopeBrand($q, $brandId);
        $q->orderBy('entry_date')->orderBy('id');

        $from = $request->query('date_from');
        $to = $request->query('date_to');
        if ($from) {
            $q->whereDate('entry_date', '>=', $from);
        }
        if ($to) {
            $q->whereDate('entry_date', '<=', $to);
        }

        $filename = 'ecritures_comptables_'.now()->format('Ymd_His').'.csv';

        return response()->streamDownload(function () use ($q) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date', 'Journal', 'Compte', 'Libelle compte', 'Reference', 'Libelle', 'Debit', 'Credit', 'Marque']);

            $q->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $row) {
                    fputcsv($out, [
                        $row->entry_date->format('Y-m-d'),
                        $row->journal,
                        $row->account->code ?? '',
                        $row->account->label ?? '',
                        $row->reference ?? '',
                        $row->label,
                        number_format((float) $row->debit, 2, '.', ''),
                        number_format((float) $row->credit, 2, '.', ''),
                        $row->brand->name ?? 'Global',
                    ]);
                }
            });

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
