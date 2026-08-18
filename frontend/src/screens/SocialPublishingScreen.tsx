import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { Send, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

type SocialPost = {
  id: number;
  content: string;
  platforms: string[];
  scheduled_at: string | null;
  status: string;
  engagement_count: number;
  reach_count: number;
  author: string;
};

const statusColor: Record<string, string> = {
  Brouillon: 'bg-zinc-100 text-zinc-600',
  'Planifié': 'bg-blue-50 text-blue-700',
  'Publié': 'bg-emerald-50 text-emerald-700',
  'Échoué': 'bg-red-50 text-red-700',
};

const platformColor: Record<string, string> = {
  FB: 'bg-blue-50 text-blue-700',
  IG: 'bg-pink-50 text-pink-700',
  TikTok: 'bg-zinc-900 text-white',
};

export function SocialPublishingScreen() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SocialPost[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState({ published: 0, scheduled: 0, draft: 0, avgEngagement: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<SocialPost>>('social-posts' + buildQuery({ per_page: 25, page }));
        if (!res.ok) { setRows([]); return; }
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
        const d = res.data.data;
        setStats({
          published: d.filter(r => r.status === 'Publié').length,
          scheduled: d.filter(r => r.status === 'Planifié').length,
          draft: d.filter(r => r.status === 'Brouillon').length,
          avgEngagement: d.length ? Math.round(d.reduce((s, r) => s + r.engagement_count, 0) / d.length) : 0,
        });
      } catch {
        toast('Erreur lors du chargement des publications', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const filtered = rows.filter(r => {
    if (search && !r.content.toLowerCase().includes(search.toLowerCase()) && !r.author.toLowerCase().includes(search.toLowerCase())) return false;
    if (platform && !r.platforms.includes(platform)) return false;
    if (status && r.status !== status) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Publication & modération" subtitle="Planification et publication de contenu social">
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle publication
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Publiés ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.published}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Planifiés</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.scheduled}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En brouillon</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.draft}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Engagement moyen</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.avgEngagement}</p>
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
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={platform} onChange={e => setPlatform(e.target.value)}>
          <option value="">Toutes les plateformes</option>
          <option value="FB">Facebook</option>
          <option value="IG">Instagram</option>
          <option value="TikTok">TikTok</option>
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="Brouillon">Brouillon</option>
          <option value="Planifié">Planifié</option>
          <option value="Publié">Publié</option>
          <option value="Échoué">Échoué</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Send} title="Aucune publication" description="Aucune publication ne correspond à vos critères." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Contenu</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Plateformes</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date planifiée</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Engagement</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Portée</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Auteur</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm max-w-[240px] truncate" title={r.content}>
                      {r.content.length > 60 ? r.content.slice(0, 60) + '...' : r.content}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-1">
                        {r.platforms.map(p => (
                          <span key={p} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${platformColor[p] || 'bg-zinc-100 text-zinc-600'}`}>{p}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{r.scheduled_at ? new Date(r.scheduled_at).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[r.status] || 'bg-zinc-100 text-zinc-600'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{r.engagement_count.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm">{r.reach_count.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm">{r.author}</td>
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
