import React, { useEffect, useMemo, useState } from 'react';
import { Clock, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type AttendanceRow = {
  id: number;
  employee_name: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  duration: string | null;
  status: string;
  note: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  'Présent': 'bg-emerald-50 text-emerald-700',
  Absent: 'bg-red-50 text-red-700',
  Retard: 'bg-amber-50 text-amber-700',
  'Congé': 'bg-blue-50 text-blue-700',
};

export function AttendanceScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api.get<Paginated<AttendanceRow>>(
        'attendance' + buildQuery({ per_page: 25, page, search: search || undefined, date: dateFilter || undefined, status: statusFilter || undefined }),
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
  }, [page, search, dateFilter, statusFilter, toast]);

  const stats = useMemo(() => {
    const presents = rows.filter((r) => r.status === 'Présent').length;
    const absents = rows.filter((r) => r.status === 'Absent').length;
    const retards = rows.filter((r) => r.status === 'Retard').length;
    const taux = rows.length > 0 ? Math.round((presents / rows.length) * 100) : 0;
    return { presents, absents, retards, taux };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Présence & Pointage"
        subtitle="Suivi des pointages et présence quotidienne"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Présents aujourd'hui</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.presents}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Absents</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.absents}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En retard</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.retards}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taux de présence</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.taux}%</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
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
          <option value="Présent">Présent</option>
          <option value="Absent">Absent</option>
          <option value="Retard">Retard</option>
          <option value="Congé">Congé</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun pointage trouvé" description="Les données de présence apparaîtront ici." />
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
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Remarque</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.employee_name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.clock_in ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.clock_out ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.duration ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[r.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{r.note ?? '—'}</td>
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
