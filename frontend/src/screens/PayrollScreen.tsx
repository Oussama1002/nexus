import React, { useEffect, useMemo, useState } from 'react';
import { Banknote } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type PayrollRow = {
  id: number;
  employee_name: string;
  period: string;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  status: string;
  paid_at: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  Brouillon: 'bg-zinc-100 text-zinc-600',
  'Validé': 'bg-blue-50 text-blue-700',
  'Payé': 'bg-emerald-50 text-emerald-700',
};

const formatMAD = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(n);

export function PayrollScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api.get<Paginated<PayrollRow>>(
        'payroll' + buildQuery({ per_page: 25, page, search: search || undefined, period: periodFilter || undefined, status: statusFilter || undefined }),
      );
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.message);
        setRows([]);
        return;
      }
      setRows(res.data.data);
      setTotal(res.data.total);
      setLastPage(res.data.last_page);
    })();
    return () => { cancelled = true; };
  }, [page, search, periodFilter, statusFilter, toast]);

  const stats = useMemo(() => {
    const masse = rows.reduce((s, r) => s + r.gross_salary, 0);
    const generes = rows.length;
    const enAttente = rows.filter((r) => r.status === 'Brouillon').length;
    const charges = rows.reduce((s, r) => s + r.deductions, 0);
    return { masse, generes, enAttente, charges };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paie"
        subtitle="Bulletins de paie et masse salariale"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Masse salariale</p><p className="text-2xl font-black text-zinc-900 mt-1">{formatMAD(stats.masse)}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Bulletins générés</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.generes}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En attente validation</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.enAttente}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Charges sociales</p><p className="text-2xl font-black text-zinc-900 mt-1">{formatMAD(stats.charges)}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <input
          type="month"
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={periodFilter}
          onChange={(e) => { setPeriodFilter(e.target.value); setPage(1); }}
        />
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les statuts</option>
          <option value="Brouillon">Brouillon</option>
          <option value="Validé">Validé</option>
          <option value="Payé">Payé</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun bulletin de paie" description="Les bulletins de paie apparaîtront ici." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Période</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Salaire brut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Déductions</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Net à payer</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date paiement</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.employee_name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.period}</td>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{formatMAD(r.gross_salary)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600">{formatMAD(r.deductions)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-emerald-700">{formatMAD(r.net_salary)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[r.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.paid_at ? new Date(r.paid_at).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Page {page} sur {lastPage} — {total} résultats</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold disabled:opacity-40">Précédent</button>
              <button disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold disabled:opacity-40">Suivant</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
