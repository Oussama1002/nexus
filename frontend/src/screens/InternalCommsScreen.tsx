import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type CommRow = {
  id: number;
  title: string;
  type: string;
  target: string;
  author: string;
  published_at: string | null;
  views_count: number;
};

const TYPE_COLORS: Record<string, string> = {
  Annonce: 'bg-blue-50 text-blue-700',
  'Note de service': 'bg-violet-50 text-violet-700',
  Circulaire: 'bg-amber-50 text-amber-700',
};

export function InternalCommsScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<CommRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api.get<Paginated<CommRow>>(
        'internal-communications' + buildQuery({ per_page: 25, page, search: search || undefined, type: typeFilter || undefined }),
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
  }, [page, search, typeFilter, toast]);

  const stats = useMemo(() => {
    const publiees = rows.filter((r) => r.published_at !== null).length;
    const brouillons = rows.filter((r) => r.published_at === null).length;
    const vuesMoyennes = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.views_count, 0) / rows.length) : 0;
    return { total, publiees, brouillons, vuesMoyennes };
  }, [rows, total]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication interne"
        subtitle="Annonces, notes de service et communications"
        right={
          <button className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle annonce
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total annonces</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.total}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Publiées</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.publiees}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Brouillons</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.brouillons}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Vues moyennes</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.vuesMoyennes}</p></div>
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
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les types</option>
          <option value="Annonce">Annonce</option>
          <option value="Note de service">Note de service</option>
          <option value="Circulaire">Circulaire</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune communication" description="Les annonces et notes de service apparaîtront ici." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Destinataires</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Publié par</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date publication</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Vues</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.title}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLORS[r.type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.target}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.author}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.published_at ? new Date(r.published_at).toLocaleDateString('fr-FR') : 'Brouillon'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.views_count}</td>
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
