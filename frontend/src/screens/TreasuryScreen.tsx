import React, { useEffect, useState } from 'react';
import { Wallet, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type TreasuryRow = {
  id: number;
  date: string;
  label: string;
  type: string;
  category: string;
  amount: number;
  running_balance: number;
  reference: string | null;
  account: string;
};

type TreasurySummary = {
  total_balance: number;
  income_this_month: number;
  expense_this_month: number;
  variation: number;
};

const TYPE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'income', label: 'Entrée' },
  { value: 'expense', label: 'Sortie' },
];

const TYPE_COLORS: Record<string, string> = {
  income: 'bg-green-50 text-green-700',
  expense: 'bg-red-50 text-red-700',
};

const TYPE_LABELS: Record<string, string> = {
  income: 'Entrée',
  expense: 'Sortie',
};

const fmtMAD = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(n);

export function TreasuryScreen() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();
  const [rows, setRows] = useState<TreasuryRow[]>([]);
  const [summary, setSummary] = useState<TreasurySummary>({ total_balance: 0, income_this_month: 0, expense_this_month: 0, variation: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<TreasuryRow>>(
          'treasury' + buildQuery({ per_page: 25, page, search: search || undefined, type: typeFilter || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined })
        );
        if (cancelled) return;
        if (res.ok) {
          setRows(res.data.data);
          setTotal(res.data.total);
          setLastPage(res.data.last_page);
        } else {
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [page, search, typeFilter, dateFrom, dateTo, activeBrandId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<TreasurySummary>('treasury/summary');
        if (!cancelled && res.ok) setSummary(res.data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [activeBrandId]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Trésorerie" subtitle="Suivi de la trésorerie et des flux financiers" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Solde total</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{fmtMAD(summary.total_balance)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Entrées ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{fmtMAD(summary.income_this_month)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sorties ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{fmtMAD(summary.expense_this_month)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Variation</p>
          <p className={`text-2xl font-black mt-1 ${summary.variation >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmtMAD(summary.variation)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
            placeholder="Rechercher…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          type="date"
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
        />
        <input
          type="date"
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
        />
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<Wallet size={40} />} title="Aucun mouvement" description="Aucun mouvement de trésorerie trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Libellé</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Catégorie</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Montant</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Solde cumulé</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Référence</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Compte</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(row.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm">{row.label}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLORS[row.type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {TYPE_LABELS[row.type] ?? row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.category}</td>
                  <td className={`px-4 py-3 text-sm font-medium ${row.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {row.type === 'income' ? '+' : '-'}{fmtMAD(Math.abs(row.amount))}
                  </td>
                  <td className="px-4 py-3 text-sm">{fmtMAD(row.running_balance)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.reference ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.account}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">Page {page} sur {lastPage} — {total} résultat(s)</p>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary p-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-secondary p-2" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
