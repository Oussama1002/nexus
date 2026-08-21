import React, { useEffect, useState } from 'react';
import { FileText, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type BudgetRequest = {
  id: number;
  requester_name: string;
  budget_name: string;
  amount: number;
  reason: string;
  priority: string;
  status: string;
  created_at: string;
  approved_by: string | null;
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'approved', label: 'Approuvée' },
  { value: 'rejected', label: 'Refusée' },
  { value: 'partial', label: 'Partiellement' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'high', label: 'Haute' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Basse' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
  partial: 'bg-blue-50 text-blue-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
  partial: 'Partiellement',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-700',
  medium: 'bg-orange-50 text-orange-700',
  low: 'bg-green-50 text-green-700',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

const fmtMAD = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(n);

type BudgetOpt = { id: number; name: string };

export function BudgetRequestsScreen() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();
  const [rows, setRows] = useState<BudgetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [budgets, setBudgets] = useState<BudgetOpt[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ budget_id: '', amount: '', reason: '', priority: 'medium' });

  const submitCreate = async () => {
    if (!form.amount || !form.reason.trim()) { toast('error', 'Montant et motif requis.'); return; }
    setSaving(true);
    try {
      const res = await api.post('budget-requests', {
        budget_id: form.budget_id ? Number(form.budget_id) : undefined,
        amount: Number(form.amount),
        reason: form.reason,
        priority: form.priority,
      });
      if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
      toast('success', 'Demande créée.');
      setShowCreate(false);
      setForm({ budget_id: '', amount: '', reason: '', priority: 'medium' });
      setReloadTick((t) => t + 1);
    } finally { setSaving(false); }
  };

  const approve = async (id: number) => {
    const res = await api.post(`budget-requests/${id}/approve`, {});
    if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
    toast('success', 'Approuvée.');
    setReloadTick((t) => t + 1);
  };

  const reject = async (id: number) => {
    const note = prompt('Motif du refus ?'); if (!note) return;
    const res = await api.post(`budget-requests/${id}/reject`, { decision_note: note });
    if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
    toast('success', 'Refusée.');
    setReloadTick((t) => t + 1);
  };

  useEffect(() => {
    (async () => {
      const r = await api.get<Paginated<any>>('budgets' + buildQuery({ per_page: 100 }));
      if (r.ok) setBudgets(r.data.data.map((b: any) => ({ id: b.id, name: b.name })));
    })();
  }, [activeBrandId]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<BudgetRequest>>(
          'budget-requests' + buildQuery({ per_page: 25, page, search: search || undefined, status: statusFilter || undefined, priority: priorityFilter || undefined })
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
  }, [page, search, statusFilter, priorityFilter, activeBrandId, reloadTick]);

  const pendingCount = rows.filter(r => r.status === 'pending').length;
  const approvedCount = rows.filter(r => r.status === 'approved').length;
  const rejectedCount = rows.filter(r => r.status === 'rejected').length;
  const totalRequested = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Demandes de budget" subtitle="Demandes d'allocation et de dépassement budgétaire">
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Nouvelle demande
        </button>
      </PageHeader>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle demande de budget</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Budget concerné
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.budget_id} onChange={(e) => setForm({ ...form, budget_id: e.target.value })}>
                  <option value="">— aucun / hors budget —</option>
                  {budgets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Montant demandé (MAD) *
                <input type="number" step="0.01" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Priorité
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Motif *
                <textarea rows={4} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
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
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En attente</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{pendingCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Approuvées ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{approvedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Refusées</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{rejectedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Montant total demandé</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{fmtMAD(totalRequested)}</p>
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
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
        >
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<FileText size={40} />} title="Aucune demande" description="Aucune demande de budget trouvée pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">N°</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Demandeur</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Budget</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Montant demandé</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Motif</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Priorité</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Validé par</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm font-medium">#{row.id}</td>
                  <td className="px-4 py-3 text-sm">{row.requester_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.budget_name}</td>
                  <td className="px-4 py-3 text-sm">{fmtMAD(row.amount)}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.reason.length > 50 ? row.reason.slice(0, 50) + '…' : row.reason}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_COLORS[row.priority] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {PRIORITY_LABELS[row.priority] ?? row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(row.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.approved_by ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {row.status === 'pending' && (
                      <div className="inline-flex gap-1">
                        <button onClick={() => approve(row.id)} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black">✓</button>
                        <button onClick={() => reject(row.id)} className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-black">✗</button>
                      </div>
                    )}
                  </td>
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
