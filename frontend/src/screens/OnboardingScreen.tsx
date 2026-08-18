import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { UserPlus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

type OnboardingEntry = {
  id: number;
  employee_name: string;
  position: string;
  start_date: string;
  progress: number;
  steps_completed: number;
  total_steps: number;
  mentor_name: string;
  status: string;
};

const statusColor: Record<string, string> = {
  'En cours': 'bg-blue-50 text-blue-700',
  'Terminé': 'bg-emerald-50 text-emerald-700',
  'Bloqué': 'bg-red-50 text-red-700',
};

export function OnboardingScreen() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OnboardingEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ inProgress: 0, completed: 0, avgCompletion: 0, avgDuration: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<OnboardingEntry>>('onboarding' + buildQuery({ per_page: 25, page }));
        if (!res.ok) { setRows([]); return; }
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
        const d = res.data.data;
        const inProgress = d.filter(r => r.status === 'En cours').length;
        const completed = d.filter(r => r.status === 'Terminé').length;
        const avgCompletion = d.length ? Math.round(d.reduce((s, r) => s + r.progress, 0) / d.length) : 0;
        setStats({ inProgress, completed, avgCompletion, avgDuration: 14 });
      } catch {
        toast('Erreur lors du chargement des intégrations', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const filtered = rows.filter(r => {
    if (search && !r.employee_name.toLowerCase().includes(search.toLowerCase()) && !r.position.toLowerCase().includes(search.toLowerCase())) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Intégration" subtitle="Parcours d'intégration des nouveaux collaborateurs" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En cours</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.inProgress}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Terminés ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.completed}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taux complétion moyen</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.avgCompletion}%</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Durée moyenne (jours)</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.avgDuration}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="En cours">En cours</option>
          <option value="Terminé">Terminé</option>
          <option value="Bloqué">Bloqué</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserPlus} title="Aucune intégration" description="Aucun parcours d'intégration en cours." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Poste</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date début</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Progression</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Étapes complétées</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Mentor</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{r.employee_name}</td>
                    <td className="px-4 py-3 text-sm">{r.position}</td>
                    <td className="px-4 py-3 text-sm">{new Date(r.start_date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${r.progress}%` }} />
                        </div>
                        <span className="text-zinc-500 text-xs">{r.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{r.steps_completed}/{r.total_steps}</td>
                    <td className="px-4 py-3 text-sm">{r.mentor_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[r.status] || 'bg-zinc-100 text-zinc-600'}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{total} résultat{total > 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium">{page} / {lastPage}</span>
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
