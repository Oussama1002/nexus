import { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { Link2, Plus, Search, Facebook, Instagram, Music2, Users, ChevronLeft, ChevronRight } from 'lucide-react';

type SocialAccount = {
  id: number;
  platform: string;
  account_name: string;
  status: string;
  followers_count: number;
  last_sync_at: string | null;
};

const statusColor: Record<string, string> = {
  'Connecté': 'bg-emerald-50 text-emerald-700',
  'Déconnecté': 'bg-zinc-100 text-zinc-600',
  'Expiré': 'bg-red-50 text-red-700',
};

function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'Facebook': return <Facebook size={20} className="text-blue-600" />;
    case 'Instagram': return <Instagram size={20} className="text-pink-600" />;
    case 'TikTok': return <Music2 size={20} className="text-zinc-900" />;
    default: return <Link2 size={20} className="text-zinc-400" />;
  }
}

export function SocialAccountsScreen() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SocialAccount[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ connected: 0, active: 0, totalFollowers: 0, postsThisMonth: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<SocialAccount>>('social-accounts' + buildQuery({ per_page: 25, page }));
        if (!res.ok) { setRows([]); return; }
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
        const d = res.data.data;
        setStats({
          connected: d.filter(r => r.status === 'Connecté').length,
          active: d.filter(r => r.status === 'Connecté').length,
          totalFollowers: d.reduce((s, r) => s + r.followers_count, 0),
          postsThisMonth: 0,
        });
      } catch {
        toast('Erreur lors du chargement des comptes sociaux', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const filtered = rows.filter(r => {
    if (search && !r.account_name.toLowerCase().includes(search.toLowerCase()) && !r.platform.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Comptes sociaux" subtitle="Gestion des comptes et pages connectés">
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Connecter un compte
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Comptes connectés</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.connected}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pages actives</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.active}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Abonnés total</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.totalFollowers.toLocaleString('fr-FR')}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Posts ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.postsThisMonth}</p>
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
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Link2} title="Aucun compte connecté" description="Connectez vos comptes sociaux pour commencer." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => (
              <div key={r.id} className="card p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={r.platform} />
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{r.account_name}</p>
                    <p className="text-xs text-zinc-500">{r.platform}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColor[r.status] || 'bg-zinc-100 text-zinc-600'}`}>{r.status}</span>
                  <span className="flex items-center gap-1 text-sm text-zinc-600">
                    <Users size={14} />
                    {r.followers_count.toLocaleString('fr-FR')}
                  </span>
                </div>

                <p className="text-xs text-zinc-400">
                  Dernière sync : {r.last_sync_at ? new Date(r.last_sync_at).toLocaleDateString('fr-FR') : 'Jamais'}
                </p>
              </div>
            ))}
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
