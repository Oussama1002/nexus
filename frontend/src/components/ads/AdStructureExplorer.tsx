import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';
import { DataTable, type Column } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { StatusChip } from '../ui/StatusChip';
import { formatCurrency } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';
import * as api from '../../lib/api';

export type StructureRollup = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  messages: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
};

type AdSetRow = {
  id: number;
  name: string;
  status: string | null;
  effective_status: string | null;
  optimization_goal: string | null;
  billing_event: string | null;
  bid_strategy: string | null;
  daily_budget: string | null;
  lifetime_budget: string | null;
  targeting_summary: string | null;
  ads_count: number;
  metrics_rollups: StructureRollup | null;
};

type AdRow = {
  id: number;
  name: string;
  status: string | null;
  effective_status: string | null;
  creative_name: string | null;
  creative_title: string | null;
  creative_body: string | null;
  creative_thumbnail_url: string | null;
  creative_permalink: string | null;
  creative_call_to_action: string | null;
  metrics_rollups: StructureRollup | null;
};

/** ACTIVE / PAUSED / … → libellé + couleur façon Ads Manager. */
function deliveryChip(status: string | null): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  const s = (status ?? '').toUpperCase();
  if (s === 'ACTIVE') return { label: 'Diffusion active', tone: 'success' };
  if (s === 'PAUSED' || s === 'ADSET_PAUSED' || s === 'CAMPAIGN_PAUSED') return { label: 'En pause', tone: 'warning' };
  if (s === 'PENDING_REVIEW' || s === 'IN_PROCESS') return { label: 'En vérification', tone: 'neutral' };
  if (s === 'DISAPPROVED' || s === 'WITH_ISSUES') return { label: 'Refusée', tone: 'danger' };
  if (s === 'ARCHIVED' || s === 'DELETED') return { label: 'Archivée', tone: 'neutral' };
  return { label: s ? s.toLowerCase().replace(/_/g, ' ') : '—', tone: 'neutral' };
}

const GOALS: Record<string, string> = {
  OFFSITE_CONVERSIONS: 'Conversions',
  LINK_CLICKS: 'Clics sortants',
  LEAD_GENERATION: 'Prospects',
  IMPRESSIONS: 'Impressions',
  REACH: 'Couverture',
  CONVERSATIONS: 'Conversations',
  THRUPLAY: 'Vues de vidéo',
  LANDING_PAGE_VIEWS: 'Vues de page de destination',
};

function num(v: number | null | undefined, digits = 0): string {
  if (v == null) return '—';
  return v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Colonnes de métriques communes aux ensembles et aux publicités. */
function metricColumns<T extends { metrics_rollups: StructureRollup | null }>(currency: string): Column<T>[] {
  const m = (r: T) => r.metrics_rollups;
  return [
    {
      key: 'spend',
      header: 'Montant dépensé',
      className: 'text-right',
      cell: (r) => <span className="font-black">{m(r) ? formatCurrency(m(r)!.spend, currency) : '—'}</span>,
    },
    { key: 'reach', header: 'Couverture', className: 'text-right', cell: (r) => <span>{num(m(r)?.reach)}</span> },
    { key: 'impr', header: 'Impressions', className: 'text-right', cell: (r) => <span>{num(m(r)?.impressions)}</span> },
    { key: 'clicks', header: 'Clics', className: 'text-right', cell: (r) => <span>{num(m(r)?.clicks)}</span> },
    {
      key: 'ctr',
      header: 'CTR',
      className: 'text-right',
      cell: (r) => <span>{m(r)?.ctr != null ? `${num(m(r)!.ctr, 2)} %` : '—'}</span>,
    },
    { key: 'leads', header: 'Résultats', className: 'text-right', cell: (r) => <span>{num(m(r)?.leads)}</span> },
    {
      key: 'cpl',
      header: 'Coût par résultat',
      className: 'text-right',
      cell: (r) => <span>{m(r)?.cpl != null ? formatCurrency(m(r)!.cpl!, currency) : '—'}</span>,
    },
    {
      key: 'cpc',
      header: 'CPC',
      className: 'text-right',
      cell: (r) => <span>{m(r)?.cpc != null ? formatCurrency(m(r)!.cpc!, currency) : '—'}</span>,
    },
    {
      key: 'cpm',
      header: 'CPM',
      className: 'text-right',
      cell: (r) => <span>{m(r)?.cpm != null ? formatCurrency(m(r)!.cpm!, currency) : '—'}</span>,
    },
  ];
}

/**
 * Campagne → ensembles de publicités → publicités, avec les mêmes colonnes
 * que le gestionnaire de publicités Meta.
 */
export function AdStructureExplorer({
  campaignId,
  campaignName,
  periodFrom,
  periodTo,
  canSync,
  onBack,
}: {
  campaignId: number;
  campaignName: string;
  periodFrom: string;
  periodTo: string;
  canSync: boolean;
  onBack: () => void;
}) {
  const toast = useToast();
  const [adSets, setAdSets] = useState<AdSetRow[]>([]);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [openAdSet, setOpenAdSet] = useState<{ id: number; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  // Devise du compte publicitaire Meta (souvent USD), pas celle des commandes.
  const [currency, setCurrency] = useState('USD');

  const qs = useMemo(
    () => new URLSearchParams({ metrics_from: periodFrom, metrics_to: periodTo }).toString(),
    [periodFrom, periodTo],
  );

  const loadAdSets = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ ad_sets: AdSetRow[]; currency?: string }>(`campaigns/${campaignId}/ad-sets?${qs}`);
    setLoading(false);
    if (res.ok && res.data) {
      setAdSets(res.data.ad_sets ?? []);
      if (res.data.currency) setCurrency(res.data.currency);
    }
  }, [campaignId, qs]);

  const loadAds = useCallback(
    async (adSetId: number) => {
      setLoading(true);
      const res = await api.get<{ ads: AdRow[]; currency?: string }>(`ad-sets/${adSetId}/ads?${qs}`);
      setLoading(false);
      if (res.ok && res.data) {
        setAds(res.data.ads ?? []);
        if (res.data.currency) setCurrency(res.data.currency);
      }
    },
    [qs],
  );

  useEffect(() => {
    void loadAdSets();
  }, [loadAdSets]);

  useEffect(() => {
    if (openAdSet) void loadAds(openAdSet.id);
  }, [openAdSet, loadAds]);

  async function sync() {
    setSyncing(true);
    const res = await api.post(`ad-structure/sync?${qs}`, {});
    setSyncing(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    await loadAdSets();
    if (openAdSet) await loadAds(openAdSet.id);
  }

  const adSetColumns: Column<AdSetRow>[] = [
    {
      key: 'name',
      header: 'Ensemble de publicités',
      cell: (r) => (
        <button
          type="button"
          onClick={() => setOpenAdSet({ id: r.id, name: r.name })}
          className="text-left font-black text-primary-600 hover:underline"
        >
          {r.name}
          <span className="block text-[11px] font-medium text-zinc-500">
            {r.ads_count} publicité{r.ads_count > 1 ? 's' : ''}
            {r.targeting_summary ? ` · ${r.targeting_summary}` : ''}
          </span>
        </button>
      ),
    },
    {
      key: 'delivery',
      header: 'Diffusion',
      cell: (r) => {
        const chip = deliveryChip(r.effective_status ?? r.status);
        return <StatusChip tone={chip.tone}>{chip.label}</StatusChip>;
      },
    },
    {
      key: 'budget',
      header: 'Budget',
      className: 'text-right',
      cell: (r) => {
        const daily = r.daily_budget ? Number(r.daily_budget) : null;
        const lifetime = r.lifetime_budget ? Number(r.lifetime_budget) : null;
        if (daily) return <span className="font-bold">{formatCurrency(daily, currency)} <span className="text-[10px] text-zinc-400">/ jour</span></span>;
        if (lifetime) return <span className="font-bold">{formatCurrency(lifetime, currency)} <span className="text-[10px] text-zinc-400">total</span></span>;
        return <span className="text-zinc-400">—</span>;
      },
    },
    {
      key: 'goal',
      header: 'Optimisation',
      cell: (r) => <span className="text-xs font-semibold text-zinc-600">{GOALS[r.optimization_goal ?? ''] ?? r.optimization_goal ?? '—'}</span>,
    },
    ...metricColumns<AdSetRow>(currency),
  ];

  const adColumns: Column<AdRow>[] = [
    {
      key: 'name',
      header: 'Publicité',
      cell: (r) => (
        <div className="flex items-start gap-3">
          {r.creative_thumbnail_url ? (
            <img src={r.creative_thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-200 shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-black text-zinc-900 truncate">{r.name}</p>
            {r.creative_title && <p className="text-[11px] font-bold text-zinc-600 truncate">{r.creative_title}</p>}
            {r.creative_body && <p className="text-[11px] text-zinc-500 line-clamp-2">{r.creative_body}</p>}
            {r.creative_permalink && (
              <a
                href={r.creative_permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:underline"
              >
                Voir la publication <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'delivery',
      header: 'Diffusion',
      cell: (r) => {
        const chip = deliveryChip(r.effective_status ?? r.status);
        return <StatusChip tone={chip.tone}>{chip.label}</StatusChip>;
      },
    },
    {
      key: 'cta',
      header: 'Appel à l’action',
      cell: (r) => <span className="text-xs font-semibold text-zinc-600">{r.creative_call_to_action?.replace(/_/g, ' ').toLowerCase() ?? '—'}</span>,
    },
    ...metricColumns<AdRow>(currency),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (openAdSet ? setOpenAdSet(null) : onBack())}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
              {openAdSet ? 'Publicités de l’ensemble' : 'Ensembles de publicités'}
            </p>
            <p className="text-lg font-black text-zinc-900">{openAdSet ? openAdSet.name : campaignName}</p>
          </div>
        </div>
        {canSync && (
          <button
            type="button"
            onClick={() => void sync()}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Import…' : 'Importer depuis Meta'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : openAdSet ? (
        ads.length === 0 ? (
          <EmptyState
            title="Aucune publicité"
            description="Lancez « Importer depuis Meta » pour récupérer les publicités et leurs créatifs."
          />
        ) : (
          <DataTable<AdRow> rows={ads} columns={adColumns} density="comfortable" emptyTitle="Aucune publicité" />
        )
      ) : adSets.length === 0 ? (
        <EmptyState
          title="Aucun ensemble de publicités"
          description="Lancez « Importer depuis Meta » pour récupérer les ensembles, les publicités et leurs statistiques."
        />
      ) : (
        <DataTable<AdSetRow> rows={adSets} columns={adSetColumns} density="comfortable" emptyTitle="Aucun ensemble" />
      )}
    </div>
  );
}
