import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, TrendingUp, Users, Package, Truck, ShoppingCart, CheckCircle2, Percent, AlertTriangle, ArrowRight, Plus, BarChart3, MessageSquare, Settings, ClipboardList } from 'lucide-react';
import { DashboardNotificationsSection } from '../components/dashboard/DashboardNotificationsSection';
import type { DashboardNotification } from '../components/dashboard/DashboardNotificationsSection';
import { PageHeader } from '../components/ui/PageHeader';
import { cn, formatCurrency } from '../lib/utils';
import { StatusChip } from '../components/ui/StatusChip';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import { useNavigate } from 'react-router-dom';
import { pathForView } from '../lib/appPaths';
import { useBrand } from '../context/BrandContext';

type Range = "Aujourd'hui" | 'Semaine' | 'Mois' | 'Année';

type DashboardPayload = {
  counts: {
    brands: number;
    leads: number;
    orders: number;
    customers: number;
    shipments: number;
    products_sold_qty: number;
    revenue: number;
    confirmed_orders: number;
    delivered_shipments: number;
    leads_confirmed: number;
    products: number;
    low_stock: number;
    avg_order_value: number;
    confirmation_rate: number;
    delivery_rate: number;
  };
  orders_by_status: Record<string, number>;
  shipments_by_status: Record<string, number>;
};

function dateRangeParams(range: Range): { date_from?: string; date_to?: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  if (range === "Aujourd'hui") {
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
  const navigate = useNavigate();
  const { activeBrandId } = useBrand();
  const [range, setRange] = useState<Range>("Aujourd'hui");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayLabel = useMemo(() => new Date().toLocaleDateString("fr-FR", { dateStyle: "long" }), []);

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
        notifications: res.data.notifications ?? { items: [], summary: { total: 0, danger: 0, warning: 0 } },
      });
    } else {
      setPayload(null);
      setError(res.message);
    }
    setLoading(false);
  }, [range, activeBrandId]);

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
            Données issues de la base • <span className="font-bold text-[color:var(--color-text-1)]">Aujourd'hui :</span> {todayLabel}
          </span>
        }
        right={
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl p-1">
            {(["Aujourd'hui", 'Semaine', 'Mois', 'Année'] as Range[]).map((r) => (
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

      <DashboardNotificationsSection data={payload?.notifications ?? null} loading={loading} />

      {loading && !c ? (
        <p className="text-sm font-bold text-zinc-500">Chargement des indicateurs…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <KpiCard
              title="Chiffre d'affaires"
              value={c ? formatCurrency(c.revenue) : '—'}
              icon={TrendingUp}
              tone="primary"
            />
            <KpiCard
              title="Commandes"
              value={c ? c.orders.toLocaleString('fr-MA') : '—'}
              icon={ShoppingCart}
              tone="primary"
              breakdown={breakdownRecord(payload?.orders_by_status)}
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <KpiCard
              title="Panier moyen"
              value={c ? formatCurrency(c.avg_order_value) : '—'}
              icon={TrendingUp}
              tone="info"
            />
            <KpiCard
              title="Taux de confirmation"
              value={c ? `${c.confirmation_rate}%` : '—'}
              icon={CheckCircle2}
              tone="success"
            />
            <KpiCard
              title="Taux de livraison"
              value={c ? `${c.delivery_rate}%` : '—'}
              icon={Truck}
              tone="warning"
            />
            <KpiCard
              title="Colis"
              value={c ? c.shipments.toLocaleString('fr-MA') : '—'}
              icon={Truck}
              tone="warning"
              breakdown={breakdownRecord(payload?.shipments_by_status)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <KpiCard
              title="Produits vendus"
              value={c ? c.products_sold_qty.toLocaleString('fr-MA') : '—'}
              icon={Package}
              tone="info"
            />
            <KpiCard
              title="Produits en catalogue"
              value={c ? c.products.toLocaleString('fr-MA') : '—'}
              icon={Package}
              tone="primary"
            />
            <KpiCard
              title="Stock faible"
              value={c ? c.low_stock.toLocaleString('fr-MA') : '—'}
              icon={AlertTriangle}
              tone={c && c.low_stock > 0 ? 'warning' : 'success'}
            />
            <KpiCard
              title="Marques"
              value={c ? c.brands.toLocaleString('fr-MA') : '—'}
              icon={BarChart3}
              tone="primary"
            />
          </div>
        </>
      )}

      {/* Accès rapide */}
      <div className="space-y-3">
        <p className="text-sm font-black uppercase tracking-widest text-zinc-500">Accès rapide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Nouvelle commande', icon: Plus, path: 'ordersNew', color: 'bg-primary-600' },
            { label: 'Nouveau lead', icon: Megaphone, path: 'leads', color: 'bg-emerald-600' },
            { label: 'Conversations', icon: MessageSquare, path: 'whatsapp', color: 'bg-blue-600' },
            { label: 'Produits & Stock', icon: Package, path: 'products', color: 'bg-amber-600' },
            { label: 'Reportings', icon: BarChart3, path: 'reporting', color: 'bg-violet-600' },
            { label: 'Finance', icon: TrendingUp, path: 'finance', color: 'bg-rose-600' },
            { label: 'Colis & expéditions', icon: Truck, path: 'trackingParcels', color: 'bg-teal-600' },
            { label: 'Paramètres', icon: Settings, path: 'settings', color: 'bg-zinc-700' },
          ].map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(pathForView(item.path as any))}
              className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow group text-left"
            >
              <div className={cn('p-2.5 rounded-xl text-white', item.color)}>
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold text-zinc-800 flex-1">{item.label}</span>
              <ArrowRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-black text-[color:var(--color-text-0)]">Commandes par statut</p>
              <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">
                Répartition sur la période sélectionnée
              </p>
            </div>
            <StatusChip tone="info">{c ? `${c.orders} total` : '—'}</StatusChip>
          </div>
          {payload?.orders_by_status && Object.keys(payload.orders_by_status).length > 0 ? (
            <div className="space-y-2.5">
              {(() => {
                const entries = Object.entries(payload.orders_by_status).sort((a, b) => b[1] - a[1]);
                const max = Math.max(...entries.map(([, v]) => v), 1);
                const colors: Record<string, string> = { confirmed: 'bg-emerald-500', pending: 'bg-amber-500', shipped: 'bg-blue-500', delivered: 'bg-primary-600', cancelled: 'bg-rose-500', returned: 'bg-zinc-400', new: 'bg-cyan-500' };
                return entries.map(([label, value]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-600 w-24 text-right capitalize">{label}</span>
                    <div className="flex-1 h-7 bg-zinc-100 rounded-lg overflow-hidden">
                      <div
                        className={cn('h-full rounded-lg transition-all duration-500', colors[label] ?? 'bg-primary-400')}
                        style={{ width: `${Math.max((value / max) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-zinc-800 w-10">{value}</span>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 mt-4">Aucune commande sur cette période.</p>
          )}
        </div>

        <div className="card p-6">
          <p className="text-sm font-black text-[color:var(--color-text-0)]">Colis par statut</p>
          <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)] mb-4">
            Répartition des expéditions
          </p>
          {payload?.shipments_by_status && Object.keys(payload.shipments_by_status).length > 0 ? (
            <div className="space-y-2.5">
              {(() => {
                const entries = Object.entries(payload.shipments_by_status).sort((a, b) => b[1] - a[1]);
                const max = Math.max(...entries.map(([, v]) => v), 1);
                const colors: Record<string, string> = { delivered: 'bg-emerald-500', in_transit: 'bg-blue-500', pending: 'bg-amber-500', returned: 'bg-rose-500', cancelled: 'bg-zinc-400', created: 'bg-cyan-500' };
                return entries.map(([label, value]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-zinc-600 w-20 text-right capitalize">{label.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-7 bg-zinc-100 rounded-lg overflow-hidden">
                      <div
                        className={cn('h-full rounded-lg transition-all duration-500', colors[label] ?? 'bg-primary-400')}
                        style={{ width: `${Math.max((value / max) * 100, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-zinc-800 w-10">{value}</span>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <p className="text-xs text-zinc-400 mt-4">Aucun colis sur cette période.</p>
          )}
        </div>
      </div>
    </div>
  );
}
