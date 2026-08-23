import React, { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type AttendanceRow = {
  id: number;
  attendance_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: 'present' | 'late' | 'absent' | string;
  minutes_late: number | null;
  justification_status?: string | null;
  justification_reason?: string | null;
  employee?: { id: number; full_name: string } | null;
  manager_marked_by?: { id: number; name: string } | null;
};

type EmployeeOpt = { id: number; full_name: string };

const STATUS_LABELS: Record<string, string> = {
  present: 'Présent',
  late: 'Retard',
  absent: 'Absent',
};

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  late: 'bg-amber-50 text-amber-700',
  absent: 'bg-red-50 text-red-700',
};

const fmtTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const durationHm = (a: string | null, b: string | null) => {
  if (!a || !b) return '—';
  const secs = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
};

export function AttendanceScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);

  const [markOpen, setMarkOpen] = useState(false);
  const [markForm, setMarkForm] = useState({
    employee_id: '',
    attendance_date: new Date().toISOString().slice(0, 10),
    status: 'present',
    minutes_late: '',
    justification_reason: '',
  });
  const [markSaving, setMarkSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api.get<Paginated<AttendanceRow>>(
        'hr/attendance' + buildQuery({
          per_page: 50,
          page,
          date: dateFilter || undefined,
          status: statusFilter || undefined,
          employee_id: employeeFilter || undefined,
        }),
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
  }, [page, dateFilter, statusFilter, employeeFilter, reloadTick, toast]);

  useEffect(() => {
    (async () => {
      const r = await api.get<Paginated<EmployeeOpt>>('hr' + buildQuery({ per_page: 200, status: 'active' }));
      if (r.ok) setEmployees(r.data.data.map((e: any) => ({ id: e.id, full_name: e.full_name })));
    })();
  }, []);

  const stats = useMemo(() => {
    const presents = rows.filter((r) => r.status === 'present').length;
    const retards = rows.filter((r) => r.status === 'late').length;
    const absents = rows.filter((r) => r.status === 'absent').length;
    const counted = presents + retards + absents;
    const taux = counted > 0 ? Math.round(((presents + retards) / counted) * 100) : 0;
    return { presents, retards, absents, taux };
  }, [rows]);

  const clockInNow = async () => {
    const r = await api.post('hr/attendance/clock-in', {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Pointage enregistré.');
    setReloadTick((t) => t + 1);
  };

  const submitMark = async () => {
    if (!markForm.employee_id || !markForm.attendance_date) {
      toast.error('Employé et date requis.'); return;
    }
    setMarkSaving(true);
    try {
      const res = await api.post('hr/attendance/manager-mark', {
        employee_id: Number(markForm.employee_id),
        attendance_date: markForm.attendance_date,
        status: markForm.status,
        minutes_late: markForm.status === 'late' ? Number(markForm.minutes_late || 0) : undefined,
        justification_reason: markForm.justification_reason || undefined,
      });
      if (!res.ok) { toast.error(res.message); return; }
      toast.success('Pointage marqué.');
      setMarkOpen(false);
      setMarkForm({
        employee_id: '',
        attendance_date: new Date().toISOString().slice(0, 10),
        status: 'present',
        minutes_late: '',
        justification_reason: '',
      });
      setReloadTick((t) => t + 1);
    } finally { setMarkSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Présence & Pointage"
        subtitle="Suivi des pointages et présence quotidienne"
        right={
          <div className="flex gap-2">
            <button onClick={clockInNow} className="px-4 py-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-black inline-flex items-center gap-2">
              <Clock className="w-4 h-4" /> Pointer maintenant
            </button>
            <button onClick={() => setMarkOpen(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black">
              Marquer un employé
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Présents</p><p className="text-2xl font-black text-emerald-600 mt-1">{stats.presents}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En retard</p><p className="text-2xl font-black text-amber-600 mt-1">{stats.retards}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Absents</p><p className="text-2xl font-black text-red-600 mt-1">{stats.absents}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taux de présence</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.taux}%</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
        />
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les statuts</option>
          <option value="present">Présent</option>
          <option value="late">Retard</option>
          <option value="absent">Absent</option>
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium max-w-xs"
          value={employeeFilter}
          onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les employés</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun pointage" description="Les pointages du jour sélectionné apparaîtront ici." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Arrivée</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Départ</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Durée</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Retard</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Justificatif</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{new Date(r.attendance_date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{fmtTime(r.clock_in_at)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{fmtTime(r.clock_out_at)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{durationHm(r.clock_in_at, r.clock_out_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[r.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{r.minutes_late ? `${r.minutes_late} min` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{r.justification_reason ?? '—'}</td>
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

      {markOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Marquer un pointage</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Employé *
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={markForm.employee_id} onChange={(e) => setMarkForm({ ...markForm, employee_id: e.target.value })}>
                  <option value="">— sélectionner —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Date
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={markForm.attendance_date} onChange={(e) => setMarkForm({ ...markForm, attendance_date: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Statut
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={markForm.status} onChange={(e) => setMarkForm({ ...markForm, status: e.target.value })}>
                  <option value="present">Présent</option>
                  <option value="late">Retard</option>
                  <option value="absent">Absent</option>
                </select>
              </label>
              {markForm.status === 'late' && (
                <label className="col-span-2 text-sm font-bold text-zinc-700">Minutes de retard
                  <input type="number" min="0" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={markForm.minutes_late} onChange={(e) => setMarkForm({ ...markForm, minutes_late: e.target.value })} />
                </label>
              )}
              <label className="col-span-2 text-sm font-bold text-zinc-700">Justificatif (optionnel)
                <textarea rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={markForm.justification_reason} onChange={(e) => setMarkForm({ ...markForm, justification_reason: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setMarkOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={submitMark} disabled={markSaving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">{markSaving ? 'Envoi…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
