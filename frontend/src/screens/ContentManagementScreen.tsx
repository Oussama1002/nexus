import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type AcademyContent = {
  id: number;
  title: string;
  type: string;
  path_name: string | null;
  duration: string | null;
  author: string;
  views_count: number;
  rating: number | null;
  status: string;
  updated_at: string;
};

const TYPE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'video', label: 'Vidéo' },
  { value: 'article', label: 'Article' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'document', label: 'Document' },
  { value: 'exercise', label: 'Exercice' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'published', label: 'Publié' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'archived', label: 'Archivé' },
];

const TYPE_COLORS: Record<string, string> = {
  video: 'bg-purple-50 text-purple-700',
  article: 'bg-blue-50 text-blue-700',
  quiz: 'bg-orange-50 text-orange-700',
  document: 'bg-zinc-100 text-zinc-600',
  exercise: 'bg-green-50 text-green-700',
};

const TYPE_LABELS: Record<string, string> = {
  video: 'Vidéo',
  article: 'Article',
  quiz: 'Quiz',
  document: 'Document',
  exercise: 'Exercice',
};

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-50 text-green-700',
  draft: 'bg-yellow-50 text-yellow-700',
  archived: 'bg-zinc-100 text-zinc-600',
};

const STATUS_LABELS: Record<string, string> = {
  published: 'Publié',
  draft: 'Brouillon',
  archived: 'Archivé',
};

export function ContentManagementScreen() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();
  const [rows, setRows] = useState<AcademyContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [paths, setPaths] = useState<{ id: number; title: string }[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', type: 'article', description: '', media_url: '',
    duration_minutes: '', learning_path_id: '', status: 'draft',
  });

  const submitCreate = async () => {
    if (!form.title.trim()) { toast('error', 'Titre requis.'); return; }
    setSaving(true);
    try {
      const res = await api.post('academy-contents', {
        title: form.title,
        type: form.type,
        description: form.description || undefined,
        media_url: form.media_url || undefined,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
        learning_path_id: form.learning_path_id ? Number(form.learning_path_id) : undefined,
        status: form.status,
      });
      if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
      toast('success', 'Contenu créé.');
      setShowCreate(false);
      setForm({ title: '', type: 'article', description: '', media_url: '', duration_minutes: '', learning_path_id: '', status: 'draft' });
      setReloadTick((t) => t + 1);
    } finally { setSaving(false); }
  };

  useEffect(() => {
    (async () => {
      const r = await api.get<Paginated<{ id: number; title: string }>>('learning-paths' + buildQuery({ per_page: 100 }));
      if (r.ok) setPaths(r.data.data.map((p: any) => ({ id: p.id, title: p.title })));
    })();
  }, [activeBrandId]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<AcademyContent>>(
          'academy-contents' + buildQuery({ per_page: 25, page, search: search || undefined, type: typeFilter || undefined, status: statusFilter || undefined })
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
  }, [page, search, typeFilter, statusFilter, activeBrandId, reloadTick]);

  const totalCount = total;
  const videoCount = rows.filter(r => r.type === 'video').length;
  const articleCount = rows.filter(r => r.type === 'article').length;
  const quizCount = rows.filter(r => r.type === 'quiz').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Gestion des contenus" subtitle="Contenus pédagogiques de la Brandna Academy">
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Nouveau contenu
        </button>
      </PageHeader>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouveau contenu Academy</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Titre *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Type
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {TYPE_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Statut
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Parcours de rattachement
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.learning_path_id} onChange={(e) => setForm({ ...form, learning_path_id: e.target.value })}>
                  <option value="">— aucun —</option>
                  {paths.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Durée (minutes)
                <input type="number" min="0" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">URL média
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Description
                <textarea rows={3} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total contenus</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{totalCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Vidéos</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{videoCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Articles</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{articleCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quiz</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{quizCount}</p>
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
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        <EmptyState icon={<BookOpen size={40} />} title="Aucun contenu" description="Aucun contenu pédagogique trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Parcours</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Durée</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Auteur</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Vues</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Note</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm font-medium">{row.title}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLORS[row.type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {TYPE_LABELS[row.type] ?? row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.path_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.duration ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">{row.author}</td>
                  <td className="px-4 py-3 text-sm">{row.views_count}</td>
                  <td className="px-4 py-3 text-sm">{row.rating != null ? `${row.rating}/5` : '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(row.updated_at).toLocaleDateString('fr-FR')}</td>
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
