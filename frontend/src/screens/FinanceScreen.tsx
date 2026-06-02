import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';
import type { ChargeApi, ChargeDraftApi, ChargeTypeApi } from '../domain/finance';
import { CHARGE_TYPE_LABELS } from '../domain/finance';
import { INVOICE_STATUS_LABELS, statusLabelFr } from '../lib/statusLabelsFr';
import { trackSession } from '../lib/session';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';

function toneForChargeType(t: ChargeTypeApi): Parameters<typeof StatusChip>[0]['tone'] {
  switch (t) {
    case 'ads':
      return 'info';
    case 'delivery':
      return 'warning';
    case 'salary':
      return 'neutral';
    case 'supplier':
      return 'neutral';
    case 'influencer':
      return 'success';
    default:
      return 'neutral';
  }
}

function formatChargeDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
}

type SummaryPayload = {
  period?: { from: string; to: string };
  total_charges?: number;
  influencer_spend?: number;
  ad_spend?: number;
  delivery_spend?: number;
  supplier_spend?: number;
};

type FinanceTab = 'charges' | 'invoices' | 'contracts';

type CustomerOpt = { id: number; full_name: string; email?: string | null; brand_id?: number | null };

type ClientInvoice = {
  id: number;
  invoice_number: string;
  status: 'draft' | 'approved' | 'sent' | 'paid' | 'cancelled';
  billing_period_start: string;
  billing_period_end: string;
  issue_date: string;
  due_date?: string | null;
  subtotal: string | number;
  discount: string | number;
  tax_amount: string | number;
  total: string | number;
  recipient_email?: string | null;
  email_last_error?: string | null;
  customer?: { id: number; full_name: string; email?: string | null } | null;
  brand?: { id: number; name: string } | null;
  order?: { id: number; order_number: string } | null;
  meta?: { order_number?: string; source?: string } | null;
};

type ClientContract = {
  id: number;
  title: string;
  contract_number?: string | null;
  storage_provider: 'google_drive' | 'dropbox' | 'onedrive' | 'other';
  external_url?: string | null;
  status: 'draft' | 'active' | 'expired' | 'terminated';
  starts_at?: string | null;
  ends_at?: string | null;
  customer?: { id: number; full_name: string; email?: string | null } | null;
  brand?: { id: number; name: string } | null;
};

export function FinanceScreen() {
  const { brands } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<FinanceTab>('charges');
  const [charges, setCharges] = useState<ChargeApi[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [monthly, setMonthly] = useState<{ month: string; total: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ChargeTypeApi>('all');
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().toISOString().slice(0, 7));

  const [createOpen, setCreateOpen] = useState(false);
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
  const [createContractOpen, setCreateContractOpen] = useState(false);
  const [draft, setDraft] = useState<ChargeDraftApi>(() => ({
    brand_id: null,
    charge_date: new Date().toISOString().slice(0, 10),
    type: 'ads',
    amount: 0,
    note: '',
  }));
  const [invoiceDraft, setInvoiceDraft] = useState({
    brand_id: null as number | null,
    customer_id: '',
    billing_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    billing_period_end: new Date().toISOString().slice(0, 10),
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    subtotal: 0,
    discount: 0,
    tax_amount: 0,
    recipient_email: '',
    notes: '',
  });
  const [contractDraft, setContractDraft] = useState({
    brand_id: null as number | null,
    customer_id: '',
    title: '',
    contract_number: '',
    storage_provider: 'google_drive' as 'google_drive' | 'dropbox' | 'onedrive' | 'other',
    external_url: '',
    status: 'draft' as 'draft' | 'active' | 'expired' | 'terminated',
    starts_at: '',
    ends_at: '',
    notes: '',
  });

  const brandIdForQueries = brandFilter === 'all' ? undefined : Number(brandFilter);

  const loadAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    const qStr = buildQuery({
      per_page: 100,
      brand_id: brandIdForQueries,
      charge_type: typeFilter === 'all' ? undefined : typeFilter,
    });
    const [cRes, sRes, mRes, iRes, ctRes, cuRes] = await Promise.all([
      api.get<Paginated<ChargeApi>>(`charges${qStr}`),
      api.get<SummaryPayload>(
        `finance/summary${buildQuery({ brand_id: brandIdForQueries, date_from: undefined, date_to: undefined })}`,
      ),
      api.get<{ series: { month: string; total: number }[] }>(
        `finance/monthly${buildQuery({ brand_id: brandIdForQueries })}`,
      ),
      api.get<LaravelPaginator<ClientInvoice>>(`finance/invoices${buildQuery({ per_page: 100, brand_id: brandIdForQueries })}`),
      api.get<LaravelPaginator<ClientContract>>(`finance/contracts${buildQuery({ per_page: 100, brand_id: brandIdForQueries })}`),
      api.get<LaravelPaginator<CustomerOpt>>('customers?per_page=200'),
    ]);
    if (cRes.ok && cRes.data) {
      setCharges(cRes.data.data);
    } else {
      setError(cRes.message);
    }
    if (sRes.ok && sRes.data) {
      setSummary(sRes.data);
    }
    if (mRes.ok && mRes.data?.series) {
      setMonthly(mRes.data.series);
    } else if (mRes.ok && mRes.data && 'series' in mRes.data) {
      setMonthly((mRes.data as { series: { month: string; total: number }[] }).series ?? []);
    }
    if (iRes.ok && isPaginator(iRes.data)) {
      setInvoices(iRes.data.data);
    } else if (!iRes.ok) {
      setError(iRes.message);
    }
    if (ctRes.ok && isPaginator(ctRes.data)) {
      setContracts(ctRes.data.data);
    } else if (!ctRes.ok) {
      setError(ctRes.message);
    }
    if (cuRes.ok && isPaginator(cuRes.data)) {
      setCustomers(cuRes.data.data);
    }
    setLoading(false);
  }, [brandIdForQueries, typeFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const rows = useMemo(() => {
    if (tab !== 'charges') return [];
    const s = q.trim().toLowerCase();
    if (!s) return charges;
    return charges.filter((c) => {
      const blob = `${c.note ?? ''} ${CHARGE_TYPE_LABELS[c.type]} ${c.brand?.name ?? ''}`.toLowerCase();
      return blob.includes(s);
    });
  }, [charges, q]);

  const invoiceRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = !s
      ? invoices
      : invoices.filter((i) => {
          const blob = `${i.invoice_number} ${i.customer?.full_name ?? ''} ${i.recipient_email ?? ''}`.toLowerCase();
          return blob.includes(s);
        });
    if (brandFilter === 'all') return base;
    return base.filter((i) => String(i.brand?.id ?? '') === brandFilter);
  }, [invoices, q, brandFilter]);

  const contractRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = !s
      ? contracts
      : contracts.filter((c) => {
          const blob = `${c.title} ${c.contract_number ?? ''} ${c.customer?.full_name ?? ''}`.toLowerCase();
          return blob.includes(s);
        });
    if (brandFilter === 'all') return base;
    return base.filter((c) => String(c.brand?.id ?? '') === brandFilter);
  }, [contracts, q, brandFilter]);

  const columns = useMemo<Column<ChargeApi>[]>(() => {
    return [
      {
        key: 'charge_date',
        header: 'Date',
        cell: (c) => <span className="text-sm font-black text-zinc-900">{formatChargeDate(String(c.charge_date))}</span>,
      },
      {
        key: 'brand',
        header: 'Marque',
        cell: (c) => (
          <span className="text-sm font-bold text-zinc-700">{c.brand?.name ?? 'Global'}</span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        cell: (c) => (
          <StatusChip tone={toneForChargeType(c.type)}>{CHARGE_TYPE_LABELS[c.type] ?? c.type}</StatusChip>
        ),
      },
      {
        key: 'note',
        header: 'Note',
        cell: (c) => <span className="text-sm font-medium text-zinc-700">{c.note || '—'}</span>,
      },
      {
        key: 'amount',
        header: 'Montant',
        className: 'text-right',
        cell: (c) => (
          <span className="text-sm font-black text-zinc-900">{formatCurrency(Number(c.amount))}</span>
        ),
      },
    ];
  }, []);

  const invoiceColumns = useMemo<Column<ClientInvoice>[]>(() => {
    return [
      {
        key: 'num',
        header: 'Facture',
        cell: (i) => {
          const orderRef = i.order?.order_number ?? i.meta?.order_number;
          return (
            <div>
              <p className="text-sm font-black text-zinc-900">{i.invoice_number}</p>
              <p className="text-[11px] text-zinc-500 font-medium">{i.brand?.name ?? 'Global'}</p>
              {orderRef ? (
                <p className="text-[10px] font-bold text-primary-700 mt-0.5">Commande {orderRef}</p>
              ) : null}
            </div>
          );
        },
      },
      {
        key: 'customer',
        header: 'Client',
        cell: (i) => (
          <div>
            <p className="text-sm font-bold text-zinc-800">{i.customer?.full_name ?? '—'}</p>
            <p className="text-[11px] text-zinc-500">{i.recipient_email ?? i.customer?.email ?? '—'}</p>
          </div>
        ),
      },
      {
        key: 'period',
        header: 'Période',
        cell: (i) => <span className="text-sm font-medium text-zinc-700">{i.billing_period_start} → {i.billing_period_end}</span>,
      },
      {
        key: 'status',
        header: 'Statut',
        cell: (i) => (
          <StatusChip tone={i.status === 'paid' ? 'success' : i.status === 'sent' ? 'info' : i.status === 'approved' ? 'warning' : 'neutral'}>
            {statusLabelFr(i.status, INVOICE_STATUS_LABELS)}
          </StatusChip>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        className: 'text-right',
        cell: (i) => <span className="text-sm font-black text-zinc-900">{formatCurrency(Number(i.total))}</span>,
      },
      {
        key: 'actions',
        header: '',
        cell: (i) => (
          <div className="flex items-center gap-2 justify-end">
            {i.status === 'draft' && hasPermission('finance.update') ? (
              <button
                type="button"
                onClick={() => void approveInvoice(i.id)}
                className="px-2.5 py-1.5 rounded-lg border border-zinc-200 text-xs font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Valider
              </button>
            ) : null}
            {i.status === 'approved' && hasPermission('finance.update') ? (
              <button
                type="button"
                onClick={() => void sendInvoice(i.id)}
                className="px-2.5 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-black inline-flex items-center gap-1"
              >
                <Mail className="w-3.5 h-3.5" /> Envoyer
              </button>
            ) : null}
          </div>
        ),
      },
    ];
  }, [hasPermission]);

  const contractColumns = useMemo<Column<ClientContract>[]>(() => {
    return [
      { key: 'title', header: 'Contrat', cell: (c) => <span className="text-sm font-black text-zinc-900">{c.title}</span> },
      { key: 'customer', header: 'Client', cell: (c) => <span className="text-sm font-bold text-zinc-700">{c.customer?.full_name ?? '—'}</span> },
      { key: 'provider', header: 'Stockage', cell: (c) => <span className="text-sm text-zinc-700">{c.storage_provider}</span> },
      {
        key: 'url',
        header: 'Lien',
        cell: (c) =>
          c.external_url ? (
            <a href={c.external_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary-600 hover:underline">
              Ouvrir
            </a>
          ) : (
            '—'
          ),
      },
      {
        key: 'status',
        header: 'Statut',
        cell: (c) => <StatusChip tone={c.status === 'active' ? 'success' : 'neutral'}>{c.status}</StatusChip>,
      },
    ];
  }, []);

  const onCreateCharge = async () => {
    if (!hasPermission('finance.create')) return;
    const res = await api.post<ChargeApi>('charges', {
      brand_id: draft.brand_id,
      charge_date: draft.charge_date,
      type: draft.type,
      amount: draft.amount,
      note: draft.note || undefined,
    });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    trackSession({
      name: 'audit.finance.charge_create',
      ts: Date.now(),
      meta: { type: draft.type, amount: draft.amount, brand_id: draft.brand_id },
    });
    setCreateOpen(false);
    setDraft({
      brand_id: null,
      charge_date: new Date().toISOString().slice(0, 10),
      type: 'ads',
      amount: 0,
      note: '',
    });
    await loadAll();
  };

  const onCreateInvoice = async () => {
    if (!hasPermission('finance.create')) return;
    if (!invoiceDraft.customer_id) {
      toast.error('Client requis.');
      return;
    }
    const res = await api.post<ClientInvoice>('finance/invoices', {
      brand_id: invoiceDraft.brand_id,
      customer_id: Number(invoiceDraft.customer_id),
      billing_period_start: invoiceDraft.billing_period_start,
      billing_period_end: invoiceDraft.billing_period_end,
      issue_date: invoiceDraft.issue_date,
      due_date: invoiceDraft.due_date || null,
      subtotal: invoiceDraft.subtotal,
      discount: invoiceDraft.discount,
      tax_amount: invoiceDraft.tax_amount,
      recipient_email: invoiceDraft.recipient_email || null,
      notes: invoiceDraft.notes || null,
    });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success('Facture créée (brouillon).');
    setCreateInvoiceOpen(false);
    await loadAll();
  };

  const onCreateContract = async () => {
    if (!hasPermission('finance.create')) return;
    if (!contractDraft.customer_id || !contractDraft.title.trim()) {
      toast.error('Client et titre sont requis.');
      return;
    }
    const res = await api.post<ClientContract>('finance/contracts', {
      brand_id: contractDraft.brand_id,
      customer_id: Number(contractDraft.customer_id),
      title: contractDraft.title.trim(),
      contract_number: contractDraft.contract_number || null,
      storage_provider: contractDraft.storage_provider,
      external_url: contractDraft.external_url || null,
      status: contractDraft.status,
      starts_at: contractDraft.starts_at || null,
      ends_at: contractDraft.ends_at || null,
      notes: contractDraft.notes || null,
    });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success('Contrat client enregistré.');
    setCreateContractOpen(false);
    await loadAll();
  };

  const approveInvoice = async (invoiceId: number) => {
    const res = await api.post(`finance/invoices/${invoiceId}/approve`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Facture validée.');
    await loadAll();
  };

  const sendInvoice = async (invoiceId: number) => {
    const res = await api.post(`finance/invoices/${invoiceId}/send`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Facture envoyée par email.');
    await loadAll();
  };

  const generateMonthlyInvoices = async () => {
    if (!hasPermission('finance.create')) return;
    const res = await api.post<{ created: number; skipped: number; month: string }>('finance/invoices/generate-monthly', {
      month: invoiceMonth,
      brand_id: brandIdForQueries ?? null,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Factures générées: ${res.data.created} (ignorées: ${res.data.skipped}).`);
    await loadAll();
  };

  const canCreate = hasPermission('finance.create');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        right={
          <div className="flex gap-2">
            <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
              {([
                ['charges', 'Charges'],
                ['invoices', 'Factures'],
                ['contracts', 'Contrats'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`px-3 py-2 text-xs font-black ${tab === id ? 'bg-primary-600 text-white' : 'bg-white text-zinc-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void loadAll()}
              className="px-4 py-2 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
            </button>
            {canCreate && tab === 'charges' && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Ajouter charge
              </button>
            )}
            {canCreate && tab === 'invoices' && (
              <>
                <button
                  type="button"
                  onClick={() => void generateMonthlyInvoices()}
                  className="px-4 py-2 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50"
                >
                  Générer mois
                </button>
                <input
                  type="month"
                  value={invoiceMonth}
                  onChange={(e) => setInvoiceMonth(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
                />
                <button
                  type="button"
                  onClick={() => setCreateInvoiceOpen(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Nouvelle facture
                </button>
              </>
            )}
            {canCreate && tab === 'contracts' && (
              <button
                type="button"
                onClick={() => setCreateContractOpen(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouveau contrat
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total charges</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">
            {formatCurrency(summary?.total_charges ?? 0)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ads</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(summary?.ad_spend ?? 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Livraison</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(summary?.delivery_spend ?? 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fournisseur</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(summary?.supplier_spend ?? 0)}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Influence</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">{formatCurrency(summary?.influencer_spend ?? 0)}</p>
        </div>
      </div>

      {monthly.length > 0 && (
        <div className="card p-6">
          <p className="text-sm font-black text-zinc-900">Dépenses mensuelles</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  <th className="pb-2">Mois</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month} className="border-t border-zinc-100">
                    <td className="py-2 font-bold text-zinc-800">{m.month}</td>
                    <td className="py-2 text-right font-black text-zinc-900">{formatCurrency(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
            >
              <option value="all">Toutes les marques</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
            >
              <option value="all">Tous types</option>
              {(Object.keys(CHARGE_TYPE_LABELS) as ChargeTypeApi[]).map((k) => (
                <option key={k} value={k}>
                  {CHARGE_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </>
        }
      />

      {tab === 'charges' && (
        <DataTable
          rows={rows}
          columns={columns}
          emptyTitle="Aucune charge"
          emptyDescription="Créez une charge ou ajustez les filtres."
        />
      )}

      {tab === 'invoices' && (
        <DataTable
          rows={invoiceRows}
          columns={invoiceColumns}
          emptyTitle="Aucune facture"
          emptyDescription="Générez les factures mensuelles puis validez avant envoi."
        />
      )}

      {tab === 'contracts' && (
        <DataTable
          rows={contractRows}
          columns={contractColumns}
          emptyTitle="Aucun contrat"
          emptyDescription="Stockez les contrats clients avec lien Google Drive (ou équivalent)."
        />
      )}

      {canCreate && (
        <Modal
          open={createOpen}
          title="Ajouter une charge"
          subtitle="Enregistrée côté API (charges)."
          onClose={() => setCreateOpen(false)}
          footer={
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void onCreateCharge()}
                className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors"
              >
                Enregistrer
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
              <input
                type="date"
                value={draft.charge_date}
                onChange={(e) => setDraft((d) => ({ ...d, charge_date: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Marque</label>
              <select
                value={draft.brand_id === null ? '' : String(draft.brand_id)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    brand_id: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none"
              >
                <option value="">Global (toutes marques)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ChargeTypeApi }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none"
              >
                {(Object.keys(CHARGE_TYPE_LABELS) as ChargeTypeApi[]).map((k) => (
                  <option key={k} value={k}>
                    {CHARGE_TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Montant</label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={draft.amount || ''}
                onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Note</label>
              <textarea
                value={draft.note ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </Modal>
      )}

      {canCreate && (
        <Modal
          open={createInvoiceOpen}
          title="Nouvelle facture client"
          subtitle="Facture en brouillon, validation obligatoire avant envoi."
          onClose={() => setCreateInvoiceOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateInvoiceOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">Annuler</button>
              <button type="button" onClick={() => void onCreateInvoice()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700">Créer brouillon</button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client
              <select value={invoiceDraft.customer_id} onChange={(e) => setInvoiceDraft((d) => ({ ...d, customer_id: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold">
                <option value="">— Sélectionner —</option>
                {customers.map((c) => <option key={c.id} value={String(c.id)}>{c.full_name} {c.email ? `(${c.email})` : ''}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Email destinataire
              <input value={invoiceDraft.recipient_email} onChange={(e) => setInvoiceDraft((d) => ({ ...d, recipient_email: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Début période
              <input type="date" value={invoiceDraft.billing_period_start} onChange={(e) => setInvoiceDraft((d) => ({ ...d, billing_period_start: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fin période
              <input type="date" value={invoiceDraft.billing_period_end} onChange={(e) => setInvoiceDraft((d) => ({ ...d, billing_period_end: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date émission
              <input type="date" value={invoiceDraft.issue_date} onChange={(e) => setInvoiceDraft((d) => ({ ...d, issue_date: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date échéance
              <input type="date" value={invoiceDraft.due_date} onChange={(e) => setInvoiceDraft((d) => ({ ...d, due_date: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sous-total
              <input type="number" min={0} step="0.01" value={invoiceDraft.subtotal || ''} onChange={(e) => setInvoiceDraft((d) => ({ ...d, subtotal: Number(e.target.value) }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Remise
              <input type="number" min={0} step="0.01" value={invoiceDraft.discount || ''} onChange={(e) => setInvoiceDraft((d) => ({ ...d, discount: Number(e.target.value) }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taxe
              <input type="number" min={0} step="0.01" value={invoiceDraft.tax_amount || ''} onChange={(e) => setInvoiceDraft((d) => ({ ...d, tax_amount: Number(e.target.value) }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 md:col-span-2">Notes
              <textarea rows={3} value={invoiceDraft.notes} onChange={(e) => setInvoiceDraft((d) => ({ ...d, notes: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
          </div>
        </Modal>
      )}

      {canCreate && (
        <Modal
          open={createContractOpen}
          title="Nouveau contrat client"
          subtitle="Stockage centralisé des contrats (Google Drive ou équivalent)."
          onClose={() => setCreateContractOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateContractOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">Annuler</button>
              <button type="button" onClick={() => void onCreateContract()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700">Enregistrer</button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client
              <select value={contractDraft.customer_id} onChange={(e) => setContractDraft((d) => ({ ...d, customer_id: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold">
                <option value="">— Sélectionner —</option>
                {customers.map((c) => <option key={c.id} value={String(c.id)}>{c.full_name}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre
              <input value={contractDraft.title} onChange={(e) => setContractDraft((d) => ({ ...d, title: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">N° Contrat
              <input value={contractDraft.contract_number} onChange={(e) => setContractDraft((d) => ({ ...d, contract_number: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stockage
              <select value={contractDraft.storage_provider} onChange={(e) => setContractDraft((d) => ({ ...d, storage_provider: e.target.value as 'google_drive' | 'dropbox' | 'onedrive' | 'other' }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold">
                <option value="google_drive">Google Drive</option>
                <option value="dropbox">Dropbox</option>
                <option value="onedrive">OneDrive</option>
                <option value="other">Autre</option>
              </select>
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 md:col-span-2">Lien externe (Drive/Cloud)
              <input value={contractDraft.external_url} onChange={(e) => setContractDraft((d) => ({ ...d, external_url: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Début
              <input type="date" value={contractDraft.starts_at} onChange={(e) => setContractDraft((d) => ({ ...d, starts_at: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fin
              <input type="date" value={contractDraft.ends_at} onChange={(e) => setContractDraft((d) => ({ ...d, ends_at: e.target.value }))} className="mt-2 w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200" />
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
