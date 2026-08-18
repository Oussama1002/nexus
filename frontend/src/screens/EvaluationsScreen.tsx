import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { ClipboardCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react';

type Evaluation = {
  id: number;
  employee_name: string;
  evaluator_name: string;
  period: string;
  overall_score: number;
  objectives_met: number;
  recommendation: string;
  status: string;
  date: string;
};

const statusColor: Record<string, string> = {
  'Planifié': 'bg-zinc-100 text-zinc-600',
  'En cours': 'bg-blue-50 text-blue-700',
  'Complété': 'bg-emerald-50 text-emerald-700',
};

const recommendationColor: Record<string, string> = {
  Promotion: 'bg-emerald-50 text-emerald-700',
  Maintien: 'bg-blue-50 text-blue-700',
  Formation: 'bg-amber-50 text-amber-700',
  Alerte: 'bg-red-50 text-red-700',
};

export function EvaluationsScreen() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Evaluation[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ inProgress: 0, completed: 0, avgScore: 0, devPlans: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<Evaluation>>('evaluations' + buildQuery({ per_page: 25, page }));
        if (!res.ok) { setRows([]); return; }
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
        const d = res.data.data;
        setStats({
          inProgress: d.filter(r => r.status === 'En cours').length,
          completed: d.filter(r => r.status === 'Complété').length,
          avgScore: d.length ? +(d.reduce((s, r) => s + r.overall_score, 0) / d.length).toFixed(1) : 0,
          devPlans: d.filter(r => r.recommendation === 'Formation').length,
        });
      } catch {
        toast('Erreur lors du chargement des évaluations', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const filtered = rows.filter(r => {
    if (search && !r.employee_name.toLowerCase().includes(search.toLowerCase()) && !r.evaluator_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (period && r.period !== period) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  const periods = [...new Set(rows.map(r => r.period))];

  return (
    <div className="space-y-6">
      <PageHeader title="Évaluation & Carrière" subtitle="Entretiens d'évaluation et plans de développement" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Évaluations en cours</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.inProgress}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Complétées ce trimestre</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.completed}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Note moyenne</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.avgScore}/5</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Plans de développement</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.devPlans}</p>
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
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="">Toutes les périodes</option>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="Planifié">Planifié</option>
          <option value="En cours">En cours</option>
          <option value="Complété">Complété</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aucune évaluation" description="Aucune évaluation ne correspond à vos critères." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Évaluateur</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Période</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Note globale</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Objectifs atteints</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Recommandation</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">{r.employee_name}</td>
                    <td className="px-4 py-3 text-sm">{r.evaluator_name}</td>
                    <td className="px-4 py-3 text-sm">{r.period}</td>
                    <td className="px-4 py-3 text-sm font-medium">{r.overall_score}/5</td>
                    <td className="px-4 py-3 text-sm">{r.objectives_met}%</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${recommendationColor[r.recommendation] || 'bg-zinc-100 text-zinc-600'}`}>{r.recommendation}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[r.status] || 'bg-zinc-100 text-zinc-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
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
