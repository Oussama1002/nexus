import React, { useEffect, useState } from 'react';
import { GraduationCap, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type LearningPath = {
  id: number;
  title: string;
  description: string;
  modules_count: number;
  duration_hours: number;
  enrolled_count: number;
  completion_rate: number;
  level: string;
  status: string;
};

const LEVEL_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'beginner', label: 'Débutant' },
  { value: 'intermediate', label: 'Intermédiaire' },
  { value: 'advanced', label: 'Avancé' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'Actif' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'archived', label: 'Archivé' },
];

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-50 text-green-700',
  intermediate: 'bg-blue-50 text-blue-700',
  advanced: 'bg-purple-50 text-purple-700',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-50 text-green-700',
  draft: 'bg-yellow-50 text-yellow-700',
  archived: 'bg-zinc-100 text-zinc-600',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  draft: 'Brouillon',
  archived: 'Archivé',
};

export function LearningPathsScreen() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();
  const [rows, setRows] = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', level: 'beginner', duration_hours: '', status: 'draft' });

  const submitCreate = async () => {
    if (!form.title.trim()) { toast('error', 'Titre requis.'); return; }
    setSaving(true);
    try {
      const res = await api.post('learning-paths', {
        title: form.title,
        description: form.description || undefined,
        level: form.level,
        duration_hours: form.duration_hours ? Number(form.duration_hours) : undefined,
        status: form.status,
      });
      if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
      toast('success', 'Parcours créé.');
      setShowCreate(false);
      setForm({ title: '', description: '', level: 'beginner', duration_hours: '', status: 'draft' });
      setReloadTick((t) => t + 1);
    } finally { setSaving(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<LearningPath>>(
          'learning-paths' + buildQuery({ per_page: 25, page, search: search || undefined, level: levelFilter || undefined, status: statusFilter || undefined })
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
  }, [page, search, levelFilter, statusFilter, activeBrandId, reloadTick]);

  const activeCount = rows.filter(r => r.status === 'active').length;
  const totalEnrolled = rows.reduce((s, r) => s + r.enrolled_count, 0);
  const avgCompletion = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.completion_rate, 0) / rows.length) : 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Parcours" subtitle="Parcours de formation structurés">
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Nouveau parcours
        </button>
      </PageHeader>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouveau parcours</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Titre *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Description
                <textarea rows={3} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Niveau
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  {LEVEL_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Durée (heures)
                <input type="number" step="0.5" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Statut
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
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
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Parcours actifs</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Apprenants inscrits</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{totalEnrolled}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taux complétion moyen</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{avgCompletion}%</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Certifications délivrées</p>
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
          value={levelFilter}
          onChange={e => { setLevelFilter(e.target.value); setPage(1); }}
        >
          {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<GraduationCap size={40} />} title="Aucun parcours" description="Aucun parcours de formation trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Modules</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Durée estimée</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Inscrits</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Complétion</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Niveau</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => {
                const pct = Math.round(row.completion_rate);
                return (
                  <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium">{row.title}</td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{row.description.length > 60 ? row.description.slice(0, 60) + '…' : row.description}</td>
                    <td className="px-4 py-3 text-sm">{row.modules_count}</td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{row.duration_hours} h</td>
                    <td className="px-4 py-3 text-sm">{row.enrolled_count}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_COLORS[row.level] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {LEVEL_LABELS[row.level] ?? row.level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
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
