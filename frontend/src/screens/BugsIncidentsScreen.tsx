import React, { useEffect, useState } from 'react';
import { Bug, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type BugIncident = {
  id: number;
  title: string;
  severity: string;
  module: string;
  reporter: string;
  assignee: string | null;
  status: string;
  created_at: string;
};

const SEVERITY_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'critical', label: 'Critique' },
  { value: 'major', label: 'Majeur' },
  { value: 'minor', label: 'Mineur' },
  { value: 'cosmetic', label: 'Cosmétique' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' },
];

const MODULE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'crm', label: 'CRM' },
  { value: 'orders', label: 'Commandes' },
  { value: 'delivery', label: 'Livraison' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'RH' },
  { value: 'academy', label: 'Academy' },
  { value: 'other', label: 'Autre' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-50 text-red-700',
  major: 'bg-orange-50 text-orange-700',
  minor: 'bg-yellow-50 text-yellow-700',
  cosmetic: 'bg-zinc-100 text-zinc-600',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critique',
  major: 'Majeur',
  minor: 'Mineur',
  cosmetic: 'Cosmétique',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-yellow-50 text-yellow-700',
  resolved: 'bg-green-50 text-green-700',
  closed: 'bg-zinc-100 text-zinc-600',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

export function BugsIncidentsScreen() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();
  const [rows, setRows] = useState<BugIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<BugIncident>>(
          'bugs-incidents' + buildQuery({ per_page: 25, page, search: search || undefined, severity: severityFilter || undefined, status: statusFilter || undefined, module: moduleFilter || undefined })
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
  }, [page, search, severityFilter, statusFilter, moduleFilter, activeBrandId]);

  const openCount = rows.filter(r => r.status === 'open').length;
  const criticalCount = rows.filter(r => r.severity === 'critical').length;
  const resolvedCount = rows.filter(r => r.status === 'resolved').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Bugs & incidents" subtitle="Suivi des anomalies et incidents techniques">
        <button className="btn btn-primary flex items-center gap-2" onClick={() => toast('info', 'Fonctionnalité à venir')}>
          <Plus size={16} />
          Signaler un bug
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ouverts</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{openCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Critiques</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{criticalCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Résolus ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{resolvedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Temps moyen résolution</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">—</p>
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
          value={severityFilter}
          onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
        >
          {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={moduleFilter}
          onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
        >
          {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<Bug size={40} />} title="Aucun bug" description="Aucun bug ou incident trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">ID</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Sévérité</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Module</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Signalé par</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Assigné à</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm font-medium">#{row.id}</td>
                  <td className="px-4 py-3 text-sm">{row.title}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_COLORS[row.severity] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {SEVERITY_LABELS[row.severity] ?? row.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.module}</td>
                  <td className="px-4 py-3 text-sm">{row.reporter}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.assignee ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(row.created_at).toLocaleDateString('fr-FR')}</td>
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
