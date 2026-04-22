import React, { useMemo, useState } from 'react';
import { Calendar, ChevronRight, Filter, Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { StatusChip } from '../components/ui/StatusChip';
import { cn, formatCurrency } from '../lib/utils';
import type { Order, OrderStatus, PaymentState } from '../domain/orders';

function toneForStatus(s: OrderStatus): Parameters<typeof StatusChip>[0]['tone'] {
  switch (s) {
    case 'Confirmé':
    case 'Livré':
      return 'success';
    case 'En attente':
      return 'warning';
    case 'Annulé':
    case 'Retourné':
      return 'danger';
    default:
      return 'neutral';
  }
}

function toneForPayment(p: PaymentState): Parameters<typeof StatusChip>[0]['tone'] {
  switch (p) {
    case 'Payé':
      return 'success';
    case 'Impayé':
      return 'danger';
    case 'Partiel':
      return 'warning';
    case 'Remboursé':
      return 'info';
    default:
      return 'neutral';
  }
}

export function OrdersListScreen({
  onNewOrder,
  orders,
}: {
  onNewOrder: () => void;
  orders: Order[];
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'Tous'>('Tous');
  const [payment, setPayment] = useState<PaymentState | 'Tous'>('Tous');
  const [brand, setBrand] = useState<'Toutes' | 'Luxe Cosmetics' | 'Zest Home' | 'Moda Casa'>('Toutes');
  const [dateRange, setDateRange] = useState<'Aujourd’hui' | '7 jours' | '30 jours' | '90 jours'>('7 jours');

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesQuery =
        !query ||
        o.id.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query) ||
        o.phone.toLowerCase().includes(query) ||
        o.city.toLowerCase().includes(query);
      const matchesStatus = status === 'Tous' ? true : o.status === status;
      const matchesPayment = payment === 'Tous' ? true : o.payment === payment;
      const matchesBrand = brand === 'Toutes' ? true : o.brand === brand;
      // dateRange is currently a UX control; wire to backend later
      return matchesQuery && matchesStatus && matchesPayment && matchesBrand;
    });
  }, [orders, q, status, payment, brand, dateRange]);

  const selected = useMemo(() => filtered.find((o) => o.id === selectedId) ?? orders.find((o) => o.id === selectedId) ?? null, [filtered, orders, selectedId]);

  const columns = useMemo<Column<Order>[]>(() => {
    return [
      {
        key: 'id',
        header: 'Commande',
        cell: (o) => (
          <div className="space-y-1">
            <p className="text-sm font-black text-zinc-900">{o.id}</p>
            <p className="text-[11px] font-medium text-zinc-500">{o.createdAt} • {o.source}</p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Client',
        cell: (o) => (
          <div className="space-y-1">
            <p className="text-sm font-bold text-zinc-900">{o.customerName}</p>
            <p className="text-[11px] font-medium text-zinc-500">{o.phone} • {o.city}</p>
          </div>
        ),
      },
      {
        key: 'brand',
        header: 'Marque',
        cell: (o) => <span className="text-sm font-bold text-zinc-700">{o.brand}</span>,
      },
      {
        key: 'status',
        header: 'Statut',
        cell: (o) => <StatusChip tone={toneForStatus(o.status)}>{o.status}</StatusChip>,
      },
      {
        key: 'payment',
        header: 'Paiement',
        cell: (o) => <StatusChip tone={toneForPayment(o.payment)}>{o.payment}</StatusChip>,
      },
      {
        key: 'total',
        header: 'Total',
        className: 'text-right',
        cell: (o) => <span className="text-sm font-black text-zinc-900">{formatCurrency(o.total)}</span>,
      },
      {
        key: 'open',
        header: '',
        className: 'text-right',
        cell: (o) => (
          <button
            type="button"
            onClick={() => setSelectedId(o.id)}
            className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700"
          >
            Ouvrir <ChevronRight className="w-4 h-4" />
          </button>
        ),
      },
    ];
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes"
        subtitle="Liste opérationnelle des commandes multi-marques (Maroc)."
        right={
          <button
            type="button"
            onClick={onNewOrder}
            className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nouvelle commande
          </button>
        }
      />

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <>
            <div className="hidden lg:flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
              >
                <option>Aujourd’hui</option>
                <option>7 jours</option>
                <option>30 jours</option>
                <option>90 jours</option>
              </select>
            </div>

            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
            >
              <option>Toutes</option>
              <option>Luxe Cosmetics</option>
              <option>Zest Home</option>
              <option>Moda Casa</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
            >
              <option>Tous</option>
              <option>Brouillon</option>
              <option>En attente</option>
              <option>Confirmé</option>
              <option>Annulé</option>
              <option>Retourné</option>
              <option>Livré</option>
              <option>Autre</option>
            </select>

            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
            >
              <option>Tous</option>
              <option>Payé</option>
              <option>Impayé</option>
              <option>Partiel</option>
              <option>Remboursé</option>
            </select>
          </>
        }
        right={
          <button type="button" className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtres avancés
          </button>
        }
      />

      <DataTable
        rows={filtered}
        columns={columns}
        density="comfortable"
        emptyTitle="Aucune commande"
        emptyDescription="Il n’y a pas encore de commandes à afficher. Créez votre première commande."
      />

      <Drawer
        open={!!selected}
        title={selected ? selected.id : ''}
        subtitle={selected ? `${selected.customerName} • ${selected.phone} • ${selected.city}` : undefined}
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <div className="space-y-6">
            <div className="card-muted p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Statut</p>
                  <StatusChip tone={toneForStatus(selected.status)}>{selected.status}</StatusChip>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Paiement</p>
                  <StatusChip tone={toneForPayment(selected.payment)}>{selected.payment}</StatusChip>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total</p>
                <p className="text-lg font-black text-zinc-900">{formatCurrency(selected.total)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Produits</p>
              <div className="card overflow-hidden">
                <div className="divide-y divide-zinc-100">
                  {selected.items.map((it) => (
                    <div key={it.name} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{it.name}</p>
                        <p className="text-[11px] text-zinc-500 font-medium">Qté {it.qty}</p>
                      </div>
                      <p className="text-sm font-black text-zinc-900">{formatCurrency(it.price)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {selected.notes && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Notes</p>
                <div className="card-muted p-4 text-sm font-medium text-zinc-700 whitespace-pre-wrap">{selected.notes}</div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Actions</p>
              <div className="grid grid-cols-2 gap-3">
                <button className="py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700 transition-colors">Confirmer</button>
                <button className="py-3 rounded-xl border border-rose-200 text-rose-700 font-black text-sm hover:bg-rose-50 transition-colors">Annuler</button>
                <button className="col-span-2 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-black text-sm hover:bg-zinc-50 transition-colors">Créer expédition</button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

