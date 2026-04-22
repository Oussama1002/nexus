import React, { useMemo, useState } from 'react';
import { Calendar, ChevronRight, Filter, Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';
import type { Shipment, ShipmentDraft, ShipmentStatus } from '../domain/shipments';
import { trackSession } from '../lib/session';

function toneForShipmentStatus(s: ShipmentStatus): Parameters<typeof StatusChip>[0]['tone'] {
  switch (s) {
    case 'Livré':
      return 'success';
    case 'En livraison':
    case 'Expédié':
      return 'info';
    case 'En préparation':
      return 'warning';
    case 'Retourné':
    case 'Annulé':
      return 'danger';
    case 'Retard':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function ShipmentsScreen({
  shipments,
  onCreate,
}: {
  shipments: Shipment[];
  onCreate: (draft: ShipmentDraft) => void;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ShipmentStatus | 'Tous'>('Tous');
  const [carrier, setCarrier] = useState<'Tous' | Shipment['carrier']>('Tous');
  const [dateRange, setDateRange] = useState<'Aujourd’hui' | '7 jours' | '30 jours' | '90 jours'>('7 jours');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<ShipmentDraft>({
    orderId: '',
    brand: 'Luxe Cosmetics',
    customerName: '',
    phone: '+212 ',
    city: 'Casablanca',
    status: 'En préparation',
    carrier: 'Amana',
    codAmount: 0,
    notes: '',
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return shipments.filter((s) => {
      const matchesQ =
        !query ||
        s.tracking.toLowerCase().includes(query) ||
        s.customerName.toLowerCase().includes(query) ||
        s.phone.toLowerCase().includes(query) ||
        s.city.toLowerCase().includes(query) ||
        (s.orderId ?? '').toLowerCase().includes(query);
      const matchesStatus = status === 'Tous' ? true : s.status === status;
      const matchesCarrier = carrier === 'Tous' ? true : s.carrier === carrier;
      // dateRange: UI control; backend later
      return matchesQ && matchesStatus && matchesCarrier;
    });
  }, [shipments, q, status, carrier, dateRange]);

  const selected = useMemo(() => shipments.find((s) => s.id === selectedId) ?? null, [shipments, selectedId]);

  const columns = useMemo<Column<Shipment>[]>(() => {
    return [
      {
        key: 'tracking',
        header: 'Suivi',
        cell: (s) => (
          <div className="space-y-1">
            <p className="text-sm font-black text-zinc-900">{s.tracking}</p>
            <p className="text-[11px] font-medium text-zinc-500">{s.orderId ? `Commande ${s.orderId}` : 'Sans commande'}</p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Client',
        cell: (s) => (
          <div className="space-y-1">
            <p className="text-sm font-bold text-zinc-900">{s.customerName}</p>
            <p className="text-[11px] font-medium text-zinc-500">{s.phone} • {s.city}</p>
          </div>
        ),
      },
      { key: 'brand', header: 'Marque', cell: (s) => <span className="text-sm font-bold text-zinc-700">{s.brand}</span> },
      { key: 'carrier', header: 'Transporteur', cell: (s) => <span className="text-sm font-bold text-zinc-700">{s.carrier}</span> },
      { key: 'status', header: 'Statut', cell: (s) => <StatusChip tone={toneForShipmentStatus(s.status)}>{s.status}</StatusChip> },
      {
        key: 'cod',
        header: 'COD',
        className: 'text-right',
        cell: (s) => <span className="text-sm font-black text-zinc-900">{formatCurrency(s.codAmount)}</span>,
      },
      {
        key: 'open',
        header: '',
        className: 'text-right',
        cell: (s) => (
          <button onClick={() => setSelectedId(s.id)} className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700">
            Ouvrir <ChevronRight className="w-4 h-4" />
          </button>
        ),
      },
    ];
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expéditions"
        subtitle="Création et gestion des expéditions multi-marques."
        right={
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Créer expédition
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
              <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
                <option>Aujourd’hui</option>
                <option>7 jours</option>
                <option>30 jours</option>
                <option>90 jours</option>
              </select>
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
              <option>Tous</option>
              <option>En préparation</option>
              <option>Expédié</option>
              <option>En livraison</option>
              <option>Livré</option>
              <option>Retourné</option>
              <option>Annulé</option>
              <option>Retard</option>
            </select>
            <select value={carrier} onChange={(e) => setCarrier(e.target.value as any)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
              <option>Tous</option>
              <option>Amana</option>
              <option>Jibli</option>
              <option>Cathedis</option>
              <option>Flash</option>
              <option>Autre</option>
            </select>
          </>
        }
        right={
          <button className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtres avancés
          </button>
        }
      />

      <DataTable
        rows={filtered}
        columns={columns}
        emptyTitle="Aucune expédition"
        emptyDescription="Créez votre première expédition ou reliez-la à une commande."
      />

      <Drawer
        open={!!selected}
        title={selected ? selected.tracking : ''}
        subtitle={selected ? `${selected.customerName} • ${selected.phone} • ${selected.city}` : undefined}
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <div className="space-y-6">
            <div className="card-muted p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Statut</p>
                  <StatusChip tone={toneForShipmentStatus(selected.status)}>{selected.status}</StatusChip>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Transporteur</p>
                  <p className="text-sm font-black text-zinc-900">{selected.carrier}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">COD</p>
                <p className="text-lg font-black text-zinc-900">{formatCurrency(selected.codAmount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => trackSession({ name: 'audit.shipment.status_advance', ts: Date.now(), meta: { shipmentId: selected.id, tracking: selected.tracking } })}
                className="py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700 transition-colors"
              >
                Avancer statut
              </button>
              <button
                onClick={() => trackSession({ name: 'audit.shipment.mark_delayed', ts: Date.now(), meta: { shipmentId: selected.id, tracking: selected.tracking } })}
                className="py-3 rounded-xl border border-amber-200 text-amber-700 font-black text-sm hover:bg-amber-50 transition-colors"
              >
                Marquer retard
              </button>
            </div>

            {selected.notes && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Notes</p>
                <div className="card-muted p-4 text-sm font-medium text-zinc-700 whitespace-pre-wrap">{selected.notes}</div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        title="Créer une expédition"
        subtitle="Génère un tracking interne TRK-… (demo)."
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setCreateOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">
              Annuler
            </button>
            <button
              onClick={() => {
                onCreate(draft);
                trackSession({ name: 'audit.shipment.create', ts: Date.now(), meta: { brand: draft.brand, carrier: draft.carrier, city: draft.city, cod: draft.codAmount } });
                setCreateOpen(false);
              }}
              className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors"
            >
              Créer
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Commande (optionnel)</label>
            <input value={draft.orderId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, orderId: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" placeholder="NX-10021" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Marque</label>
            <select value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value as any }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none">
              <option>Luxe Cosmetics</option>
              <option>Zest Home</option>
              <option>Moda Casa</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</label>
            <input value={draft.customerName} onChange={(e) => setDraft((d) => ({ ...d, customerName: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Téléphone</label>
            <input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ville</label>
            <input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Transporteur</label>
            <select value={draft.carrier} onChange={(e) => setDraft((d) => ({ ...d, carrier: e.target.value as any }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none">
              <option>Amana</option>
              <option>Jibli</option>
              <option>Cathedis</option>
              <option>Flash</option>
              <option>Autre</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">COD</label>
            <input type="number" value={draft.codAmount} onChange={(e) => setDraft((d) => ({ ...d, codAmount: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Notes</label>
            <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} rows={3} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

