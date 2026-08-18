import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { Briefcase, AlertTriangle, Users, CheckCircle, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

type OpenPosition = {
  id: number;
  title: string;
  department: string;
  contract_type: string;
  location: string;
  applications_count: number;
  priority: string;
  status: string;
  published_at: string;
};

const priorityColor: Record<string, string> = {
  Urgent: 'bg-red-50 text-red-700',
  Normal: 'bg-blue-50 text-blue-700',
  Faible: 'bg-zinc-100 text-zinc-600',
};

const statusColor: Record<string, string> = {
  Ouvert: 'bg-emerald-50 text-emerald-700',
  Pourvu: 'bg-blue-50 text-blue-700',
  'Clôturé': 'bg-zinc-100 text-zinc-600',
};

export function OpenPositionsScreen() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OpenPosition[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ open: 0, urgent: 0, applications: 0, filled: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<OpenPosition>>('open-positions' + buildQuery({ per_page: 25, page }));
        if (!res.ok) { setRows([]); return; }
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
        setStats({
          open: res.data.data.filter(r => r.status === 'Ouvert').length,
          urgent: res.data.data.filter(r => r.priority === 'Urgent').length,
          applications: res.data.data.reduce((s, r) => s + r.applications_count, 0),
          filled: res.data.data.filter(r => r.status === 'Pourvu').length,
        });
      } catch {
        toast('Erreur lors du chargement des postes', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const filtered = rows.filter(r => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.department.toLowerCase().includes(search.toLowerCase())) return false;
    if (department && r.department !== department) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  const departments = [...new Set(rows.map(r => r.department))];

  return (
    <div className="space-y-6">
      <PageHeader title="Postes ouverts" subtitle="Offres d'emploi et besoins en recrutement">
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouveau poste
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Postes ouverts</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.open}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Urgents</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.urgent}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Candidatures reçues</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.applications}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pourvus ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.filled}</p>
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
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={department} onChange={e => setDepartment(e.target.value)}>
          <option value="">Tous les départements</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="Ouvert">Ouvert</option>
          <option value="Pourvu">Pourvu</option>
          <option value="Clôturé">Clôturé</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Briefcase} title="Aucun poste trouvé" description="Aucun poste ne correspond à vos critères de recherche." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Intitulé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Département</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type contrat</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Lieu</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Candidatures</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Priorité</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Publié le</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{r.title}</td>
                    <td className="px-4 py-3 text-sm">{r.department}</td>
                    <td className="px-4 py-3 text-sm">{r.contract_type}</td>
                    <td className="px-4 py-3 text-sm">{r.location}</td>
                    <td className="px-4 py-3 text-sm">{r.applications_count}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${priorityColor[r.priority] || 'bg-zinc-100 text-zinc-600'}`}>{r.priority}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[r.status] || 'bg-zinc-100 text-zinc-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{new Date(r.published_at).toLocaleDateString('fr-FR')}</td>
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
