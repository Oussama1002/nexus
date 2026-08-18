import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Users, UserCheck, PalmtreeIcon, UserPlus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type Employee = {
  id: number;
  name: string;
  position: string;
  department: string;
  phone: string;
  email: string;
  status: string;
  hired_at: string;
  avatar_url?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  Actif: 'bg-emerald-50 text-emerald-700',
  'Congé': 'bg-amber-50 text-amber-700',
  Suspendu: 'bg-red-50 text-red-700',
};

export function EmployeesScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api.get<Paginated<Employee>>(
        'employees' + buildQuery({ per_page: 25, page, search: search || undefined, department: deptFilter || undefined, status: statusFilter || undefined }),
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
  }, [page, search, deptFilter, statusFilter, toast]);

  const departments = useMemo(() => {
    const s = new Set(rows.map((r) => r.department).filter(Boolean));
    return Array.from(s).sort();
  }, [rows]);

  const stats = useMemo(() => {
    const actifs = rows.filter((r) => r.status === 'Actif').length;
    const conge = rows.filter((r) => r.status === 'Congé').length;
    const now = new Date();
    const nouveaux = rows.filter((r) => {
      const d = new Date(r.hired_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total, actifs, conge, nouveaux };
  }, [rows, total]);

  function initials(name: string) {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiches employés"
        subtitle="Répertoire complet des collaborateurs"
        right={
          <button className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Ajouter un employé
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total employés</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.total}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Actifs</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.actifs}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En congé</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.conge}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nouveaux ce mois</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.nouveaux}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les départements</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les statuts</option>
          <option value="Actif">Actif</option>
          <option value="Congé">En congé</option>
          <option value="Suspendu">Suspendu</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun employé trouvé" description="Ajoutez un employé pour commencer." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Photo</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Poste</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Département</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Téléphone</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Email</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date embauche</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-black">
                        {initials(r.name)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.position}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.department}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.phone}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.email}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[r.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{new Date(r.hired_at).toLocaleDateString('fr-FR')}</td>
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
