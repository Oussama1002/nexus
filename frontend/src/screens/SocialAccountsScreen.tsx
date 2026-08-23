import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import {
  Link2, Plus, Search, Facebook, Instagram, Music2, Youtube, Linkedin, Twitter,
  Users, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';

type SocialAccount = {
  id: number;
  platform: string;                // facebook | instagram | tiktok | youtube | x | linkedin | other
  account_name: string;
  handle: string | null;
  profile_url: string | null;
  status: string;                  // active | inactive
  api_connected: boolean;
  follower_count: number;
  responsible?: { id: number; name: string; email: string } | null;
  updated_at?: string | null;
};

const PLATFORMS = [
  { v: 'facebook', l: 'Facebook' },
  { v: 'instagram', l: 'Instagram' },
  { v: 'tiktok', l: 'TikTok' },
  { v: 'youtube', l: 'YouTube' },
  { v: 'x', l: 'X (Twitter)' },
  { v: 'linkedin', l: 'LinkedIn' },
  { v: 'other', l: 'Autre' },
];

const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(PLATFORMS.map((p) => [p.v, p.l]));

const STATUS_LABELS: Record<string, string> = {
  active: 'Connecté',
  inactive: 'Déconnecté',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-zinc-100 text-zinc-600',
};

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  const cls = 'shrink-0';
  switch (p) {
    case 'facebook': return <Facebook size={20} className={`${cls} text-blue-600`} />;
    case 'instagram': return <Instagram size={20} className={`${cls} text-pink-600`} />;
    case 'tiktok': return <Music2 size={20} className={`${cls} text-zinc-900`} />;
    case 'youtube': return <Youtube size={20} className={`${cls} text-red-600`} />;
    case 'linkedin': return <Linkedin size={20} className={`${cls} text-blue-700`} />;
    case 'x': return <Twitter size={20} className={`${cls} text-zinc-900`} />;
    default: return <Link2 size={20} className={`${cls} text-zinc-400`} />;
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
  const [platformFilter, setPlatformFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    platform: 'instagram',
    account_name: '',
    handle: '',
    profile_url: '',
    follower_count: '',
    status: 'active',
    api_connected: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<SocialAccount>>(
          'social-accounts' + buildQuery({
            per_page: 25,
            page,
            platform: platformFilter || undefined,
            status: statusFilter || undefined,
          }),
        );
        if (cancelled) return;
        if (!res.ok) {
          toast('error', res.message ?? 'Erreur lors du chargement des comptes sociaux.');
          setRows([]);
          return;
        }
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, platformFilter, statusFilter, reloadTick, toast]);

  // Client-side search (current page only — same as the free-text filter shown to users)
  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.account_name.toLowerCase().includes(s) ||
      (r.handle ?? '').toLowerCase().includes(s) ||
      r.platform.toLowerCase().includes(s)
    );
  });

  const stats = {
    total,
    connected: rows.filter((r) => r.status === 'active').length,
    apiConnected: rows.filter((r) => r.api_connected).length,
    totalFollowers: rows.reduce((s, r) => s + (Number(r.follower_count) || 0), 0),
  };

  const submitCreate = async () => {
    if (!form.account_name.trim()) { toast('error', 'Nom du compte requis.'); return; }
    setSaving(true);
    try {
      const res = await api.post('social-accounts', {
        platform: form.platform,
        account_name: form.account_name,
        handle: form.handle || undefined,
        profile_url: form.profile_url || undefined,
        follower_count: form.follower_count ? Number(form.follower_count) : undefined,
        status: form.status,
        api_connected: form.api_connected,
      });
      if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
      toast('success', 'Compte social ajouté.');
      setShowCreate(false);
      setForm({ platform: 'instagram', account_name: '', handle: '', profile_url: '', follower_count: '', status: 'active', api_connected: false });
      setReloadTick((t) => t + 1);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptes sociaux"
        subtitle="Gestion des comptes et pages connectés"
        right={
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
          >
            <Plus size={16} /> Connecter un compte
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total comptes</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.total}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Actifs</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.connected}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">API connectée</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{stats.apiConnected}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Abonnés (page)</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{stats.totalFollowers.toLocaleString('fr-FR')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
        >
          <option value="">Toutes plateformes</option>
          {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous statuts</option>
          <option value="active">Connectés</option>
          <option value="inactive">Déconnectés</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun compte connecté" description="Cliquez sur « Connecter un compte » pour ajouter vos réseaux sociaux." />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((r) => {
              const statusLabel = STATUS_LABELS[r.status] ?? r.status;
              const statusCls = STATUS_COLORS[r.status] ?? 'bg-zinc-100 text-zinc-600';
              return (
                <div key={r.id} className="card p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={r.platform} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 truncate">{r.account_name}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {PLATFORM_LABELS[r.platform] ?? r.platform}
                        {r.handle && <> · @{r.handle}</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusCls}`}>
                      {statusLabel}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-zinc-600">
                      <Users size={14} />
                      {Number(r.follower_count ?? 0).toLocaleString('fr-FR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center gap-1 ${r.api_connected ? 'text-emerald-700' : 'text-zinc-400'}`}>
                      <Zap size={12} /> {r.api_connected ? 'API connectée' : 'API non liée'}
                    </span>
                    {r.profile_url && (
                      <a href={r.profile_url} target="_blank" rel="noreferrer" className="text-primary-600 font-bold hover:underline">Ouvrir</a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{total} résultat{total > 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium">{page} / {lastPage}</span>
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Connecter un compte</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-bold text-zinc-700">Plateforme
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                  {PLATFORMS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Statut
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Connecté</option>
                  <option value="inactive">Déconnecté</option>
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Nom du compte *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="Brandna Store" />
              </label>
              <label className="text-sm font-bold text-zinc-700">Handle
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="brandna_store" />
              </label>
              <label className="text-sm font-bold text-zinc-700">Abonnés
                <input type="number" min="0" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.follower_count} onChange={(e) => setForm({ ...form, follower_count: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">URL du profil
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.profile_url} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} placeholder="https://instagram.com/brandna_store" />
              </label>
              <label className="col-span-2 flex items-center gap-2 text-sm font-bold text-zinc-700">
                <input type="checkbox" checked={form.api_connected} onChange={(e) => setForm({ ...form, api_connected: e.target.checked })} />
                API officielle connectée (Meta / TikTok / etc.)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={submitCreate} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">
                {saving ? 'Envoi…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
