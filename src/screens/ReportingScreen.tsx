import React, { useMemo, useState } from 'react';
import { Download, FileText, Filter } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';
import type { Brand, User } from '../types';
import type { Order } from '../domain/orders';
import type { Shipment } from '../domain/shipments';
import type { Product } from '../domain/products';
import type { Charge } from '../domain/finance';

type TimeTab = 'Aujourd’hui' | 'Semaine' | 'Mois' | 'Année';

function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, string | number>[]) {
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (x: string) => `"${x.replaceAll('"', '""')}"`;
  const lines = rows.map((r) => headers.map((h) => esc(String(r[h] ?? ''))).join(','));
  return [headers.join(','), ...lines].join('\n');
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: Parameters<typeof StatusChip>[0]['tone'];
}) {
  const dot =
    tone === 'success'
      ? 'bg-emerald-600'
      : tone === 'warning'
        ? 'bg-amber-600'
        : tone === 'danger'
          ? 'bg-rose-600'
          : tone === 'info'
            ? 'bg-blue-600'
            : 'bg-zinc-300';
  return (
    <div className="card p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3 min-w-0">
        <p className="text-2xl font-black text-zinc-900 min-w-0 truncate">{value}</p>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
      </div>
    </div>
  );
}

function PlaceholderCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-zinc-900">{title}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">{subtitle}</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 border border-zinc-200 px-3 py-1 rounded-full">
          placeholder
        </span>
      </div>
      <div className="mt-5 h-40 rounded-2xl bg-gradient-to-br from-zinc-50 to-white border border-zinc-200 flex items-center justify-center">
        <span className="text-xs font-bold text-zinc-400">Zone graphique</span>
      </div>
    </div>
  );
}

export function ReportingScreen({
  orders,
  shipments,
  products,
  charges,
  brands,
  users,
}: {
  orders: Order[];
  shipments: Shipment[];
  products: Product[];
  charges: Charge[];
  brands: Brand[];
  users: User[];
}) {
  const [tab, setTab] = useState<TimeTab>('Aujourd’hui');
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<string>('Toutes');
  const [source, setSource] = useState<string>('Toutes');
  const [confirmatrice, setConfirmatrice] = useState<string>('Toutes');

  const sources = useMemo(() => ['Toutes', ...Array.from(new Set(orders.map((o) => o.source))).sort()], [orders]);
  const brandNames = useMemo(() => ['Toutes', ...brands.map((b) => b.name)], [brands]);
  const confirmatrices = useMemo(
    () => ['Toutes', ...users.filter((u) => u.role === 'confirmatrice').map((u) => u.name)],
    [users],
  );

  const filteredOrders = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (brand !== 'Toutes' && o.brand !== brand) return false;
      if (source !== 'Toutes' && o.source !== source) return false;
      // confirmatrice is placeholder until binding; keep filter present
      if (confirmatrice !== 'Toutes') {
        const meta = (o as any)?.confirmatrice ?? '';
        if (meta !== confirmatrice) return false;
      }
      if (!s) return true;
      const blob = `${o.id} ${o.customerName} ${o.phone} ${o.city} ${o.brand} ${o.source} ${o.status}`.toLowerCase();
      return blob.includes(s);
    });
  }, [orders, q, brand, source, confirmatrice]);

  const ca = useMemo(() => filteredOrders.reduce((s, o) => s + o.total, 0), [filteredOrders]);
  const chargesSum = useMemo(() => charges.reduce((s, c) => s + c.amount, 0), [charges]);
  const profit = useMemo(() => ca - chargesSum, [ca, chargesSum]);

  const kpi = useMemo(
    () => ({
      ca,
      profit,
      orders: filteredOrders.length,
      parcels: shipments.length,
      productsSold: filteredOrders.reduce((s, o) => s + o.items.reduce((t, l) => t + l.qty, 0), 0),
      clients: new Set(filteredOrders.map((o) => o.phone)).size,
    }),
    [ca, profit, filteredOrders, shipments.length],
  );

  const exportRows = useMemo(
    () =>
      filteredOrders.slice(0, 500).map((o) => ({
        id: o.id,
        brand: o.brand,
        source: o.source,
        customer: o.customerName,
        phone: o.phone,
        city: o.city,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
      })),
    [filteredOrders],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportings"
        subtitle="Centre d’analytique consolidé (KPI + sections + exports)."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadText(`reporting.${Date.now()}.csv`, toCsv(exportRows), 'text/csv;charset=utf-8')}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
            <button
              onClick={() => alert('Export PDF: placeholder (à implémenter)')}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Export PDF
            </button>
            <button
              onClick={() => alert('Export Excel: placeholder (à implémenter)')}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export Excel
            </button>
          </div>
        }
      />

      <div className="card p-3 flex flex-wrap items-center gap-2">
        {(['Aujourd’hui', 'Semaine', 'Mois', 'Année'] as TimeTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${
              tab === t ? 'bg-primary-50 text-primary-700' : 'hover:bg-zinc-50 text-zinc-700'
            }`}
          >
            {t}
          </button>
        ))}
        <div className="ml-auto text-xs font-black text-zinc-400 uppercase tracking-widest px-3 py-2">
          Période: {tab} (placeholder)
        </div>
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="hidden md:flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest">
              <Filter className="w-4 h-4" /> Filtres
            </div>
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {brandNames.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={confirmatrice} onChange={(e) => setConfirmatrice(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {confirmatrices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        }
        right={<div className="text-sm font-black text-zinc-700">{filteredOrders.length} commandes (filtrées)</div>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Kpi label="Chiffre d’affaire" value={formatCurrency(kpi.ca)} tone="info" />
        <Kpi label="Profit net" value={formatCurrency(kpi.profit)} tone={kpi.profit >= 0 ? 'success' : 'danger'} />
        <Kpi label="Commandes" value={kpi.orders} />
        <Kpi label="Colis" value={kpi.parcels} />
        <Kpi label="Produits vendus" value={kpi.productsSold} />
        <Kpi label="Clients" value={kpi.clients} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PlaceholderCard title="Commandes par source" subtitle="Distribution (Facebook, TikTok, WhatsApp...)" />
        <PlaceholderCard title="CA par marque" subtitle="Contribution multi-marques" />
        <PlaceholderCard title="Performance confirmatrices" subtitle="Volume, tx confirmation, SLA" />
        <PlaceholderCard title="Évolution charges" subtitle="Charges / jour (ou semaine)" />
        <PlaceholderCard title="Taux de confirmation" subtitle="Confirmé / total" />
        <PlaceholderCard title="Taux de livraison" subtitle="Livré / expédié" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <p className="text-sm font-black text-zinc-900">Sections de rapports</p>
          <div className="flex flex-wrap gap-2">
            {['ventes', 'confirmations', 'livraisons', 'finances', 'sources', 'marques', 'confirmatrices'].map((x) => (
              <span key={x} className="text-xs font-black text-zinc-600 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-full">
                {x}
              </span>
            ))}
          </div>
          <p className="text-xs font-medium text-zinc-500">
            Les widgets sont prêts. Les graphiques seront branchés plus tard (Recharts/echarts) avec les vraies agrégations.
          </p>
        </div>

        <DataTable
          rows={exportRows.slice(0, 10)}
          columns={[
            { key: 'id', header: 'Commande', cell: (r) => <span className="font-black text-zinc-900">{r.id}</span> },
            { key: 'brand', header: 'Marque', cell: (r) => <span className="font-bold text-zinc-700">{r.brand}</span> },
            { key: 'source', header: 'Source', cell: (r) => <span className="font-bold text-zinc-700">{r.source}</span> },
            { key: 'total', header: 'CA', cell: (r) => <span className="font-black text-zinc-900">{formatCurrency(Number(r.total))}</span> },
            { key: 'status', header: 'Statut', cell: (r) => <StatusChip tone="neutral">{r.status}</StatusChip> },
          ]}
          emptyTitle="Aucune donnée"
          emptyDescription="Aucune commande pour les filtres actuels."
        />
      </div>
    </div>
  );
}

