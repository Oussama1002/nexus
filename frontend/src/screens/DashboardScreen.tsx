import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, TrendingUp, Users, Package, Truck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn, formatCurrency } from '../lib/utils';
import { StatusChip } from '../components/ui/StatusChip';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';

type Range = 'Aujourd’hui' | 'Semaine' | 'Mois' | 'Année';

type DashboardPayload = {
  counts: {
    brands: number;
    leads: number;
    orders: number;
    customers: number;
    shipments: number;
    products_sold_qty: number;
    revenue: number;
  };
  orders_by_status: Record<string, number>;
  shipments_by_status: Record<string, number>;
};

function dateRangeParams(range: Range): { date_from?: string; date_to?: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  if (range === 'Aujourd’hui') {
    const d = isoLocal(now);
    return { date_from: d, date_to: d };
  }
  if (range === 'Semaine') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { date_from: isoLocal(start), date_to: isoLocal(now) };
  }
  if (range === 'Mois') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { date_from: isoLocal(start), date_to: isoLocal(now) };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  return { date_from: isoLocal(start), date_to: isoLocal(now) };
}

function breakdownRecord(rec: Record<string, number> | undefined, limit = 6) {
  if (!rec || Object.keys(rec).length === 0) return [];
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({
      label,
      value: String(value),
      tone: 'neutral' as const,
    }));
}

function KpiCard({
  title,
  value,
  icon: Icon,
  tone = 'primary',
  breakdown,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'primary' | 'success' | 'warning' | 'info';
  breakdown?: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }[];
}) {
  const toneBg =
    tone === 'success'
      ? 'bg-emerald-600'
      : tone === 'warning'
        ? 'bg-amber-600'
        : tone === 'info'
          ? 'bg-blue-600'
          : 'bg-primary-600';
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className={cn('p-2 rounded-xl text-white', toneBg)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[color:var(--color-text-2)]">{title}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-[color:var(--color-text-0)]">{value}</p>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {breakdown.map((b) => (
            <React.Fragment key={b.label}>
              <StatusChip tone={b.tone ?? 'neutral'} className="normal-case tracking-normal font-bold">
                {b.label}: {b.value}
              </StatusChip>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardScreen() {
  const [range, setRange] = useState<Range>('Aujourd’hui');
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayLabel = useMemo(() => new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' }), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const dr = dateRangeParams(range);
    const res = await api.get<DashboardPayload>(`dashboard${buildQuery(dr)}`);
    if (res.ok && res.data) {
      setPayload({
        counts: res.data.counts,
        orders_by_status: res.data.orders_by_status ?? {},
        shipments_by_status: res.data.shipments_by_status ?? {},
      });
    } else {
      setPayload(null);
      setError(res.message);
    }
    setLoading(false);
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const c = payload?.counts;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle={
          <span>
            Données issues de la base • <span className="font-bold text-[color:var(--color-text-1)]">Aujourd’hui :</span> {todayLabel}
          </span>
        }
        right={
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl p-1">
            {(['Aujourd’hui', 'Semaine', 'Mois', 'Année'] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  'px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors',
                  range === r ? 'bg-primary-600 text-white shadow-sm' : 'text-zinc-500 hover:bg-white',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      )}

      {loading && !c ? (
        <p className="text-sm font-bold text-zinc-500">Chargement des indicateurs…</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <KpiCard
            title="Chiffre d’affaires (commandes)"
            value={c ? formatCurrency(c.revenue) : '—'}
            icon={TrendingUp}
            tone="primary"
          />
          <KpiCard
            title="Leads"
            value={c ? c.leads.toLocaleString('fr-MA') : '—'}
            icon={Megaphone}
            tone="success"
          />
          <KpiCard
            title="Clients"
            value={c ? c.customers.toLocaleString('fr-MA') : '—'}
            icon={Users}
            tone="info"
          />
          <KpiCard
            title="Commandes"
            value={c ? c.orders.toLocaleString('fr-MA') : '—'}
            icon={Package}
            tone="primary"
            breakdown={breakdownRecord(payload?.orders_by_status)}
          />
          <KpiCard
            title="Colis"
            value={c ? c.shipments.toLocaleString('fr-MA') : '—'}
            icon={Truck}
            tone="warning"
            breakdown={breakdownRecord(payload?.shipments_by_status)}
          />
          <KpiCard
            title="Produits vendus (qty)"
            value={c ? c.products_sold_qty.toLocaleString('fr-MA') : '—'}
            icon={Package}
            tone="info"
          />
        </div>
      )}

      <div className="card p-6">
        <p className="text-sm font-black text-[color:var(--color-text-0)]">Campagnes & analytics marketing</p>
        <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">
          Les graphes et attributions détaillées (sources, coûts Meta, etc.) sont disponibles via les modules{' '}
          <strong>Campagnes Ads</strong> et <strong>Reportings</strong>, branchés sur les mêmes données.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-[color:var(--color-text-0)]">Synthèse</p>
              <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">
                Les totaux respectent la période choisie ci-dessus (filtre sur les dates de création des enregistrements).
              </p>
            </div>
            <StatusChip tone="info">{c ? `${c.brands} marque(s)` : '—'}</StatusChip>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Marge, capital ou ratios avancés nécessitent les modules Finance / Reportings selon votre périmètre.
          </p>
        </div>

        <div className="card p-6">
          <p className="text-sm font-black text-[color:var(--color-text-0)]">Navigation</p>
          <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">
            Utilisez le menu latéral pour créer commandes, expéditions ou produits — chaque action enregistrée apparaît dans
            l’API et l’historique d’audit.
          </p>
        </div>
      </div>
    </div>
  );
}
