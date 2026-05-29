import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Handshake,
  LayoutGrid,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { formatCurrency } from '../lib/utils';

type Tab = 'dash' | 'influencers' | 'collabs' | 'perf' | 'messages' | 'complaints';

type PerfDraft = {
  influencer_id: string;
  influencer_collaboration_id: string;
  metric_date: string;
  action_type: string;
  planned_actions: string;
  completed_actions: string;
  manager_comment: string;
  views: string;
  reach: string;
  likes: string;
  revenue: string;
};

function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}

function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const now = new Date();
    const year = now.getFullYear();
    const mon = now.getMonth() + 1;
    const last = new Date(year, mon, 0).getDate();
    const mm = String(mon).padStart(2, '0');
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
  }
  const mm = String(m).padStart(2, '0');
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cleanNumberOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function influencerLabel(row: Record<string, unknown>): string {
  const inf = (row.influencer as Record<string, unknown> | undefined) ?? null;
  if (!inf) return `#${String(row.influencer_id ?? '—')}`;
  return String(inf.full_name ?? inf.username ?? inf.handle ?? `#${String(row.influencer_id ?? '—')}`);
}

export function InfluenceWorkspaceScreen() {
  const { activeBrandId } = useBrand();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('dash');
  const [loading, setLoading] = useState(false);
  const [savingPerf, setSavingPerf] = useState(false);
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [influencers, setInfluencers] = useState<Record<string, unknown>[]>([]);
  const [collabs, setCollabs] = useState<Record<string, unknown>[]>([]);
  const [perf, setPerf] = useState<Record<string, unknown>[]>([]);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [complaints, setComplaints] = useState<Record<string, unknown>[]>([]);
  const [perfMonth, setPerfMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [perfDraft, setPerfDraft] = useState<PerfDraft>(() => ({
    influencer_id: '',
    influencer_collaboration_id: '',
    metric_date: new Date().toISOString().slice(0, 10),
    action_type: 'video',
    planned_actions: '1',
    completed_actions: '0',
    manager_comment: '',
    views: '',
    reach: '',
    likes: '',
    revenue: '',
  }));

  const load = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    try {
      if (tab === 'dash') {
        const r = await api.get<Record<string, unknown>>('dashboards/influence');
        if (r.ok) setDash(r.data);
        else {
          toast.error(r.message);
          setDash(null);
        }
        return;
      }
      if (tab === 'influencers') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>('influencers?per_page=100');
        if (r.ok && isPaginator(r.data)) setInfluencers(r.data.data);
        else {
          if (!r.ok) toast.error(r.message);
          setInfluencers([]);
        }
        return;
      }
      if (tab === 'collabs') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>('influencer-collaborations?per_page=100');
        if (r.ok && isPaginator(r.data)) setCollabs(r.data.data);
        else {
          if (!r.ok) toast.error(r.message);
          setCollabs([]);
        }
        return;
      }
      if (tab === 'perf') {
        const { from, to } = monthBounds(perfMonth);
        const [perfRes, influencersRes, collabsRes] = await Promise.all([
          api.get<LaravelPaginator<Record<string, unknown>>>(
            `influencer-performance?per_page=200&date_from=${from}&date_to=${to}`,
          ),
          api.get<LaravelPaginator<Record<string, unknown>>>('influencers?per_page=100'),
          api.get<LaravelPaginator<Record<string, unknown>>>('influencer-collaborations?per_page=100'),
        ]);

        if (perfRes.ok && isPaginator(perfRes.data)) setPerf(perfRes.data.data);
        else {
          if (!perfRes.ok) toast.error(perfRes.message);
          setPerf([]);
        }
        if (influencersRes.ok && isPaginator(influencersRes.data)) setInfluencers(influencersRes.data.data);
        if (collabsRes.ok && isPaginator(collabsRes.data)) setCollabs(collabsRes.data.data);
        return;
      }
      if (tab === 'messages') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>('influencer-messages?per_page=100');
        if (r.ok && isPaginator(r.data)) setMessages(r.data.data);
        else {
          if (!r.ok) toast.error(r.message);
          setMessages([]);
        }
        return;
      }
      if (tab === 'complaints') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>('influencer-complaints?per_page=100');
        if (r.ok && isPaginator(r.data)) setComplaints(r.data.data);
        else {
          if (!r.ok) toast.error(r.message);
          setComplaints([]);
        }
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, perfMonth, tab, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const perfTotals = useMemo(() => {
    const planned = perf.reduce((sum, row) => sum + asNumber(row.planned_actions), 0);
    const completed = perf.reduce((sum, row) => sum + asNumber(row.completed_actions), 0);
    const remaining = Math.max(planned - completed, 0);
    const rate = planned > 0 ? (completed / planned) * 100 : 0;
    return { planned, completed, remaining, rate };
  }, [perf]);

  const perfByInfluencer = useMemo(() => {
    const rows = new Map<
      string,
      { name: string; planned: number; completed: number; actions: number; comments: number }
    >();

    for (const row of perf) {
      const key = String(row.influencer_id ?? 'unknown');
      const current = rows.get(key) ?? {
        name: influencerLabel(row),
        planned: 0,
        completed: 0,
        actions: 0,
        comments: 0,
      };
      current.actions += 1;
      current.planned += asNumber(row.planned_actions);
      current.completed += asNumber(row.completed_actions);
      if (String(row.manager_comment ?? '').trim() !== '') current.comments += 1;
      rows.set(key, current);
    }

    return Array.from(rows.values())
      .map((item) => ({
        ...item,
        rate: item.planned > 0 ? (item.completed / item.planned) * 100 : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [perf]);

  async function submitPerformance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!perfDraft.influencer_id) {
      toast.error('Sélectionnez un influenceur.');
      return;
    }

    const planned = Math.max(1, Number(perfDraft.planned_actions || '1'));
    const completed = Math.max(0, Math.min(Number(perfDraft.completed_actions || '0'), planned));

    const payload: Record<string, unknown> = {
      influencer_id: Number(perfDraft.influencer_id),
      influencer_collaboration_id: perfDraft.influencer_collaboration_id
        ? Number(perfDraft.influencer_collaboration_id)
        : null,
      metric_date: perfDraft.metric_date,
      action_type: perfDraft.action_type.trim() || 'video',
      planned_actions: planned,
      completed_actions: completed,
      manager_comment: perfDraft.manager_comment.trim() || null,
      views: cleanNumberOrNull(perfDraft.views),
      reach: cleanNumberOrNull(perfDraft.reach),
      likes: cleanNumberOrNull(perfDraft.likes),
      revenue: cleanNumberOrNull(perfDraft.revenue),
    };

    setSavingPerf(true);
    try {
      const res = await api.post<Record<string, unknown>>('influencer-performance', payload);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success('Action influenceur enregistrée.');
      setPerfDraft((prev) => ({
        ...prev,
        completed_actions: '0',
        manager_comment: '',
        views: '',
        reach: '',
        likes: '',
        revenue: '',
      }));
      await load();
    } finally {
      setSavingPerf(false);
    }
  }

  if (!activeBrandId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Influence" subtitle="Choisissez une marque active." />
        <EmptyState title="Marque requise" description="Sélectionnez une marque dans l’en-tête." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Studio Influence"
        subtitle="Influenceurs, collaborations, performance, messages, plaintes (API)."
        right={
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-zinc-100 pb-2">
        {(
          [
            ['dash', 'Tableau', LayoutGrid],
            ['influencers', 'Influenceurs', Sparkles],
            ['collabs', 'Collabs', Handshake],
            ['perf', 'Performance', BarChart3],
            ['messages', 'Messages', MessageCircle],
            ['complaints', 'Plaintes', AlertTriangle],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as Tab)}
            className={`px-3 py-2 rounded-xl text-sm font-black inline-flex items-center gap-2 ${
              tab === id ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'dash' && loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-3 w-24 bg-zinc-100 rounded mb-2" />
              <div className="h-8 w-16 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {tab === 'dash' && !loading && dash && (
        <div className="space-y-6">
          <p className="text-sm text-zinc-600">
            Période :{' '}
            <span className="font-bold text-zinc-800">
              {(dash.period as { from?: string; to?: string } | undefined)?.from ?? '—'} →{' '}
              {(dash.period as { from?: string; to?: string } | undefined)?.to ?? '—'}
            </span>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">Influenceurs (total)</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{Number(dash.total_influencers ?? 0)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">Collaborations actives</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{Number(dash.active_collaborations ?? 0)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">Dépenses (période)</p>
              <p className="text-2xl font-black mt-1 tabular-nums">
                {formatCurrency(Number(dash.influencer_spend_period ?? 0))}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">CA attribué</p>
              <p className="text-2xl font-black mt-1 tabular-nums">
                {formatCurrency(Number(dash.revenue_attributed ?? 0))}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">ROI moyen</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{fmtPct(dash.avg_roi_percent as number | null)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">Plaintes ouvertes</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{Number(dash.open_complaints ?? 0)}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-sm font-black mb-3">Top influenceurs (CA, période)</p>
              {Array.isArray(dash.top_influencers) && dash.top_influencers.length > 0 ? (
                <ul className="space-y-2">
                  {(dash.top_influencers as Record<string, unknown>[]).map((row, idx) => {
                    const inf = row.influencer as { full_name?: string; handle?: string } | undefined;
                    const name = inf?.full_name ?? inf?.handle ?? `ID ${row.influencer_id ?? ''}`;
                    const rev = row.total_rev;
                    return (
                      <li
                        key={`${row.influencer_id ?? idx}`}
                        className="flex justify-between gap-4 text-sm border-b border-zinc-50 pb-2 last:border-0"
                      >
                        <span className="font-semibold text-zinc-800 truncate">{name}</span>
                        <span className="font-black tabular-nums shrink-0">
                          {formatCurrency(Number(rev ?? 0))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">Aucune performance enregistrée sur cette période.</p>
              )}
            </div>

            <div className="card p-4">
              <p className="text-sm font-black mb-3">Influenceurs par plateforme</p>
              {dash.influencers_by_platform &&
              typeof dash.influencers_by_platform === 'object' &&
              !Array.isArray(dash.influencers_by_platform) &&
              Object.keys(dash.influencers_by_platform as object).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dash.influencers_by_platform as Record<string, number>).map(([plat, c]) => (
                    <span
                      key={plat}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 text-sm font-bold text-zinc-800"
                    >
                      {plat}{' '}
                      <span className="text-primary-600 tabular-nums">{Number(c)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Aucun influenceur avec plateforme renseignée.</p>
              )}
            </div>
          </div>

          {Number(dash.total_influencers ?? 0) === 0 && (
            <EmptyState
              title="Pas encore de données influence"
              description="Les indicateurs viennent des fiches influenceurs, collaborations, performances et plaintes pour la marque active. Créez des influenceurs ou importez des données — les seeders démo ne remplissent pas encore ce module."
            />
          )}
        </div>
      )}

      {tab === 'influencers' && (
        <DataTable<Record<string, unknown>>
          rows={influencers}
          loading={loading}
          columns={[
            { key: 'n', header: 'Nom', cell: (r) => String(r.full_name ?? '') },
            { key: 'p', header: 'Plateforme', cell: (r) => String(r.platform ?? '') },
            { key: 's', header: 'Statut', cell: (r) => String(r.status ?? '') },
          ]}
          emptyTitle="Aucun influenceur pour cette marque"
          emptyDescription="Les listes sont filtrées par la marque active. Les seeders démo créent des fiches pour Luxe Cosmetics, Zest Home et Moda Casa (voir InfluenceDemoSeeder). Sinon, ajoutez des influenceurs via l’API."
        />
      )}

      {tab === 'collabs' && (
        <DataTable<Record<string, unknown>>
          rows={collabs}
          loading={loading}
          columns={[
            { key: 't', header: 'Titre', cell: (r) => String(r.title ?? '') },
            { key: 'type', header: 'Type', cell: (r) => String(r.collaboration_type ?? '') },
            { key: 'st', header: 'Statut', cell: (r) => String(r.status ?? '') },
            { key: 'a', header: 'Montant', cell: (r) => String(r.agreed_amount ?? '') },
          ]}
          emptyTitle="Aucune collaboration"
          emptyDescription="Rien n’est enregistré pour cette marque. Les données démo incluent une campagne active par marque démo après seed."
        />
      )}

      {tab === 'perf' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-black uppercase text-zinc-500">
                Mois de suivi
                <input
                  type="month"
                  value={perfMonth}
                  onChange={(e) => setPerfMonth(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>
              <p className="text-xs text-zinc-500">
                Suivi des livrables réalisés (vidéo, story, live...) par influenceur sur le mois.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="card-muted p-3">
                <p className="text-[10px] uppercase font-black text-zinc-400">Actions prévues</p>
                <p className="text-xl font-black tabular-nums">{perfTotals.planned}</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] uppercase font-black text-zinc-400">Actions réalisées</p>
                <p className="text-xl font-black tabular-nums">{perfTotals.completed}</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] uppercase font-black text-zinc-400">Reste à livrer</p>
                <p className="text-xl font-black tabular-nums">{perfTotals.remaining}</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] uppercase font-black text-zinc-400">Taux de livraison</p>
                <p className="text-xl font-black tabular-nums">{fmtPct(perfTotals.rate)}</p>
              </div>
            </div>

            <form onSubmit={(e) => void submitPerformance(e)} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <label className="text-xs font-black uppercase text-zinc-500">
                Influenceur
                <select
                  value={perfDraft.influencer_id}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, influencer_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                  required
                >
                  <option value="">— Sélectionner —</option>
                  {influencers.map((i) => (
                    <option key={String(i.id)} value={String(i.id)}>
                      {String(i.full_name ?? i.username ?? i.handle ?? `#${String(i.id)}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Collaboration
                <select
                  value={perfDraft.influencer_collaboration_id}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, influencer_collaboration_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                >
                  <option value="">— Optionnel —</option>
                  {collabs.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {String(c.title ?? `#${String(c.id)}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Action
                <select
                  value={perfDraft.action_type}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, action_type: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                >
                  <option value="video">Vidéo</option>
                  <option value="story">Story</option>
                  <option value="live">Live</option>
                  <option value="post">Post</option>
                  <option value="reel">Reel</option>
                  <option value="autre">Autre</option>
                </select>
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Date
                <input
                  type="date"
                  value={perfDraft.metric_date}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, metric_date: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                  required
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Prévu
                <input
                  type="number"
                  min={1}
                  value={perfDraft.planned_actions}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, planned_actions: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Réalisé
                <input
                  type="number"
                  min={0}
                  value={perfDraft.completed_actions}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, completed_actions: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500 md:col-span-3">
                Commentaires
                <textarea
                  rows={2}
                  value={perfDraft.manager_comment}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, manager_comment: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                  placeholder="Note de suivi (retard, qualité, remarques...)"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Vues
                <input
                  type="number"
                  min={0}
                  value={perfDraft.views}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, views: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Reach
                <input
                  type="number"
                  min={0}
                  value={perfDraft.reach}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, reach: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Likes
                <input
                  type="number"
                  min={0}
                  value={perfDraft.likes}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, likes: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                CA attribué
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={perfDraft.revenue}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, revenue: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <div className="md:col-span-3 flex items-end justify-end">
                <button
                  type="submit"
                  disabled={savingPerf}
                  className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60"
                >
                  {savingPerf ? 'Enregistrement...' : 'Enregistrer action'}
                </button>
              </div>
            </form>
          </div>

          <DataTable<Record<string, unknown>>
            rows={perfByInfluencer.map((row) => ({
              influencer: row.name,
              planned: row.planned,
              completed: row.completed,
              actions: row.actions,
              comments_count: row.comments,
              rate: row.rate,
            }))}
            columns={[
              { key: 'inf', header: 'Influenceur', cell: (r) => String(r.influencer ?? '') },
              { key: 'a', header: 'Actions', cell: (r) => String(r.actions ?? 0) },
              { key: 'p', header: 'Prévu', cell: (r) => String(r.planned ?? 0) },
              { key: 'c', header: 'Réalisé', cell: (r) => String(r.completed ?? 0) },
              { key: 'rate', header: 'Livraison %', cell: (r) => fmtPct(asNumber(r.rate)) },
              { key: 'com', header: 'Commentaires', cell: (r) => String(r.comments_count ?? 0) },
            ]}
            loading={loading}
            emptyTitle="Aucun suivi de performance sur ce mois"
            emptyDescription="Ajoutez les actions livrées (vidéo, story, live...) pour suivre la complétion mensuelle par influenceur."
          />

          <DataTable<Record<string, unknown>>
            rows={perf}
            columns={[
              { key: 'd', header: 'Date', cell: (r) => String(r.metric_date ?? '') },
              { key: 'inf', header: 'Influenceur', cell: (r) => influencerLabel(r) },
              { key: 'act', header: 'Action', cell: (r) => String(r.action_type ?? '—') },
              { key: 'pc', header: 'Prévu/Réalisé', cell: (r) => `${asNumber(r.completed_actions)}/${asNumber(r.planned_actions)}` },
              {
                key: 'com',
                header: 'Commentaire',
                cell: (r) => {
                  const text = String(r.manager_comment ?? '').trim();
                  if (!text) return '—';
                  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
                },
              },
              { key: 'rev', header: 'CA', cell: (r) => String(r.revenue ?? '') },
              { key: 'roi', header: 'ROI %', cell: (r) => String(r.roi_percent ?? '') },
            ]}
            loading={loading}
            emptyTitle="Aucune action enregistrée"
            emptyDescription="Le community manager peut logger chaque action réalisée pour contrôler la livraison en fin de mois."
          />
        </div>
      )}

      {tab === 'messages' && (
        <DataTable<Record<string, unknown>>
          rows={messages}
          columns={[
            { key: 'dir', header: 'Sens', cell: (r) => String(r.direction ?? '') },
            { key: 'ch', header: 'Canal', cell: (r) => String(r.channel ?? '') },
            { key: 'm', header: 'Message', cell: (r) => String(r.message ?? '').slice(0, 80) },
          ]}
        />
      )}

      {tab === 'complaints' && (
        <DataTable<Record<string, unknown>>
          rows={complaints}
          loading={loading}
          columns={[
            { key: 't', header: 'Titre', cell: (r) => String(r.title ?? '') },
            { key: 'cat', header: 'Cat.', cell: (r) => String(r.category ?? '') },
            { key: 'sev', header: 'Gravité', cell: (r) => String(r.severity ?? '') },
            { key: 'st', header: 'Statut', cell: (r) => String(r.status ?? '') },
          ]}
          emptyTitle="Aucune plainte"
          emptyDescription="Aucun dossier pour cette marque. Le seed démo ajoute une plainte « ouverte » pour tester les filtres KPI."
        />
      )}
    </div>
  );
}
