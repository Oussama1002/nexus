import React, { useMemo, useState } from 'react';
import { ArrowUpRight, TrendingUp, Users, Package, Truck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn, formatCurrency } from '../lib/utils';
import { StatusChip } from '../components/ui/StatusChip';
import { CampaignAnalyticsPlaceholders } from '../components/dashboard/CampaignAnalyticsPlaceholders';

type Range = 'Aujourd’hui' | 'Semaine' | 'Mois' | 'Année';

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
  breakdown?: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' | 'info' }[];
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
        <button className="text-zinc-400 hover:text-zinc-600 transition-colors" aria-label="Open">
          <ArrowUpRight className="w-5 h-5" />
        </button>
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
  const todayLabel = 'Apr 21, 2026';

  const metrics = useMemo(() => {
    if (range === 'Aujourd’hui') return { revenue: 48500, profit: 12400, clients: 38, orders: 128, parcels: 92, sold: 210 };
    if (range === 'Semaine') return { revenue: 312400, profit: 84400, clients: 210, orders: 890, parcels: 720, sold: 1450 };
    if (range === 'Mois') return { revenue: 1282400, profit: 284400, clients: 980, orders: 3820, parcels: 3050, sold: 6120 };
    return { revenue: 14582400, profit: 3184400, clients: 10480, orders: 42820, parcels: 36300, sold: 89120 };
  }, [range]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle={
          <span>
            Vue d’ensemble multi-marques • <span className="font-bold text-[color:var(--color-text-1)]">Today:</span> {todayLabel}
          </span>
        }
        right={
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl p-1">
            {(['Aujourd’hui', 'Semaine', 'Mois', 'Année'] as Range[]).map((r) => (
              <button
                key={r}
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KpiCard title="Chiffre d’affaire" value={formatCurrency(metrics.revenue)} icon={TrendingUp} tone="primary" />
        <KpiCard title="Profit net" value={formatCurrency(metrics.profit)} icon={TrendingUp} tone="success" />
        <KpiCard title="Clients" value={metrics.clients.toLocaleString('fr-MA')} icon={Users} tone="info" />
        <KpiCard
          title="Commandes"
          value={metrics.orders.toLocaleString('fr-MA')}
          icon={Package}
          tone="primary"
          breakdown={[
            { label: 'Confirmé', value: '84', tone: 'success' },
            { label: 'Annulé', value: '11', tone: 'danger' },
            { label: 'Autre', value: '33', tone: 'warning' },
          ]}
        />
        <KpiCard
          title="Colis"
          value={metrics.parcels.toLocaleString('fr-MA')}
          icon={Truck}
          tone="warning"
          breakdown={[
            { label: 'Livré', value: '61', tone: 'success' },
            { label: 'Retourné', value: '7', tone: 'danger' },
            { label: 'Autre', value: '24', tone: 'warning' },
          ]}
        />
        <KpiCard title="Produits vendus" value={metrics.sold.toLocaleString('fr-MA')} icon={Package} tone="info" />
      </div>

      <CampaignAnalyticsPlaceholders />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-[color:var(--color-text-0)]">Analytique</p>
              <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">
                Les statistiques s’afficheront ici une fois enregistrées.
              </p>
            </div>
            <StatusChip tone="info">Aucune donnée disponible</StatusChip>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-muted p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Taux de confirmation</p>
              <p className="mt-2 text-2xl font-black text-zinc-900">—</p>
            </div>
            <div className="card-muted p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Taux de livraison</p>
              <p className="mt-2 text-2xl font-black text-zinc-900">—</p>
            </div>
            <div className="card-muted p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Marge nette</p>
              <p className="mt-2 text-2xl font-black text-zinc-900">—</p>
            </div>
            <div className="card-muted p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Capital</p>
              <p className="mt-2 text-2xl font-black text-zinc-900">—</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <p className="text-sm font-black text-[color:var(--color-text-0)]">Raccourcis opérationnels</p>
          <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">Actions rapides pour l’équipe.</p>
          <div className="mt-6 space-y-3">
            {[
              { label: 'Nouvelle commande', tone: 'bg-primary-600' },
              { label: 'Créer expédition', tone: 'bg-amber-600' },
              { label: 'Ajouter produit', tone: 'bg-emerald-600' },
            ].map((a) => (
              <button
                key={a.label}
                className={cn('w-full flex items-center justify-between px-4 py-3 rounded-2xl text-white font-bold', a.tone)}
              >
                <span className="text-sm">{a.label}</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

