import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type LeaveRow = {
  id: number;
  employee_id: number;
  employee?: { id: number; full_name: string; department?: string | null };
  leave_type: string;
  start_date: string;
  end_date: string;
  days_count: number | string;
  reason: string | null;
  status: 'en_attente' | 'approuve' | 'refuse';
  approved_by?: { id: number; name: string } | null;
  approved_at?: string | null;
  approval_comment?: string | null;
  refusal_reason?: string | null;
};

type EmployeeOption = { id: number; full_name: string };

const LEAVE_TYPES = [
  { value: 'conge_paye', label: 'Congé payé' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'sans_solde', label: 'Sans solde' },
  { value: 'maternite', label: 'Maternité' },
  { value: 'paternite', label: 'Paternité' },
  { value: 'exceptionnel', label: 'Exceptionnel' },
];

const TYPE_LABEL = (v: string) => LEAVE_TYPES.find((t) => t.value === v)?.label ?? v;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  en_attente: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  approuve: { label: 'Approuvé', cls: 'bg-emerald-50 text-emerald-700' },
  refuse: { label: 'Refusé', cls: 'bg-red-50 text-red-700' },
};

export function LeavesScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    leave_type: 'conge_paye',
    start_date: '',
    end_date: '',
    days_count: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);

  const [refusing, setRefusing] = useState<{ id: number } | null>(null);
  const [refuseReason, setRefuseReason] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await api.get<Paginated<LeaveRow>>(
      'hr/leaves' + buildQuery({ per_page: 25, page, status: statusFilter || undefined, leave_type: typeFilter || undefined }),
    );
    setLoading(false);
    if (!res.ok) { toast.error(res.message); setRows([]); return; }
    setRows(res.data.data);
    setTotal(res.data.total);
    setLastPage(res.data.last_page);
  };

  useEffect(() => { load(); }, [page, statusFilter, typeFilter]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<EmployeeOption>>('hr' + buildQuery({ per_page: 100 }));
      if (res.ok) setEmployees(res.data.data.map((e: any) => ({ id: e.id, full_name: e.full_name })));
    })();
  }, []);

  const stats = useMemo(() => {
    const enAttente = rows.filter((r) => r.status === 'en_attente').length;
    const approuves = rows.filter((r) => r.status === 'approuve').length;
    const refuses = rows.filter((r) => r.status === 'refuse').length;
    const total = rows.reduce((s, r) => s + Number(r.days_count || 0), 0);
    return { enAttente, approuves, refuses, total };
  }, [rows]);

  const save = async () => {
    if (!form.employee_id || !form.start_date || !form.end_date || !form.days_count) {
      toast.error('Champs requis manquants.'); return;
    }
    setSaving(true);
    const res = await api.post('hr/leaves', {
      employee_id: Number(form.employee_id),
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      days_count: Number(form.days_count),
      reason: form.reason || undefined,
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Demande créée.');
    setShowCreate(false);
    setForm({ employee_id: '', leave_type: 'conge_paye', start_date: '', end_date: '', days_count: '', reason: '' });
    load();
  };

  const approve = async (id: number) => {
    const res = await api.post(`hr/leaves/${id}/approve`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Congé approuvé.');
    load();
  };

  const refuse = async () => {
    if (!refusing || !refuseReason.trim()) { toast.error('Motif requis.'); return; }
    const res = await api.post(`hr/leaves/${refusing.id}/refuse`, { refusal_reason: refuseReason });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Congé refusé.');
    setRefusing(null);
    setRefuseReason('');
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Congés & Absences"
        subtitle="Gestion des demandes de congés"
        right={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle demande
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En attente</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.enAttente}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Approuvés</p><p className="text-2xl font-black text-emerald-600 mt-1">{stats.approuves}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Refusés</p><p className="text-2xl font-black text-red-600 mt-1">{stats.refuses}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Jours totaux</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.total}</p></div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="approuve">Approuvé</option>
          <option value="refuse">Refusé</option>
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">Tous les types</option>
          {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune demande de congé" description="Les demandes apparaîtront ici." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Du</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Au</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Jours</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Motif</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? { label: r.status, cls: 'bg-zinc-100 text-zinc-600' };
                  return (
                    <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.employee?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-50 text-blue-700">{TYPE_LABEL(r.leave_type)}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{new Date(r.start_date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{new Date(r.end_date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.days_count}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500 max-w-xs truncate">{r.reason ?? r.refusal_reason ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {r.status === 'en_attente' && (
                          <div className="inline-flex gap-1">
                            <button onClick={() => approve(r.id)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Approuver"><Check className="w-4 h-4" /></button>
                            <button onClick={() => { setRefusing({ id: r.id }); setRefuseReason(''); }} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Refuser"><X className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle demande de congé</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Employé
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                  <option value="">— sélectionner —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Type de congé
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                  {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Date début
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Date fin
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Nombre de jours
                <input type="number" step="0.5" min="0.5" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.days_count} onChange={(e) => setForm({ ...form, days_count: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Motif
                <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">{saving ? 'Envoi…' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}

      {refusing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Refuser la demande</h2>
            <label className="block text-sm font-bold text-zinc-700">Motif du refus
              <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={4} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRefusing(null)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={refuse} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-black">Refuser</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
