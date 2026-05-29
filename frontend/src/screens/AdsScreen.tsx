import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../lib/utils';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';
import { useAuth } from '../context/AuthContext';

type AdAccountRow = {
  id: number;
  platform: string;
  account_name: string;
  external_account_id: string | null;
  business_manager_id?: string | null;
  currency?: string;
  timezone?: string | null;
  country?: string | null;
  api_connected?: boolean;
  status: string;
  notes?: string | null;
  responsible?: { id: number; name: string } | null;
  brand?: { id: number; name: string } | null;
  access_token_masked?: string | null;
  refresh_token_masked?: string | null;
  webhook_secret_masked?: string | null;
};

type CampaignRollup = {
  spend: number;
  leads: number;
  revenue: number;
  messages: number;
  confirmed_orders: number;
  roas: number | null;
  cpl: number | null;
  cpa: number | null;
};

type CampaignRow = {
  id: number;
  name: string;
  source: string;
  marketing_objective?: string | null;
  budget: string;
  spend: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  objective: string | null;
  description?: string | null;
  brand?: { id: number; name: string } | null;
  ad_account?: { id: number; account_name: string } | null;
  product?: { id: number; name: string } | null;
  confirmatrice?: { id: number; name: string } | null;
  influencer?: { id: number; full_name?: string; username?: string } | null;
  metrics_rollups?: CampaignRollup | null;
};

type MetricRow = {
  id: number;
  metric_date: string;
  spend: string;
  impressions: number;
  clicks: number;
  leads: number;
  confirmed_orders: number;
  delivered_orders: number;
  revenue: string;
  cpc: string | null;
  cpm: string | null;
  cpl: string | null;
  cpa: string | null;
  roas: string | null;
  reach: number;
  messages: number;
};

type UserOpt = { id: number; name: string };
type ProductOpt = { id: number; name: string };
type InfluencerOpt = { id: number; full_name: string; username?: string | null };

type AdsReportPayload = {
  period: { from: string; to: string };
  metrics_rollups: {
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    messages: number;
    leads: number;
    confirmed_orders: number;
    delivered_orders: number;
    revenue: number;
    cpc: number | null;
    cpm: number | null;
    cpl: number | null;
    cpa: number | null;
    roas: number | null;
  };
};

const PLATFORMS = ['meta', 'tiktok', 'google', 'snap', 'linkedin', 'other'] as const;

const MARKETING_OBJECTIVES = [
  { value: '', label: '— Objectif marketing' },
  { value: 'lead_gen', label: 'Lead generation' },
  { value: 'messages', label: 'Messages' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'awareness', label: 'Awareness' },
  { value: 'sales', label: 'Sales' },
] as const;

function isoRangeLastDays(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function statusFr(s: string) {
  const m: Record<string, string> = {
    draft: 'Brouillon',
    active: 'Actif',
    paused: 'Pause',
    ended: 'Terminée',
    cancelled: 'Annulée',
    inactive: 'Inactif',
    suspended: 'Suspendu',
    expired: 'Expiré',
  };
  return m[s] ?? s;
}

function campaignStatusFr(s: string) {
  const m: Record<string, string> = {
    draft: 'Brouillon',
    active: 'Active',
    paused: 'Pause',
    ended: 'Terminée',
    cancelled: 'Annulée',
  };
  return m[s] ?? s;
}

function sourceFr(s: string) {
  const m: Record<string, string> = {
    meta: 'Meta Ads',
    tiktok: 'TikTok Ads',
    google: 'Google Ads',
    snap: 'Snap Ads',
    linkedin: 'LinkedIn Ads',
    other: 'Autre',
  };
  return m[s] ?? s;
}

function objectiveFr(s: string | null | undefined) {
  if (!s) return '—';
  const row = MARKETING_OBJECTIVES.find((o) => o.value === s);
  return row?.label ?? s;
}

export function AdsScreen() {
  const { activeBrandId } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canManage = hasPermission(['ad_accounts.create', 'campaigns.create', 'campaign_metrics.create']);
  const canMetaSync = hasPermission(['ad_accounts.update', 'campaigns.update']);
  const canListUsers = hasPermission('users.view');
  const canListProducts = hasPermission('products.view');
  const canListInfluencers = hasPermission('influence.view');

  const [tab, setTab] = useState<'Dashboard' | 'Comptes' | 'Campagnes'>('Dashboard');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [metaSyncing, setMetaSyncing] = useState(false);

  const [periodFrom, setPeriodFrom] = useState(() => isoRangeLastDays(30).from);
  const [periodTo, setPeriodTo] = useState(() => isoRangeLastDays(30).to);
  const [filterPlatform, setFilterPlatform] = useState<string>('');
  const [filterCampaignId, setFilterCampaignId] = useState<string>('');
  const [filterMediaBuyerId, setFilterMediaBuyerId] = useState<string>('');

  const [adAccounts, setAdAccounts] = useState<AdAccountRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [adsReport, setAdsReport] = useState<AdsReportPayload | null>(null);

  const [users, setUsers] = useState<UserOpt[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerOpt[]>([]);

  const [adModal, setAdModal] = useState(false);
  const [campModal, setCampModal] = useState(false);
  const [adForm, setAdForm] = useState({
    platform: 'meta' as (typeof PLATFORMS)[number],
    account_name: '',
    responsible_user_id: '' as string,
    external_account_id: '',
    business_manager_id: '',
    access_token_ref: '',
    refresh_token_ref: '',
    webhook_secret_ref: '',
    currency: 'MAD',
    timezone: '',
    country: '',
    api_connected: false,
    status: 'active',
    notes: '',
  });
  const [campForm, setCampForm] = useState({
    name: '',
    source: 'meta' as (typeof PLATFORMS)[number],
    marketing_objective: '' as string,
    budget: '0',
    daily_budget: '',
    campaign_currency: 'MAD',
    attribution_model: '',
    ad_account_id: '' as string,
    start_date: '',
    end_date: '',
    objective: '',
    description: '',
    creatives_summary: '',
    landing_url: '',
    confirmatrice_user_id: '' as string,
    product_id: '' as string,
    influencer_id: '' as string,
    utm_source: '',
    utm_campaign: '',
    utm_medium: '',
    pixel_id: '',
    target_cpa: '',
    target_roas: '',
    target_leads: '',
    notes: '',
  });

  const [openCampId, setOpenCampId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [metricModal, setMetricModal] = useState(false);
  const [metricForm, setMetricForm] = useState({
    metric_date: new Date().toISOString().slice(0, 10),
    spend: '0',
    impressions: '0',
    clicks: '0',
    leads: '0',
    reach: '0',
    messages: '0',
    confirmed_orders: '0',
    delivered_orders: '0',
    revenue: '0',
  });

  const loadDirectory = useCallback(async () => {
    const tasks: Promise<void>[] = [];
    if (canListUsers) {
      tasks.push(
        (async () => {
          const res = await api.get<LaravelPaginator<UserOpt>>('users?per_page=200');
          if (res.ok && isPaginator<UserOpt>(res.data)) setUsers(res.data.data);
        })(),
      );
    }
    if (canListProducts) {
      tasks.push(
        (async () => {
          const res = await api.get<LaravelPaginator<ProductOpt>>('products?per_page=200');
          if (res.ok && isPaginator<ProductOpt>(res.data)) setProducts(res.data.data);
        })(),
      );
    }
    if (canListInfluencers) {
      tasks.push(
        (async () => {
          const res = await api.get<LaravelPaginator<InfluencerOpt>>('influencers?per_page=200');
          if (res.ok && isPaginator<InfluencerOpt>(res.data)) setInfluencers(res.data.data);
        })(),
      );
    }
    await Promise.all(tasks);
  }, [canListUsers, canListProducts, canListInfluencers]);

  const loadAd = useCallback(async () => {
    const res = await api.get<LaravelPaginator<AdAccountRow>>('ad-accounts?per_page=100');
    if (res.ok && isPaginator<AdAccountRow>(res.data)) setAdAccounts(res.data.data);
  }, []);

  const loadCamp = useCallback(async () => {
    const qs = new URLSearchParams({ per_page: '100', metrics_from: periodFrom, metrics_to: periodTo });
    const res = await api.get<LaravelPaginator<CampaignRow>>(`campaigns?${qs.toString()}`);
    if (res.ok && isPaginator<CampaignRow>(res.data)) setCampaigns(res.data.data);
  }, [periodFrom, periodTo]);

  const loadAdsDashboard = useCallback(async () => {
    const qs = new URLSearchParams({
      date_from: periodFrom,
      date_to: periodTo,
    });
    if (filterPlatform) qs.set('platform', filterPlatform);
    if (filterCampaignId) qs.set('campaign_id', filterCampaignId);
    if (filterMediaBuyerId) qs.set('media_buyer_id', filterMediaBuyerId);
    const res = await api.get<AdsReportPayload>(`reports/ads?${qs.toString()}`);
    if (res.ok && res.data) setAdsReport(res.data);
  }, [periodFrom, periodTo, filterPlatform, filterCampaignId, filterMediaBuyerId]);

  const fetchMetrics = useCallback(async (campaignId: number | null) => {
    if (!campaignId) {
      setMetrics([]);
      return;
    }
    const res = await api.get<LaravelPaginator<MetricRow>>(`campaign-metrics?per_page=100&campaign_id=${campaignId}`);
    if (res.ok && isPaginator<MetricRow>(res.data)) setMetrics(res.data.data);
  }, []);

  const refresh = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    await Promise.all([loadDirectory(), loadAd(), loadCamp(), loadAdsDashboard()]);
    setLoading(false);
  }, [activeBrandId, loadDirectory, loadAd, loadCamp, loadAdsDashboard]);

  useEffect(() => {
    if (!activeBrandId) return;
    void loadDirectory();
    void loadAd();
  }, [activeBrandId, loadDirectory, loadAd]);

  useEffect(() => {
    if (!activeBrandId) return;
    void loadCamp();
  }, [activeBrandId, loadCamp]);

  useEffect(() => {
    if (!activeBrandId) return;
    void loadAdsDashboard();
  }, [activeBrandId, loadAdsDashboard]);

  const openCamp = useMemo(() => campaigns.find((c) => c.id === openCampId) ?? null, [campaigns, openCampId]);

  useEffect(() => {
    void fetchMetrics(openCampId);
  }, [openCampId, fetchMetrics]);

  async function syncMetaAdAccounts() {
    setMetaSyncing(true);
    const res = await api.post<{ created: number; updated: number; total: number }>('meta/sync/ad-accounts', {});
    setMetaSyncing(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    await loadAd();
  }

  async function syncMetaCampaignsAndInsights() {
    const metaAccounts = adAccounts.filter((a) => a.platform === 'meta' && a.external_account_id);
    if (metaAccounts.length === 0) {
      toast.error('Aucun compte Meta lié. Importez d’abord les comptes publicitaires.');
      return;
    }
    setMetaSyncing(true);
    let campMsg = '';
    let insightMsg = '';
    for (const account of metaAccounts) {
      const campRes = await api.post<{ created: number; updated: number }>('meta/sync/campaigns', {
        ad_account_id: account.id,
      });
      if (!campRes.ok) {
        setMetaSyncing(false);
        toast.error(campRes.message);
        return;
      }
      campMsg = campRes.message;
      const insRes = await api.post<{ upserted: number; campaigns: number }>('meta/sync/insights', {
        ad_account_id: account.id,
        from: periodFrom,
        to: periodTo,
      });
      if (!insRes.ok) {
        setMetaSyncing(false);
        toast.error(insRes.message);
        return;
      }
      insightMsg = insRes.message;
    }
    setMetaSyncing(false);
    toast.success(`${campMsg} ${insightMsg}`.trim());
    await refresh();
  }

  async function saveAd() {
    const res = await api.post('ad-accounts', {
      platform: adForm.platform,
      account_name: adForm.account_name,
      responsible_user_id: adForm.responsible_user_id ? Number(adForm.responsible_user_id) : null,
      external_account_id: adForm.external_account_id || null,
      business_manager_id: adForm.business_manager_id || null,
      access_token_ref: adForm.access_token_ref || null,
      refresh_token_ref: adForm.refresh_token_ref || null,
      webhook_secret_ref: adForm.webhook_secret_ref || null,
      currency: adForm.currency || 'MAD',
      timezone: adForm.timezone || null,
      country: adForm.country || null,
      api_connected: adForm.api_connected,
      status: adForm.status,
      notes: adForm.notes || null,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Compte publicitaire créé.');
    setAdModal(false);
    setAdForm({
      platform: 'meta',
      account_name: '',
      responsible_user_id: '',
      external_account_id: '',
      business_manager_id: '',
      access_token_ref: '',
      refresh_token_ref: '',
      webhook_secret_ref: '',
      currency: 'MAD',
      timezone: '',
      country: '',
      api_connected: false,
      status: 'active',
      notes: '',
    });
    void loadAd();
  }

  async function saveCamp() {
    const res = await api.post('campaigns', {
      name: campForm.name,
      source: campForm.source,
      marketing_objective: campForm.marketing_objective || null,
      budget: parseFloat(campForm.budget) || 0,
      daily_budget: campForm.daily_budget ? parseFloat(campForm.daily_budget) : null,
      campaign_currency: campForm.campaign_currency || 'MAD',
      attribution_model: campForm.attribution_model || null,
      ad_account_id: Number(campForm.ad_account_id),
      start_date: campForm.start_date,
      end_date: campForm.end_date || null,
      objective: campForm.objective || null,
      description: campForm.description || null,
      creatives_summary: campForm.creatives_summary.trim() ? campForm.creatives_summary : null,
      landing_url: campForm.landing_url || null,
      confirmatrice_user_id: campForm.confirmatrice_user_id ? Number(campForm.confirmatrice_user_id) : null,
      product_id: campForm.product_id ? Number(campForm.product_id) : null,
      influencer_id: campForm.influencer_id ? Number(campForm.influencer_id) : null,
      utm_source: campForm.utm_source || null,
      utm_campaign: campForm.utm_campaign || null,
      utm_medium: campForm.utm_medium || null,
      pixel_id: campForm.pixel_id || null,
      target_cpa: campForm.target_cpa ? parseFloat(campForm.target_cpa) : null,
      target_roas: campForm.target_roas ? parseFloat(campForm.target_roas) : null,
      target_leads: campForm.target_leads ? parseInt(campForm.target_leads, 10) : null,
      notes: campForm.notes || null,
      status: 'draft',
    });
    if (!res.ok) {
      const e = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(e as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success('Campagne créée.');
    setCampModal(false);
    setCampForm({
      name: '',
      source: 'meta',
      marketing_objective: '',
      budget: '0',
      daily_budget: '',
      campaign_currency: 'MAD',
      attribution_model: '',
      ad_account_id: '',
      start_date: '',
      end_date: '',
      objective: '',
      description: '',
      creatives_summary: '',
      landing_url: '',
      confirmatrice_user_id: '',
      product_id: '',
      influencer_id: '',
      utm_source: '',
      utm_campaign: '',
      utm_medium: '',
      pixel_id: '',
      target_cpa: '',
      target_roas: '',
      target_leads: '',
      notes: '',
    });
    void loadCamp();
    void loadAdsDashboard();
  }

  async function saveMetric() {
    if (!openCampId) return;
    const res = await api.post('campaign-metrics', {
      campaign_id: openCampId,
      metric_date: metricForm.metric_date,
      spend: parseFloat(metricForm.spend) || 0,
      impressions: parseInt(metricForm.impressions, 10) || 0,
      clicks: parseInt(metricForm.clicks, 10) || 0,
      leads: parseInt(metricForm.leads, 10) || 0,
      reach: parseInt(metricForm.reach, 10) || 0,
      messages: parseInt(metricForm.messages, 10) || 0,
      confirmed_orders: parseInt(metricForm.confirmed_orders, 10) || 0,
      delivered_orders: parseInt(metricForm.delivered_orders, 10) || 0,
      revenue: parseFloat(metricForm.revenue) || 0,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Métrique enregistrée.');
    setMetricModal(false);
    await fetchMetrics(openCampId);
    void loadCamp();
    void loadAdsDashboard();
  }

  const filteredAd = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return adAccounts;
    return adAccounts.filter((a) => `${a.account_name} ${a.platform}`.toLowerCase().includes(s));
  }, [adAccounts, q]);

  const filteredCamp = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return campaigns;
    return campaigns.filter((c) => c.name.toLowerCase().includes(s));
  }, [campaigns, q]);

  const rpt = adsReport?.metrics_rollups;

  if (!activeBrandId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Campagnes & Ads" subtitle="Sélectionnez une marque active pour charger les données." />
        <EmptyState title="Aucune marque" description="Choisissez une marque dans l’en-tête." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campagnes & Ads"
        subtitle="Mini Ads Manager — comptes, campagnes, métriques et pilotage."
        right={
          <div className="flex flex-wrap gap-2 justify-end">
            {canMetaSync && (
              <>
                <button
                  type="button"
                  disabled={metaSyncing || loading}
                  onClick={() => void syncMetaAdAccounts()}
                  className="px-4 py-2 rounded-2xl border border-blue-200 bg-blue-50 text-blue-900 text-sm font-black inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${metaSyncing ? 'animate-spin' : ''}`} />
                  {metaSyncing ? 'Meta…' : 'Importer comptes Meta'}
                </button>
                <button
                  type="button"
                  disabled={metaSyncing || loading}
                  onClick={() => void syncMetaCampaignsAndInsights()}
                  className="px-4 py-2 rounded-2xl bg-[#1877F2] text-white text-sm font-black inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${metaSyncing ? 'animate-spin' : ''}`} />
                  Sync campagnes & métriques
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => void refresh()}
              className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> {loading ? '…' : 'Actualiser'}
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-zinc-100 pb-2">
        {(['Dashboard', 'Comptes', 'Campagnes'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-black ${tab === t ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-700'}`}
          >
            {t === 'Dashboard' ? 'Tableau de bord Ads' : t}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' && (
        <div className="space-y-4">
          <div className="card p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-[10px] font-black uppercase text-zinc-400">
              Du
              <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border font-bold" />
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400">
              Au
              <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border font-bold" />
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400">
              Plateforme
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border font-bold"
              >
                <option value="">Toutes</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {sourceFr(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400">
              Campagne
              <select
                value={filterCampaignId}
                onChange={(e) => setFilterCampaignId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border font-bold"
              >
                <option value="">Toutes</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 md:col-span-2">
              Media buyer / responsable compte
              <select
                value={filterMediaBuyerId}
                onChange={(e) => setFilterMediaBuyerId(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border font-bold"
              >
                <option value="">Tous</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {rpt ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Spend total', formatCurrency(rpt.spend)],
                ['Leads', String(rpt.leads)],
                ['Messages', String(rpt.messages)],
                ['CPA', rpt.cpa != null ? formatCurrency(rpt.cpa) : '—'],
                ['CPL', rpt.cpl != null ? formatCurrency(rpt.cpl) : '—'],
                ['ROAS', rpt.roas != null ? String(rpt.roas) : '—'],
                ['Revenue', formatCurrency(rpt.revenue)],
                ['Confirmées', String(rpt.confirmed_orders)],
              ].map(([label, val]) => (
                <div key={label} className="card p-4">
                  <p className="text-[10px] font-black uppercase text-zinc-400">{label}</p>
                  <p className="text-xl font-black mt-1">{val}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Pas encore de métriques" description="Ajoutez des métriques journalières sur vos campagnes pour ce jour." />
          )}
        </div>
      )}

      {(tab === 'Comptes' || tab === 'Campagnes') && (
        <FilterBar query={q} onQueryChange={setQ} right={null} />
      )}

      {tab === 'Comptes' && (
        <div className="space-y-3">
          {canManage && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setAdModal(true)}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex gap-2 items-center"
              >
                <Plus className="w-4 h-4" /> Nouveau compte publicitaire
              </button>
            </div>
          )}
          {filteredAd.length === 0 ? (
            <EmptyState title="Aucun compte" description="Créez un compte Meta/TikTok/Google/LinkedIn pour cette marque." />
          ) : (
            <DataTable<AdAccountRow>
              rows={filteredAd}
              columns={[
                { key: 'p', header: 'Plateforme', cell: (a) => <span className="font-bold">{sourceFr(a.platform)}</span> },
                { key: 'n', header: 'Nom compte', cell: (a) => <span className="font-black">{a.account_name}</span> },
                {
                  key: 'b',
                  header: 'Business',
                  cell: (a) => <span className="text-sm">{a.brand?.name ?? '—'}</span>,
                },
                { key: 'ext', header: 'ID externe', cell: (a) => <span className="text-sm text-zinc-600">{a.external_account_id ?? '—'}</span> },
                {
                  key: 'cur',
                  header: 'Devise',
                  cell: (a) => <span>{a.currency ?? '—'}</span>,
                },
                {
                  key: 'tz',
                  header: 'Fuseau',
                  cell: (a) => <span className="text-sm">{a.timezone ?? '—'}</span>,
                },
                {
                  key: 'resp',
                  header: 'Responsable',
                  cell: (a) => <span className="text-sm">{a.responsible?.name ?? '—'}</span>,
                },
                {
                  key: 's',
                  header: 'Statut',
                  cell: (a) => <StatusChip tone="success">{statusFr(a.status)}</StatusChip>,
                },
                {
                  key: 'api',
                  header: 'API',
                  cell: (a) => <span className="text-xs">{a.api_connected ? 'Connecté' : 'Non'}</span>,
                },
              ]}
            />
          )}
        </div>
      )}

      {tab === 'Campagnes' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end justify-between">
            <div className="flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
              <span>Métriques tableau:</span>
              <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="px-2 py-1 rounded-lg border" />
              <span>→</span>
              <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="px-2 py-1 rounded-lg border" />
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setCampModal(true)}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex gap-2 items-center"
              >
                <Plus className="w-4 h-4" /> Nouvelle campagne
              </button>
            )}
          </div>
          {filteredCamp.length === 0 ? (
            <EmptyState title="Aucune campagne" description="Créez une campagne liée à un compte publicitaire." />
          ) : (
            <DataTable<CampaignRow>
              rows={filteredCamp}
              columns={[
                {
                  key: 'name',
                  header: 'Campagne',
                  cell: (c) => (
                    <button type="button" className="font-black text-primary-600 hover:underline text-left" onClick={() => setOpenCampId(c.id)}>
                      {c.name}
                    </button>
                  ),
                },
                {
                  key: 'brand',
                  header: 'Brand',
                  cell: (c) => <span className="text-sm">{c.brand?.name ?? '—'}</span>,
                },
                { key: 'src', header: 'Plateforme', cell: (c) => <span>{sourceFr(c.source)}</span> },
                {
                  key: 'obj',
                  header: 'Objectif',
                  cell: (c) => <span className="text-sm">{objectiveFr(c.marketing_objective)}</span>,
                },
                {
                  key: 'bud',
                  header: 'Budget',
                  cell: (c) => <span className="font-black">{formatCurrency(parseFloat(c.budget))}</span>,
                },
                {
                  key: 'sp',
                  header: 'Spend (période)',
                  cell: (c) => (
                    <span>{c.metrics_rollups ? formatCurrency(c.metrics_rollups.spend) : '—'}</span>
                  ),
                },
                {
                  key: 'ld',
                  header: 'Leads',
                  cell: (c) => <span>{c.metrics_rollups ? c.metrics_rollups.leads : '—'}</span>,
                },
                {
                  key: 'ro',
                  header: 'ROAS',
                  cell: (c) => <span>{c.metrics_rollups?.roas != null ? String(c.metrics_rollups.roas) : '—'}</span>,
                },
                {
                  key: 'st',
                  header: 'Statut',
                  cell: (c) => <StatusChip tone={c.status === 'active' ? 'success' : 'neutral'}>{campaignStatusFr(c.status)}</StatusChip>,
                },
              ]}
            />
          )}
        </div>
      )}

      <Drawer open={!!openCamp} onClose={() => setOpenCampId(null)} title={openCamp?.name ?? ''}>
        {openCamp && (
          <div className="space-y-4">
            <div className="text-sm text-zinc-600 space-y-1">
              <p>
                <span className="font-black text-zinc-800">Plateforme:</span> {sourceFr(openCamp.source)}
              </p>
              <p>
                <span className="font-black text-zinc-800">Objectif:</span> {objectiveFr(openCamp.marketing_objective)}
              </p>
              {openCamp.description && <p>{openCamp.description}</p>}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase text-zinc-400">Métriques</p>
              {canManage && (
                <button type="button" onClick={() => setMetricModal(true)} className="text-sm font-black text-primary-600">
                  + Ajouter jour
                </button>
              )}
            </div>
            {metrics.length === 0 ? (
              <EmptyState title="Pas encore de métriques" description="Ajoutez une ligne pour ce jour." />
            ) : (
              <div className="overflow-x-auto card p-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-zinc-400">
                      <th className="p-2">Date</th>
                      <th className="p-2">Spend</th>
                      <th className="p-2">Leads</th>
                      <th className="p-2">CPC</th>
                      <th className="p-2">CPM</th>
                      <th className="p-2">CPA</th>
                      <th className="p-2">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m) => (
                      <tr key={m.id} className="border-t border-zinc-100 font-bold">
                        <td className="p-2">{m.metric_date}</td>
                        <td className="p-2">{formatCurrency(parseFloat(m.spend))}</td>
                        <td className="p-2">{m.leads}</td>
                        <td className="p-2">{m.cpc ?? '—'}</td>
                        <td className="p-2">{m.cpm ?? '—'}</td>
                        <td className="p-2">{m.cpa ?? '—'}</td>
                        <td className="p-2">{m.roas ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal open={adModal} onClose={() => setAdModal(false)} title="Nouveau compte publicitaire">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <p className="text-[10px] font-black uppercase text-zinc-400">Informations générales</p>
          <input
            value={adForm.account_name}
            onChange={(e) => setAdForm((f) => ({ ...f, account_name: e.target.value }))}
            placeholder="Nom du compte *"
            className="w-full px-4 py-3 rounded-xl border font-bold"
          />
          <select
            value={adForm.platform}
            onChange={(e) => setAdForm((f) => ({ ...f, platform: e.target.value as (typeof PLATFORMS)[number] }))}
            className="w-full px-4 py-3 rounded-xl border font-bold"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {sourceFr(p)}
              </option>
            ))}
          </select>
          {canListUsers ? (
            <select
              value={adForm.responsible_user_id}
              onChange={(e) => setAdForm((f) => ({ ...f, responsible_user_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border font-bold"
            >
              <option value="">— Responsable</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-amber-700">Attribuez la permission utilisateurs pour choisir un responsable.</p>
          )}
          <p className="text-[10px] font-black uppercase text-zinc-400">API / intégration</p>
          <input
            value={adForm.external_account_id}
            onChange={(e) => setAdForm((f) => ({ ...f, external_account_id: e.target.value }))}
            placeholder="External Account ID"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={adForm.business_manager_id}
            onChange={(e) => setAdForm((f) => ({ ...f, business_manager_id: e.target.value }))}
            placeholder="Business Manager ID"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={adForm.api_connected}
              onChange={(e) => setAdForm((f) => ({ ...f, api_connected: e.target.checked }))}
            />
            API connectée
          </label>
          <p className="text-[10px] font-black uppercase text-zinc-400">Configuration</p>
          <input
            value={adForm.currency}
            onChange={(e) => setAdForm((f) => ({ ...f, currency: e.target.value }))}
            placeholder="Devise"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={adForm.timezone}
            onChange={(e) => setAdForm((f) => ({ ...f, timezone: e.target.value }))}
            placeholder="Fuseau horaire (ex. Africa/Casablanca)"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={adForm.country}
            onChange={(e) => setAdForm((f) => ({ ...f, country: e.target.value }))}
            placeholder="Pays (code ISO)"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <p className="text-[10px] font-black uppercase text-zinc-400">Sécurité (stockage ref — jamais affiché en clair)</p>
          <input
            value={adForm.access_token_ref}
            onChange={(e) => setAdForm((f) => ({ ...f, access_token_ref: e.target.value }))}
            placeholder="Access token ref"
            className="w-full px-4 py-3 rounded-xl border font-mono text-sm"
            autoComplete="off"
          />
          <input
            value={adForm.refresh_token_ref}
            onChange={(e) => setAdForm((f) => ({ ...f, refresh_token_ref: e.target.value }))}
            placeholder="Refresh token ref"
            className="w-full px-4 py-3 rounded-xl border font-mono text-sm"
            autoComplete="off"
          />
          <input
            value={adForm.webhook_secret_ref}
            onChange={(e) => setAdForm((f) => ({ ...f, webhook_secret_ref: e.target.value }))}
            placeholder="Webhook secret ref"
            className="w-full px-4 py-3 rounded-xl border font-mono text-sm"
            autoComplete="off"
          />
          <select
            value={adForm.status}
            onChange={(e) => setAdForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border font-bold"
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="suspended">suspended</option>
            <option value="expired">expired</option>
          </select>
          <textarea
            value={adForm.notes}
            onChange={(e) => setAdForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes"
            className="w-full px-4 py-3 rounded-xl border min-h-[80px]"
          />
          <button type="button" onClick={() => void saveAd()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Créer
          </button>
        </div>
      </Modal>

      <Modal open={campModal} onClose={() => setCampModal(false)} title="Nouvelle campagne">
        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          <p className="text-[10px] font-black uppercase text-zinc-400">Informations générales</p>
          <input
            value={campForm.name}
            onChange={(e) => setCampForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nom campagne *"
            className="w-full px-4 py-3 rounded-xl border font-bold"
          />
          <select
            value={campForm.source}
            onChange={(e) => setCampForm((f) => ({ ...f, source: e.target.value as (typeof PLATFORMS)[number] }))}
            className="w-full px-4 py-3 rounded-xl border font-bold"
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {sourceFr(p)}
              </option>
            ))}
          </select>
          <select
            value={campForm.marketing_objective}
            onChange={(e) => setCampForm((f) => ({ ...f, marketing_objective: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border font-bold"
          >
            {MARKETING_OBJECTIVES.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={campForm.ad_account_id}
            onChange={(e) => setCampForm((f) => ({ ...f, ad_account_id: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl border font-bold"
            required
          >
            <option value="">— Compte publicitaire *</option>
            {adAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name} ({sourceFr(a.platform)})
              </option>
            ))}
          </select>
          <p className="text-[10px] font-black uppercase text-zinc-400">Configuration campagne</p>
          <label className="text-[10px] font-bold text-zinc-500">
            Date début *
            <input type="date" value={campForm.start_date} onChange={(e) => setCampForm((f) => ({ ...f, start_date: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border" />
          </label>
          <label className="text-[10px] font-bold text-zinc-500">
            Date fin
            <input type="date" value={campForm.end_date} onChange={(e) => setCampForm((f) => ({ ...f, end_date: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border" />
          </label>
          <input
            value={campForm.daily_budget}
            onChange={(e) => setCampForm((f) => ({ ...f, daily_budget: e.target.value }))}
            placeholder="Budget quotidien"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={campForm.budget}
            onChange={(e) => setCampForm((f) => ({ ...f, budget: e.target.value }))}
            placeholder="Budget total *"
            className="w-full px-4 py-3 rounded-xl border font-black"
          />
          <input
            value={campForm.campaign_currency}
            onChange={(e) => setCampForm((f) => ({ ...f, campaign_currency: e.target.value }))}
            placeholder="Devise"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={campForm.attribution_model}
            onChange={(e) => setCampForm((f) => ({ ...f, attribution_model: e.target.value }))}
            placeholder="Attribution"
            className="w-full px-4 py-3 rounded-xl border"
          />
          {canListProducts ? (
            <select
              value={campForm.product_id}
              onChange={(e) => setCampForm((f) => ({ ...f, product_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border font-bold"
            >
              <option value="">— Produit lié</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
          <input
            value={campForm.landing_url}
            onChange={(e) => setCampForm((f) => ({ ...f, landing_url: e.target.value }))}
            placeholder="Landing page URL"
            className="w-full px-4 py-3 rounded-xl border"
          />
          {canListUsers ? (
            <select
              value={campForm.confirmatrice_user_id}
              onChange={(e) => setCampForm((f) => ({ ...f, confirmatrice_user_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border font-bold"
            >
              <option value="">— Confirmatrice assignée</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : null}
          {canListInfluencers ? (
            <select
              value={campForm.influencer_id}
              onChange={(e) => setCampForm((f) => ({ ...f, influencer_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border font-bold"
            >
              <option value="">— Influenceur lié</option>
              {influencers.map((inf) => (
                <option key={inf.id} value={inf.id}>
                  {inf.full_name} {inf.username ? `@${inf.username}` : ''}
                </option>
              ))}
            </select>
          ) : null}
          <p className="text-[10px] font-black uppercase text-zinc-400">Tracking</p>
          <input
            value={campForm.utm_source}
            onChange={(e) => setCampForm((f) => ({ ...f, utm_source: e.target.value }))}
            placeholder="UTM source"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={campForm.utm_campaign}
            onChange={(e) => setCampForm((f) => ({ ...f, utm_campaign: e.target.value }))}
            placeholder="UTM campaign"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={campForm.utm_medium}
            onChange={(e) => setCampForm((f) => ({ ...f, utm_medium: e.target.value }))}
            placeholder="UTM medium"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={campForm.pixel_id}
            onChange={(e) => setCampForm((f) => ({ ...f, pixel_id: e.target.value }))}
            placeholder="Pixel ID"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <p className="text-[10px] font-black uppercase text-zinc-400">KPIs objectifs</p>
          <input
            value={campForm.target_cpa}
            onChange={(e) => setCampForm((f) => ({ ...f, target_cpa: e.target.value }))}
            placeholder="CPA cible"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={campForm.target_roas}
            onChange={(e) => setCampForm((f) => ({ ...f, target_roas: e.target.value }))}
            placeholder="ROAS cible"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <input
            value={campForm.target_leads}
            onChange={(e) => setCampForm((f) => ({ ...f, target_leads: e.target.value }))}
            placeholder="Nombre leads cible"
            className="w-full px-4 py-3 rounded-xl border"
          />
          <textarea
            value={campForm.objective}
            onChange={(e) => setCampForm((f) => ({ ...f, objective: e.target.value }))}
            placeholder="Notes / objectif libre"
            className="w-full px-4 py-3 rounded-xl border min-h-[60px]"
          />
          <textarea
            value={campForm.description}
            onChange={(e) => setCampForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            className="w-full px-4 py-3 rounded-xl border min-h-[60px]"
          />
          <textarea
            value={campForm.creatives_summary}
            onChange={(e) => setCampForm((f) => ({ ...f, creatives_summary: e.target.value }))}
            placeholder="Créatives utilisées"
            className="w-full px-4 py-3 rounded-xl border min-h-[60px]"
          />
          <textarea
            value={campForm.notes}
            onChange={(e) => setCampForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Observations"
            className="w-full px-4 py-3 rounded-xl border min-h-[60px]"
          />
          <button type="button" onClick={() => void saveCamp()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Créer
          </button>
        </div>
      </Modal>

      <Modal open={metricModal} onClose={() => setMetricModal(false)} title="Métrique journalière">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[10px] font-bold uppercase text-zinc-400">Date</label>
          <input
            type="date"
            value={metricForm.metric_date}
            onChange={(e) => setMetricForm((f) => ({ ...f, metric_date: e.target.value }))}
            className="col-span-2 px-3 py-2 rounded-xl border"
          />
          {(['spend', 'impressions', 'clicks', 'leads', 'reach', 'messages', 'confirmed_orders', 'delivered_orders', 'revenue'] as const).map((k) => (
            <input
              key={k}
              value={metricForm[k]}
              onChange={(e) => setMetricForm((f) => ({ ...f, [k]: e.target.value }))}
              placeholder={k}
              className="px-3 py-2 rounded-xl border text-sm"
            />
          ))}
        </div>
        <button type="button" onClick={() => void saveMetric()} className="mt-4 w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
          Enregistrer
        </button>
      </Modal>
    </div>
  );
}
