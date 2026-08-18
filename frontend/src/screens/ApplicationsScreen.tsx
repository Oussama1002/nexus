import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { FileText, Plus, Search, Star, ChevronLeft, ChevronRight } from 'lucide-react';

type Application = {
  id: number;
  candidate_name: string;
  position_title: string;
  source: string;
  applied_at: string;
  status: string;
  rating: number;
  recruiter: string;
};

const statusColor: Record<string, string> = {
  'Reçue': 'bg-zinc-100 text-zinc-600',
  'Présélectionnée': 'bg-blue-50 text-blue-700',
  'Entretien': 'bg-amber-50 text-amber-700',
  'Retenue': 'bg-emerald-50 text-emerald-700',
  'Refusée': 'bg-red-50 text-red-700',
};

export function ApplicationsScreen() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Application[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [position, setPosition] = useState('');
  const [stats, setStats] = useState({ total: 0, inProgress: 0, interview: 0, retained: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<Application>>('applications' + buildQuery({ per_page: 25, page }));
        if (!res.ok) { setRows([]); return; }
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
        const d = res.data.data;
        setStats({
          total: res.data.total,
          inProgress: d.filter(r => ['Reçue', 'Présélectionnée'].includes(r.status)).length,
          interview: d.filter(r => r.status === 'Entretien').length,
          retained: d.filter(r => r.status === 'Retenue').length,
        });
      } catch {
        toast('Erreur lors du chargement des candidatures', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const filtered = rows.filter(r => {
    if (search && !r.candidate_name.toLowerCase().includes(search.toLowerCase()) && !r.position_title.toLowerCase().includes(search.toLowerCase())) return false;
    if (status && r.status !== status) return false;
    if (position && r.position_title !== position) return false;
    return true;
  });

  const positions = [...new Set(rows.map(r => r.position_title))];

  function renderStars(rating: number) {
    return (
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={12} className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-zinc-200'} />
        ))}
        <span className="ml-1 text-zinc-500">{rating}/5</span>
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Candidatures" subtitle="Suivi des candidatures reçues">
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Ajouter une candidature
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total reçues</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En cours</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.inProgress}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Entretien planifié</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.interview}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Retenues</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.retained}</p>
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
          <option value="Reçue">Reçue</option>
          <option value="Présélectionnée">Présélectionnée</option>
          <option value="Entretien">Entretien</option>
          <option value="Retenue">Retenue</option>
          <option value="Refusée">Refusée</option>
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={position} onChange={e => setPosition(e.target.value)}>
          <option value="">Tous les postes</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune candidature" description="Aucune candidature ne correspond à vos critères." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Candidat</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Poste</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Source</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Note</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{r.candidate_name}</td>
                    <td className="px-4 py-3 text-sm">{r.position_title}</td>
                    <td className="px-4 py-3 text-sm">{r.source}</td>
                    <td className="px-4 py-3 text-sm">{new Date(r.applied_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[r.status] || 'bg-zinc-100 text-zinc-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{renderStars(r.rating)}</td>
                    <td className="px-4 py-3 text-sm">{r.recruiter}</td>
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
