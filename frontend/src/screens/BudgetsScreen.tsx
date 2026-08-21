import React, { useEffect, useState } from 'react';
import { PieChart, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type Budget = {
  id: number;
  name: string;
  department: string;
  allocated: number;
  spent: number;
  remaining: number;
  usage: number;
  period: string;
  status: string;
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'Actif' },
  { value: 'closed', label: 'Clôturé' },
  { value: 'exceeded', label: 'Dépassé' },
];

const DEPARTMENT_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Ventes' },
  { value: 'hr', label: 'RH' },
  { value: 'tech', label: 'Technique' },
  { value: 'operations', label: 'Opérations' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  closed: 'bg-zinc-100 text-zinc-600',
  exceeded: 'bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  closed: 'Clôturé',
  exceeded: 'Dépassé',
};

const fmtMAD = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(n);

export function BudgetsScreen() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();
  const [rows, setRows] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', department: 'marketing', period_label: '',
    period_start: '', period_end: '', allocated: '', notes: '',
  });

  const submitCreate = async () => {
    if (!form.name.trim() || !form.period_start || !form.period_end || !form.allocated) {
      toast('error', 'Champs requis manquants.'); return;
    }
    setSaving(true);
    try {
      const res = await api.post('budgets', {
        name: form.name, department: form.department,
        period_label: form.period_label || undefined,
        period_start: form.period_start, period_end: form.period_end,
        allocated: Number(form.allocated),
        notes: form.notes || undefined,
      });
      if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
      toast('success', 'Budget créé.');
      setShowCreate(false);
      setForm({ name: '', department: 'marketing', period_label: '', period_start: '', period_end: '', allocated: '', notes: '' });
      setReloadTick((t) => t + 1);
    } finally { setSaving(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<Budget>>(
          'budgets' + buildQuery({ per_page: 25, page, search: search || undefined, status: statusFilter || undefined, department: departmentFilter || undefined })
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
  }, [page, search, statusFilter, departmentFilter, activeBrandId, reloadTick]);

  const activeCount = rows.filter(r => r.status === 'active').length;
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Budgets" subtitle="Budgets prévisionnels et suivi des enveloppes">
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Nouveau budget
        </button>
      </PageHeader>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouveau budget</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Nom *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Département
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {DEPARTMENT_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Libellé période
                <input placeholder="2026-Q3" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.period_label} onChange={(e) => setForm({ ...form, period_label: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Début *
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Fin *
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Montant alloué (MAD) *
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.allocated} onChange={(e) => setForm({ ...form, allocated: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Notes
                <textarea rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={submitCreate} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">{saving ? 'Envoi…' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Budgets actifs</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Budget total</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{fmtMAD(totalAllocated)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Consommé</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{fmtMAD(totalSpent)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Restant</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{fmtMAD(totalRemaining)}</p>
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
          value={departmentFilter}
          onChange={e => { setDepartmentFilter(e.target.value); setPage(1); }}
        >
          {DEPARTMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<PieChart size={40} />} title="Aucun budget" description="Aucun budget trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Département</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Montant alloué</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Consommé</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Restant</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Utilisation</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Période</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => {
                const pct = Math.round(row.usage);
                return (
                  <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{row.department}</td>
                    <td className="px-4 py-3 text-sm">{fmtMAD(row.allocated)}</td>
                    <td className="px-4 py-3 text-sm">{fmtMAD(row.spent)}</td>
                    <td className="px-4 py-3 text-sm">{fmtMAD(row.remaining)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#22c55e' }} />
                        </div>
                        <span className="text-xs font-bold">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{row.period}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
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
