import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, LineChart, Package, RefreshCw, Truck, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../lib/utils';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { useAuth } from '../context/AuthContext';

type DashboardPayload = {
  period?: { from: string; to: string };
  total_leads: number;
  total_messages: number;
  total_orders: number;
  confirmed_orders: number;
  delivered_orders: number;
  returned_orders: number;
  revenue: number;
  ad_spend: number;
  influencer_spend: number;
  total_marketing_spend: number;
  new_customers: number;
  cac: number | null;
  cpa: number | null;
  aov: number | null;
  confirmation_rate: number | null;
  delivery_rate: number | null;
  return_rate: number | null;
};

type AdsRollup = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  revenue: number;
};

type TabId = 'global' | 'ads' | 'commercial' | 'stock' | 'delivery' | 'finance';

const LEAD_STATUS_FR: Record<string, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  confirmed: 'Confirmé',
  lost: 'Perdu',
  archived: 'Archivé',
};

const ORDER_STATUS_FR: Record<string, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  returned: 'Retournée',
  delivered: 'Livrée',
  other: 'Autre',
};

const SHIPMENT_STATUS_FR: Record<string, string> = {
  created: 'Créé',
  pending: 'En attente',
  picked_up: 'Ramassé',
  in_transit: 'En transit',
  out_for_delivery: 'En livraison',
  shipped: 'Expédié',
  delivered: 'Livré',
  returned: 'Retour',
  cancelled: 'Annulé',
  failed: 'Échec',
};

const MOVEMENT_TYPE_FR: Record<string, string> = {
  in: 'Entrée',
  out: 'Sortie',
  adjustment: 'Ajustement',
  return: 'Retour stock',
};

const CHARGE_TYPE_FR: Record<string, string> = {
  ads: 'Ads',
  influencer: 'Influence',
  shipping: 'Livraison',
  packaging: 'Emballage',
  other: 'Autre',
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

/** Laravel pluck / sums often serialize as object maps */
function recordToRows(rec: unknown): { key: string; label: string; value: number }[] {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return [];
  return Object.entries(rec as Record<string, unknown>).map(([key, v]) => ({
    key,
    label: key,
    value: typeof v === 'number' ? v : Number(v) || 0,
  }));
}

function prettifyKey(k: string): string {
  const s = k.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function rowsWithLabels(rows: { key: string; label: string; value: number }[], map: Record<string, string>) {
  return rows.map((r) => ({ ...r, label: map[r.key] ?? prettifyKey(r.key) }));
}

function PeriodLine({ period }: { period?: { from?: string; to?: string } }) {
  if (!period?.from || !period?.to) return null;
  return (
    <p className="text-sm text-zinc-600 mb-4">
      Période :{' '}
      <span className="font-bold text-zinc-900">{period.from}</span> → <span className="font-bold text-zinc-900">{period.to}</span>
    </p>
  );
}

function DistributionPieCard({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: { key: string; label: string; value: number }[];
  emptyHint: string;
}) {
  const data = rows
    .filter((r) => r.value > 0)
    .map((r) => ({ name: r.label, value: r.value }));
  return (
    <div className="card p-4">
      <h3 className="text-sm font-black text-zinc-900 mb-2">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyHint}</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={88}
                paddingAngle={2}
                labelLine={false}
                label={({ name, percent }) => {
                  const pct = (percent ?? 0) * 100;
                  return pct >= 4 ? `${name} ${pct.toFixed(0)}%` : '';
                }}
              >
                {data.map((_, i) => (
                  <Cell key={`pie-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => Number(v).toLocaleString('fr-FR')} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BreakdownPanel({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: { key: string; label: string; value: number }[];
  emptyHint: string;
}) {
  const chartData = rows.map((r) => ({ name: r.label, value: r.value }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-black text-zinc-900">{title}</h3>
        <span className="text-xs font-bold text-zinc-500">Total : {total}</span>
      </div>
      {chartData.length === 0 || total === 0 ? (
        <p className="text-sm text-zinc-500">{emptyHint}</p>
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 font-semibold text-zinc-800">{r.label}</td>
                  <td className="py-2 text-right tabular-nums font-black text-zinc-900">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)} %`;
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-black text-zinc-900 truncate">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function ReportingScreen() {
  const { activeBrandId, activeBrand } = useBrand();
  const toast = useToast();
  const { hasPermission, isAdmin } = useAuth();
  const canView = isAdmin || hasPermission('reports.view');
  const [tab, setTab] = useState<TabId>('global');
  const [dateFrom, setDateFrom] = useState(startOfMonth);
  const [dateTo, setDateTo] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [adsData, setAdsData] = useState<{ metrics_rollups: AdsRollup } | null>(null);
  const [commercial, setCommercial] = useState<Record<string, unknown> | null>(null);
  const [stockRep, setStockRep] = useState<Record<string, unknown> | null>(null);
  const [deliveryRep, setDeliveryRep] = useState<Record<string, unknown> | null>(null);
  const [financeRep, setFinanceRep] = useState<Record<string, unknown> | null>(null);

  const q = useMemo(() => {
    const p = new URLSearchParams();
    p.set('date_from', dateFrom);
    p.set('date_to', dateTo);
    return p.toString();
  }, [dateFrom, dateTo]);

  const loadTab = useCallback(async () => {
    if (!activeBrandId || !canView) return;
    setLoading(true);
    try {
      if (tab === 'global') {
        const res = await api.get<DashboardPayload>(`reports/dashboard?${q}`);
        if (!res.ok) {
          toast.error(res.message);
          setDashboard(null);
          return;
        }
        setDashboard(res.data);
        return;
      }
      if (tab === 'ads') {
        const res = await api.get<{ metrics_rollups: AdsRollup }>(`reports/ads?${q}`);
        if (!res.ok) {
          toast.error(res.message);
          setAdsData(null);
          return;
        }
        setAdsData(res.data);
        return;
      }
      if (tab === 'commercial') {
        const res = await api.get<Record<string, unknown>>(`reports/commercial?${q}`);
        if (!res.ok) {
          toast.error(res.message);
          setCommercial(null);
          return;
        }
        setCommercial(res.data);
        return;
      }
      if (tab === 'stock') {
        const res = await api.get<Record<string, unknown>>(`reports/stock?${q}`);
        if (!res.ok) {
          toast.error(res.message);
          setStockRep(null);
          return;
        }
        setStockRep(res.data);
        return;
      }
      if (tab === 'delivery') {
        const res = await api.get<Record<string, unknown>>(`reports/delivery?${q}`);
        if (!res.ok) {
          toast.error(res.message);
          setDeliveryRep(null);
          return;
        }
        setDeliveryRep(res.data);
        return;
      }
      if (tab === 'finance') {
        const res = await api.get<Record<string, unknown>>(`reports/finance?${q}`);
        if (!res.ok) {
          toast.error(res.message);
          setFinanceRep(null);
          return;
        }
        setFinanceRep(res.data);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, canView, q, tab, toast]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  const adsDerived = useMemo(() => {
    const r = adsData?.metrics_rollups;
    if (!r) return { cpc: null as number | null, cpm: null as number | null, roas: null as number | null };
    const spend = r.spend || 0;
    const clicks = r.clicks || 0;
    const imps = r.impressions || 0;
    const rev = r.revenue || 0;
    const cpc = clicks > 0 ? spend / clicks : null;
    const cpm = imps > 0 ? (spend / imps) * 1000 : null;
    const roas = spend > 0 ? rev / spend : null;
    return { cpc, cpm, roas };
  }, [adsData]);

  const chartRows = useMemo(() => {
    if (!dashboard) return [];
    return [
      { name: 'Leads', v: dashboard.total_leads },
      { name: 'Cmdes', v: dashboard.total_orders },
      { name: 'Messages', v: dashboard.total_messages },
    ];
  }, [dashboard]);

  const globalPipelineChart = useMemo(() => {
    if (!dashboard) return [];
    return [
      { name: 'Confirmées', v: dashboard.confirmed_orders },
      { name: 'Livrées', v: dashboard.delivered_orders },
      { name: 'Retours', v: dashboard.returned_orders },
    ];
  }, [dashboard]);

  const globalMoneyChart = useMemo(() => {
    if (!dashboard) return [];
    return [
      { name: 'CA livré', v: dashboard.revenue },
      { name: 'Ad spend', v: dashboard.ad_spend },
      { name: 'Influence', v: dashboard.influencer_spend },
      { name: 'Marketing total', v: dashboard.total_marketing_spend },
    ];
  }, [dashboard]);

  const globalRatesChart = useMemo(() => {
    if (!dashboard) return [];
    const toPct = (x: number | null | undefined) =>
      x != null && !Number.isNaN(x) ? Math.round(x * 1000) / 10 : 0;
    return [
      { name: 'Confirmation', v: toPct(dashboard.confirmation_rate) },
      { name: 'Livraison', v: toPct(dashboard.delivery_rate) },
      { name: 'Retours', v: toPct(dashboard.return_rate) },
    ];
  }, [dashboard]);

  const adsVolumeChart = useMemo(() => {
    const r = adsData?.metrics_rollups;
    if (!r) return [];
    return [
      { name: 'Impressions', v: r.impressions },
      { name: 'Clics', v: r.clicks },
      { name: 'Leads', v: r.leads },
    ];
  }, [adsData]);

  const adsMoneyChart = useMemo(() => {
    const r = adsData?.metrics_rollups;
    if (!r) return [];
    return [
      { name: 'Spend', v: r.spend },
      { name: 'Revenue', v: r.revenue },
    ];
  }, [adsData]);

  if (!canView) {
    return (
      <EmptyState title="Accès refusé" description="Vous n’avez pas la permission reports.view." />
    );
  }

  if (!activeBrandId) {
    return <EmptyState title="Choisir une marque" description="Sélectionnez une marque active pour charger les reportings." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportings"
        subtitle={activeBrand ? `Marque: ${activeBrand.name}` : 'KPI et agrégations API.'}
        right={
          <button
            type="button"
            onClick={() => void loadTab()}
            className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        }
      />

      <div className="card p-4 flex flex-wrap items-end gap-4">
        <label className="text-[10px] font-black uppercase text-zinc-400 block w-full sm:w-auto">
          Du
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 block px-3 py-2 rounded-xl border border-zinc-200 font-bold" />
        </label>
        <label className="text-[10px] font-black uppercase text-zinc-400 block w-full sm:w-auto">
          Au
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 block px-3 py-2 rounded-xl border border-zinc-200 font-bold" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-100 pb-2">
        {(
          [
            { id: 'global' as const, label: 'Vue globale', icon: BarChart3 },
            { id: 'ads' as const, label: 'Ads', icon: LineChart },
            { id: 'commercial' as const, label: 'Commercial', icon: BarChart3 },
            { id: 'stock' as const, label: 'Stock', icon: Package },
            { id: 'delivery' as const, label: 'Livraison', icon: Truck },
            { id: 'finance' as const, label: 'Finance', icon: Wallet },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-black inline-flex items-center gap-2 ${tab === id ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-700'}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm font-bold text-zinc-500">Chargement…</p>}

      {tab === 'global' && dashboard && (
        <>
          <PeriodLine period={dashboard.period} />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Leads" value={dashboard.total_leads} />
            <Kpi label="Messages" value={dashboard.total_messages} />
            <Kpi label="Commandes" value={dashboard.total_orders} />
            <Kpi label="Confirmées" value={dashboard.confirmed_orders} />
            <Kpi label="Livrées" value={dashboard.delivered_orders} />
            <Kpi label="Retours" value={dashboard.returned_orders} />
            <Kpi label="CA (livré)" value={formatCurrency(dashboard.revenue)} />
            <Kpi label="Ad spend" value={formatCurrency(dashboard.ad_spend)} />
            <Kpi label="Influence" value={formatCurrency(dashboard.influencer_spend)} />
            <Kpi label="Marketing total" value={formatCurrency(dashboard.total_marketing_spend)} />
            <Kpi label="CAC" value={dashboard.cac != null ? formatCurrency(dashboard.cac) : '—'} sub="marketing / nouveaux clients" />
            <Kpi label="CPA" value={dashboard.cpa != null ? formatCurrency(dashboard.cpa) : '—'} sub="ad spend / confirmées" />
            <Kpi label="AOV" value={dashboard.aov != null ? formatCurrency(dashboard.aov) : '—'} />
            <Kpi label="Confirmation" value={pct(dashboard.confirmation_rate)} />
            <Kpi label="Livraison" value={pct(dashboard.delivery_rate)} sub="livrées / confirmées" />
            <Kpi label="Retours" value={pct(dashboard.return_rate)} sub="retours / expédiées" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4 h-72">
              <p className="text-sm font-black mb-2">Aperçu volume (activité)</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={chartRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#6366f1" radius={[6, 6, 0, 0]}>
                    {chartRows.map((_, i) => (
                      <Cell key={`vol-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4 h-72">
              <p className="text-sm font-black mb-2">Pipeline commandes</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={globalPipelineChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4 h-72">
              <p className="text-sm font-black mb-2">CA & dépenses marketing (MAD)</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={globalMoneyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                  <Bar dataKey="v" fill="#059669" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4 h-72">
              <p className="text-sm font-black mb-2">Taux (%) — confirmation, livraison, retours</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={globalRatesChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => `${Number(v).toFixed(1)} %`} />
                  <Bar dataKey="v" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {tab === 'global' && !loading && !dashboard && (
        <EmptyState title="Aucune donnée" description="Vérifiez la période ou les droits API." />
      )}

      {tab === 'ads' && adsData?.metrics_rollups && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Spend" value={formatCurrency(adsData.metrics_rollups.spend)} />
            <Kpi label="Impressions" value={adsData.metrics_rollups.impressions} />
            <Kpi label="Clics" value={adsData.metrics_rollups.clicks} />
            <Kpi label="Leads" value={adsData.metrics_rollups.leads} />
            <Kpi label="Revenue" value={formatCurrency(adsData.metrics_rollups.revenue)} />
            <Kpi label="CPC" value={adsDerived.cpc != null ? formatCurrency(adsDerived.cpc) : '—'} />
            <Kpi label="CPM" value={adsDerived.cpm != null ? formatCurrency(adsDerived.cpm) : '—'} />
            <Kpi label="ROAS" value={adsDerived.roas != null ? adsDerived.roas.toFixed(2) : '—'} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4 h-72">
              <p className="text-sm font-black mb-2">Volumes média</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={adsVolumeChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(v: number) => Number(v).toLocaleString('fr-FR')} />
                  <Bar dataKey="v" fill="#6366f1" radius={[6, 6, 0, 0]}>
                    {adsVolumeChart.map((_, i) => (
                      <Cell key={`ads-v-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4 h-72">
              <p className="text-sm font-black mb-2">Spend vs revenue (MAD)</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={adsMoneyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                  <Bar dataKey="v" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === 'ads' && !loading && !adsData && <EmptyState title="Pas de données Ads" description="Ajoutez des métriques de campagne sur la période." />}

      {tab === 'commercial' && commercial && (
        <div className="space-y-6">
          <PeriodLine period={commercial.period as { from?: string; to?: string }} />
          <div className="grid lg:grid-cols-2 gap-4">
            <BreakdownPanel
              title="Leads par statut"
              rows={rowsWithLabels(recordToRows(commercial.leads_by_status), LEAD_STATUS_FR)}
              emptyHint="Aucun lead créé sur cette période pour cette marque."
            />
            <BreakdownPanel
              title="Commandes par statut"
              rows={rowsWithLabels(recordToRows(commercial.orders_by_status), ORDER_STATUS_FR)}
              emptyHint="Aucune commande sur cette période pour cette marque."
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <DistributionPieCard
              title="Répartition des leads"
              rows={rowsWithLabels(recordToRows(commercial.leads_by_status), LEAD_STATUS_FR)}
              emptyHint="Pas de leads à afficher."
            />
            <DistributionPieCard
              title="Répartition des commandes"
              rows={rowsWithLabels(recordToRows(commercial.orders_by_status), ORDER_STATUS_FR)}
              emptyHint="Pas de commandes à afficher."
            />
          </div>
        </div>
      )}

      {tab === 'commercial' && !loading && !commercial && (
        <EmptyState title="Données commercial indisponibles" description="Impossible de charger reports/commercial ou période invalide." />
      )}

      {tab === 'stock' && stockRep && (
        <div className="space-y-6">
          <PeriodLine period={stockRep.period as { from?: string; to?: string }} />
          <div className="grid lg:grid-cols-2 gap-4">
            <BreakdownPanel
              title="Mouvements de stock par type"
              rows={rowsWithLabels(recordToRows(stockRep.movements_by_type), MOVEMENT_TYPE_FR)}
              emptyHint="Aucun mouvement de stock sur cette période."
            />
            <DistributionPieCard
              title="Répartition des mouvements"
              rows={rowsWithLabels(recordToRows(stockRep.movements_by_type), MOVEMENT_TYPE_FR)}
              emptyHint="Pas de mouvements à afficher."
            />
          </div>
        </div>
      )}

      {tab === 'stock' && !loading && !stockRep && (
        <EmptyState title="Données stock indisponibles" description="Impossible de charger reports/stock." />
      )}

      {tab === 'delivery' && deliveryRep && (
        <div className="space-y-6">
          <PeriodLine period={deliveryRep.period as { from?: string; to?: string }} />
          <div className="grid lg:grid-cols-2 gap-4">
            <BreakdownPanel
              title="Expéditions par statut"
              rows={rowsWithLabels(recordToRows(deliveryRep.shipments_by_status), SHIPMENT_STATUS_FR)}
              emptyHint="Aucune expédition sur cette période."
            />
            <DistributionPieCard
              title="Répartition des expéditions"
              rows={rowsWithLabels(recordToRows(deliveryRep.shipments_by_status), SHIPMENT_STATUS_FR)}
              emptyHint="Pas d’expéditions à afficher."
            />
          </div>
        </div>
      )}

      {tab === 'delivery' && !loading && !deliveryRep && (
        <EmptyState title="Données livraison indisponibles" description="Impossible de charger reports/delivery." />
      )}

      {tab === 'finance' && financeRep && (
        <div className="space-y-6">
          <PeriodLine period={financeRep.period as { from?: string; to?: string }} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi label="Total charges (période)" value={formatCurrency(Number(financeRep.total ?? 0))} />
          </div>
          <div className="card p-4 space-y-4">
            <h3 className="text-sm font-black text-zinc-900">Charges par type</h3>
            {recordToRows(financeRep.charges_by_type).length === 0 ? (
              <p className="text-sm text-zinc-500">Aucune charge enregistrée sur cette période.</p>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rowsWithLabels(recordToRows(financeRep.charges_by_type), CHARGE_TYPE_FR).map((r) => ({
                        name: r.label,
                        value: r.value,
                      }))}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip formatter={(v: number) => formatCurrency(Number(v))} />
                      <Bar dataKey="value" fill="#059669" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-zinc-100">
                    {rowsWithLabels(recordToRows(financeRep.charges_by_type), CHARGE_TYPE_FR).map((r) => (
                      <tr key={r.key}>
                        <td className="py-2 font-semibold text-zinc-800">{r.label}</td>
                        <td className="py-2 text-right tabular-nums font-black text-zinc-900">{formatCurrency(r.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'finance' && !loading && !financeRep && (
        <EmptyState title="Données finance indisponibles" description="Impossible de charger reports/finance." />
      )}
    </div>
  );
}
