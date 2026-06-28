import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';
import * as api from '../lib/api';
import { getStoredToken } from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';

type AccountingTab = 'entries' | 'accounts';

type AccountType = 'actif' | 'passif' | 'charge' | 'produit';

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  actif: 'Actif',
  passif: 'Passif',
  charge: 'Charge',
  produit: 'Produit',
};

const JOURNAL_OPTIONS = ['OD', 'AC', 'VE', 'BQ', 'CA', 'AN'];

type AccountApi = {
  id: number;
  brand_id: number | null;
  code: string;
  label: string;
  type: AccountType;
  parent_id: number | null;
  is_active: boolean;
  parent?: { id: number; code: string; label: string } | null;
};

type EntryApi = {
  id: number;
  brand_id: number | null;
  account_id: number;
  entry_date: string;
  journal: string;
  reference: string | null;
  label: string;
  debit: string | number;
  credit: string | number;
  created_by: number | null;
  account?: { id: number; code: string; label: string } | null;
  creator?: { id: number; name: string } | null;
  brand?: { id: number; name: string } | null;
};

type SummaryApi = {
  total_debit: number;
  total_credit: number;
  balance: number;
  entry_count: number;
  account_count: number;
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
}

export function AccountingScreen() {
  const { brands } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState<AccountingTab>('entries');
  const [entries, setEntries] = useState<EntryApi[]>([]);
  const [accounts, setAccounts] = useState<AccountApi[]>([]);
  const [summary, setSummary] = useState<SummaryApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [journalFilter, setJournalFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [createEntryOpen, setCreateEntryOpen] = useState(false);
  const [createAccountOpen, setCreateAccountOpen] = useState(false);

  const [entryDraft, setEntryDraft] = useState({
    account_id: '',
    entry_date: new Date().toISOString().slice(0, 10),
    journal: 'OD',
    reference: '',
    label: '',
    debit: 0,
    credit: 0,
  });

  const [accountDraft, setAccountDraft] = useState({
    code: '',
    label: '',
    type: 'charge' as AccountType,
    parent_id: '',
    is_active: true,
  });

  const brandIdForQueries = brandFilter === 'all' ? undefined : Number(brandFilter);

  const loadAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    const qStr = buildQuery({
      per_page: 100,
      brand_id: brandIdForQueries,
      journal: journalFilter === 'all' ? undefined : journalFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
    const [eRes, aRes, sRes] = await Promise.all([
      api.get<LaravelPaginator<EntryApi>>(`accounting/entries${qStr}`),
      api.get<LaravelPaginator<AccountApi>>(`accounting/accounts${buildQuery({ per_page: 100, brand_id: brandIdForQueries })}`),
      api.get<SummaryApi>(`accounting/summary${buildQuery({ brand_id: brandIdForQueries, date_from: dateFrom || undefined, date_to: dateTo || undefined })}`),
    ]);
    if (eRes.ok && isPaginator(eRes.data)) {
      setEntries(eRes.data.data);
    } else if (!eRes.ok) {
      setError(eRes.message);
    }
    if (aRes.ok && isPaginator(aRes.data)) {
      setAccounts(aRes.data.data);
    }
    if (sRes.ok && sRes.data) {
      setSummary(sRes.data);
    }
    setLoading(false);
  }, [brandIdForQueries, journalFilter, dateFrom, dateTo]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const filteredEntries = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter((e) => {
      const blob = `${e.label} ${e.reference ?? ''} ${e.account?.code ?? ''} ${e.account?.label ?? ''} ${e.brand?.name ?? ''}`.toLowerCase();
      return blob.includes(s);
    });
  }, [entries, q]);

  const filteredAccounts = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return accounts;
    return accounts.filter((a) => {
      const blob = `${a.code} ${a.label} ${a.type}`.toLowerCase();
      return blob.includes(s);
    });
  }, [accounts, q]);

  const onCreateEntry = async () => {
    if (!entryDraft.account_id || !entryDraft.label.trim()) {
      toast.error('Compte et libelle requis.');
      return;
    }
    if (entryDraft.debit === 0 && entryDraft.credit === 0) {
      toast.error('Debit ou credit requis.');
      return;
    }
    const res = await api.post<EntryApi>('accounting/entries', {
      account_id: Number(entryDraft.account_id),
      entry_date: entryDraft.entry_date,
      journal: entryDraft.journal,
      reference: entryDraft.reference || null,
      label: entryDraft.label.trim(),
      debit: entryDraft.debit,
      credit: entryDraft.credit,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Ecriture enregistree.');
    setCreateEntryOpen(false);
    setEntryDraft({ account_id: '', entry_date: new Date().toISOString().slice(0, 10), journal: 'OD', reference: '', label: '', debit: 0, credit: 0 });
    await loadAll();
  };

  const onDeleteEntry = async (id: number) => {
    const res = await api.del(`accounting/entries/${id}`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Ecriture supprimee.');
    await loadAll();
  };

  const onCreateAccount = async () => {
    if (!accountDraft.code.trim() || !accountDraft.label.trim()) {
      toast.error('Code et libelle requis.');
      return;
    }
    const res = await api.post<AccountApi>('accounting/accounts', {
      code: accountDraft.code.trim(),
      label: accountDraft.label.trim(),
      type: accountDraft.type,
      parent_id: accountDraft.parent_id ? Number(accountDraft.parent_id) : null,
      is_active: accountDraft.is_active,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Compte cree.');
    setCreateAccountOpen(false);
    setAccountDraft({ code: '', label: '', type: 'charge', parent_id: '', is_active: true });
    await loadAll();
  };

  const onDeleteAccount = async (id: number) => {
    const res = await api.del(`accounting/accounts/${id}`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Compte supprime.');
    await loadAll();
  };

  const handleExportCsv = async () => {
    const params = buildQuery({ brand_id: brandIdForQueries, date_from: dateFrom || undefined, date_to: dateTo || undefined });
    const base = `${window.location.origin}/api`;
    const token = getStoredToken();
    const hdrs: Record<string, string> = {};
    if (token) hdrs['Authorization'] = `Bearer ${token}`;
    const storedBrand = localStorage.getItem('nexus_active_brand_id') || localStorage.getItem('nexus.activeBrandId');
    if (storedBrand) hdrs['X-Brand-Id'] = storedBrand;
    const res = await fetch(`${base}/accounting/export-csv${params}`, { headers: hdrs });
    if (!res.ok) {
      toast.error('Erreur export CSV.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ecritures_comptables_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canCreate = hasPermission('accounting.create');
  const canDelete = hasPermission('accounting.delete');

  const entryColumns = useMemo<Column<EntryApi>[]>(() => [
    { key: 'date', header: 'Date', cell: (e) => <span className="text-sm font-black text-zinc-900">{fmtDate(String(e.entry_date))}</span> },
    { key: 'journal', header: 'Journal', cell: (e) => <StatusChip tone="info">{e.journal}</StatusChip> },
    {
      key: 'account', header: 'Compte', cell: (e) => (
        <div>
          <p className="text-sm font-black text-zinc-900">{e.account?.code ?? '—'}</p>
          <p className="text-[11px] text-zinc-500">{e.account?.label ?? ''}</p>
        </div>
      ),
    },
    { key: 'reference', header: 'Ref', cell: (e) => <span className="text-sm font-medium text-zinc-600">{e.reference || '—'}</span> },
    { key: 'label', header: 'Libelle', cell: (e) => <span className="text-sm font-bold text-zinc-800">{e.label}</span> },
    { key: 'debit', header: 'Debit', className: 'text-right', cell: (e) => <span className={`text-sm font-black ${Number(e.debit) > 0 ? 'text-rose-700' : 'text-zinc-400'}`}>{formatCurrency(Number(e.debit))}</span> },
    { key: 'credit', header: 'Credit', className: 'text-right', cell: (e) => <span className={`text-sm font-black ${Number(e.credit) > 0 ? 'text-emerald-700' : 'text-zinc-400'}`}>{formatCurrency(Number(e.credit))}</span> },
    { key: 'brand', header: 'Marque', cell: (e) => <span className="text-sm font-bold text-zinc-600">{e.brand?.name ?? 'Global'}</span> },
    ...(canDelete ? [{
      key: 'actions' as const,
      header: '',
      cell: (e: EntryApi) => (
        <button type="button" onClick={() => void onDeleteEntry(e.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600">
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    }] : []),
  ], [canDelete]);

  const accountColumns = useMemo<Column<AccountApi>[]>(() => [
    { key: 'code', header: 'Code', cell: (a) => <span className="text-sm font-black text-zinc-900">{a.code}</span> },
    { key: 'label', header: 'Libelle', cell: (a) => <span className="text-sm font-bold text-zinc-800">{a.label}</span> },
    { key: 'type', header: 'Type', cell: (a) => <StatusChip tone={a.type === 'produit' ? 'success' : a.type === 'charge' ? 'warning' : 'neutral'}>{ACCOUNT_TYPE_LABELS[a.type]}</StatusChip> },
    { key: 'parent', header: 'Parent', cell: (a) => <span className="text-sm text-zinc-600">{a.parent ? `${a.parent.code} - ${a.parent.label}` : '—'}</span> },
    { key: 'active', header: 'Actif', cell: (a) => <StatusChip tone={a.is_active ? 'success' : 'neutral'}>{a.is_active ? 'Oui' : 'Non'}</StatusChip> },
    ...(canDelete ? [{
      key: 'actions' as const,
      header: '',
      cell: (a: AccountApi) => (
        <button type="button" onClick={() => void onDeleteAccount(a.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600">
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    }] : []),
  ], [canDelete]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptabilite"
        right={
          <div className="flex gap-2">
            <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
              {([['entries', 'Ecritures'], ['accounts', 'Plan comptable']] as const).map(([id, label]) => (
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
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraichir
            </button>
            {tab === 'entries' && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-4 py-2 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}
            {canCreate && tab === 'entries' && (
              <button
                type="button"
                onClick={() => setCreateEntryOpen(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouvelle ecriture
              </button>
            )}
            {canCreate && tab === 'accounts' && (
              <button
                type="button"
                onClick={() => setCreateAccountOpen(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouveau compte
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card p-5 overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Debit</p>
          <p className="mt-2 text-lg md:text-xl font-black text-rose-700 truncate">{formatCurrency(summary?.total_debit ?? 0)}</p>
        </div>
        <div className="card p-5 overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Credit</p>
          <p className="mt-2 text-lg md:text-xl font-black text-emerald-700 truncate">{formatCurrency(summary?.total_credit ?? 0)}</p>
        </div>
        <div className="card p-5 overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Solde</p>
          <p className={`mt-2 text-lg md:text-xl font-black truncate ${(summary?.balance ?? 0) >= 0 ? 'text-zinc-900' : 'text-rose-700'}`}>
            {formatCurrency(summary?.balance ?? 0)}
          </p>
        </div>
        <div className="card p-5 overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ecritures</p>
          <p className="mt-2 text-lg md:text-xl font-black text-zinc-900 truncate">{summary?.entry_count ?? 0}</p>
        </div>
        <div className="card p-5 overflow-hidden">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Comptes actifs</p>
          <p className="mt-2 text-lg md:text-xl font-black text-zinc-900 truncate">{summary?.account_count ?? 0}</p>
        </div>
      </div>

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
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {tab === 'entries' && (
              <>
                <select
                  value={journalFilter}
                  onChange={(e) => setJournalFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
                >
                  <option value="all">Tous journaux</option>
                  {JOURNAL_OPTIONS.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
                  placeholder="Du"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
                  placeholder="Au"
                />
              </>
            )}
          </>
        }
      />

      {tab === 'entries' && (
        <DataTable
          rows={filteredEntries}
          columns={entryColumns}
          emptyTitle="Aucune ecriture"
          emptyDescription="Ajoutez des ecritures comptables pour commencer."
        />
      )}

      {tab === 'accounts' && (
        <DataTable
          rows={filteredAccounts}
          columns={accountColumns}
          emptyTitle="Aucun compte"
          emptyDescription="Creez votre plan comptable en ajoutant des comptes."
        />
      )}

      {canCreate && (
        <Modal
          open={createEntryOpen}
          title="Nouvelle ecriture comptable"
          subtitle="Saisissez une ecriture au journal."
          onClose={() => setCreateEntryOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateEntryOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">Annuler</button>
              <button type="button" onClick={() => void onCreateEntry()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700">Enregistrer</button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Compte</label>
              <select
                value={entryDraft.account_id}
                onChange={(e) => setEntryDraft((d) => ({ ...d, account_id: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
              >
                <option value="">-- Selectionner --</option>
                {accounts.filter((a) => a.is_active).map((a) => (
                  <option key={a.id} value={String(a.id)}>{a.code} - {a.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
              <input
                type="date"
                value={entryDraft.entry_date}
                onChange={(e) => setEntryDraft((d) => ({ ...d, entry_date: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Journal</label>
              <select
                value={entryDraft.journal}
                onChange={(e) => setEntryDraft((d) => ({ ...d, journal: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
              >
                {JOURNAL_OPTIONS.map((j) => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Reference</label>
              <input
                value={entryDraft.reference}
                onChange={(e) => setEntryDraft((d) => ({ ...d, reference: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="N facture, n piece..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Libelle</label>
              <input
                value={entryDraft.label}
                onChange={(e) => setEntryDraft((d) => ({ ...d, label: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Debit</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={entryDraft.debit || ''}
                onChange={(e) => setEntryDraft((d) => ({ ...d, debit: Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Credit</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={entryDraft.credit || ''}
                onChange={(e) => setEntryDraft((d) => ({ ...d, credit: Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </Modal>
      )}

      {canCreate && (
        <Modal
          open={createAccountOpen}
          title="Nouveau compte comptable"
          subtitle="Ajoutez un compte au plan comptable."
          onClose={() => setCreateAccountOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateAccountOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">Annuler</button>
              <button type="button" onClick={() => void onCreateAccount()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700">Enregistrer</button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Code</label>
              <input
                value={accountDraft.code}
                onChange={(e) => setAccountDraft((d) => ({ ...d, code: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ex: 6010"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</label>
              <select
                value={accountDraft.type}
                onChange={(e) => setAccountDraft((d) => ({ ...d, type: e.target.value as AccountType }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
              >
                {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((k) => (
                  <option key={k} value={k}>{ACCOUNT_TYPE_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Libelle</label>
              <input
                value={accountDraft.label}
                onChange={(e) => setAccountDraft((d) => ({ ...d, label: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Compte parent</label>
              <select
                value={accountDraft.parent_id}
                onChange={(e) => setAccountDraft((d) => ({ ...d, parent_id: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
              >
                <option value="">Aucun (racine)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>{a.code} - {a.label}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
