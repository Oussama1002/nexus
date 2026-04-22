import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';
import type { Brand } from '../types';
import type { Order } from '../domain/orders';
import type { Product } from '../domain/products';

type BrandExt = Brand & {
  status?: 'Actif' | 'Inactif';
  code?: string;
  contact?: string;
  note?: string;
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: Parameters<typeof StatusChip>[0]['tone'] }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="text-2xl font-black text-zinc-900">{value}</p>
        <StatusChip tone={tone ?? 'neutral'} />
      </div>
    </div>
  );
}

export function BrandsScreen({
  brands,
  orders,
  products,
  activeBrandId,
  onSetActiveBrand,
  onUpsertBrand,
}: {
  brands: BrandExt[];
  orders: Order[];
  products: Product[];
  activeBrandId: string;
  onSetActiveBrand: (id: string) => void;
  onUpsertBrand: (b: BrandExt) => void;
}) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<BrandExt>({
    id: '',
    name: '',
    logo: 'BR',
    color: '#4f46e5',
    whatsappNumber: '+212 ',
    status: 'Actif',
    code: '',
    contact: '',
    note: '',
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return brands.filter((b) => {
      if (!s) return true;
      const blob = `${b.name} ${b.whatsappNumber} ${b.code ?? ''} ${b.contact ?? ''}`.toLowerCase();
      return blob.includes(s);
    });
  }, [brands, q]);

  const selected = useMemo(() => brands.find((b) => b.id === openId) ?? null, [brands, openId]);

  const statsByBrand = useMemo(() => {
    const map = new Map<string, { orders: number; ca: number; products: number }>();
    for (const b of brands) {
      const bo = orders.filter((o) => o.brand === b.name);
      const ca = bo.reduce((s, o) => s + o.total, 0);
      const bp = products.filter((p) => p.brand === (b.name as any));
      map.set(b.id, { orders: bo.length, ca, products: bp.length });
    }
    return map;
  }, [brands, orders, products]);

  const kpis = useMemo(() => {
    const active = brands.filter((b) => (b.status ?? 'Actif') === 'Actif').length;
    const wa = brands.filter((b) => Boolean(b.whatsappNumber?.trim())).length;
    const campaigns = brands.length * 2; // placeholder
    const ca = brands.reduce((s, b) => s + (statsByBrand.get(b.id)?.ca ?? 0), 0);
    return { active, wa, campaigns, ca };
  }, [brands, statsByBrand]);

  function startCreate() {
    setDraft({
      id: `b${Math.random().toString(16).slice(2, 8)}`,
      name: '',
      logo: 'BR',
      color: '#4f46e5',
      whatsappNumber: '+212 ',
      status: 'Actif',
      code: '',
      contact: '',
      note: '',
    });
    setModalOpen(true);
  }

  function startEdit(b: BrandExt) {
    setDraft({ ...b });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marques"
        subtitle="Segmentation centrale multi-marques (WhatsApp, commandes, produits, stats)."
        right={
          <button
            onClick={startCreate}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Ajouter marque
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Marques actives" value={kpis.active} tone="success" />
        <Kpi label="Numéros WhatsApp" value={kpis.wa} tone="info" />
        <Kpi label="Campagnes liées" value={kpis.campaigns} />
        <Kpi label="CA estimé" value={formatCurrency(kpis.ca)} tone="info" />
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <div className="text-xs font-black text-zinc-400 uppercase tracking-widest">
            Marque active: <span className="text-zinc-700">{brands.find((b) => b.id === activeBrandId)?.name ?? '—'}</span>
          </div>
        }
        right={
          <button
            onClick={() => {
              const b = brands.find((x) => x.id === activeBrandId);
              if (b) startEdit(b);
            }}
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
          >
            Éditer marque active
          </button>
        }
      />

      <DataTable
        rows={filtered}
        columns={[
          {
            key: 'brand',
            header: 'Marque',
            cell: (b) => (
              <button onClick={() => setOpenId(b.id)} className="flex items-center gap-3 font-black text-zinc-900 hover:underline">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] text-white" style={{ backgroundColor: b.color }}>
                  {b.logo}
                </span>
                <span className="truncate">{b.name}</span>
                {b.id === activeBrandId && <StatusChip tone="info">Active</StatusChip>}
              </button>
            ),
          },
          {
            key: 'status',
            header: 'Statut',
            cell: (b) => <StatusChip tone={(b.status ?? 'Actif') === 'Actif' ? 'success' : 'warning'}>{b.status ?? 'Actif'}</StatusChip>,
          },
          { key: 'wa', header: 'Numéros liés', cell: (b) => <span className="font-bold text-zinc-700">{b.whatsappNumber}</span> },
          { key: 'campaigns', header: 'Campagnes', cell: () => <span className="font-bold text-zinc-700">2</span> },
          { key: 'products', header: 'Produits', cell: (b) => <span className="font-bold text-zinc-700">{statsByBrand.get(b.id)?.products ?? 0}</span> },
          { key: 'orders', header: 'Commandes', cell: (b) => <span className="font-bold text-zinc-700">{statsByBrand.get(b.id)?.orders ?? 0}</span> },
          { key: 'ca', header: 'CA estimé', cell: (b) => <span className="font-black text-zinc-900">{formatCurrency(statsByBrand.get(b.id)?.ca ?? 0)}</span> },
        ]}
        emptyTitle="Aucune marque"
        emptyDescription="Ajoute ta première marque."
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setOpenId(null)}
        title={selected ? selected.name : ''}
        subtitle={selected ? `${selected.whatsappNumber} • ${(selected.status ?? 'Actif')}` : ''}
        footer={
          selected && (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => onSetActiveBrand(selected.id)}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
              >
                Définir comme active
              </button>
              <button
                onClick={() => startEdit(selected)}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
              >
                Éditer
              </button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Infos générales</p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm font-bold text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Code</span>
                  <span className="text-zinc-900">{selected.code || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Contact</span>
                  <span className="text-zinc-900">{selected.contact || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>WhatsApp</span>
                  <span className="text-zinc-900">{selected.whatsappNumber}</span>
                </div>
              </div>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Identité visuelle</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — logo, couleurs, assets.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Produits</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">{statsByBrand.get(selected.id)?.products ?? 0}</p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Commandes</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">{statsByBrand.get(selected.id)?.orders ?? 0}</p>
              </div>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Note</p>
              <p className="mt-2 text-sm font-medium text-zinc-700">{selected.note || '—'}</p>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={draft.name ? `Éditer: ${draft.name}` : 'Créer une marque'}
        subtitle="Champs prêts (backend plus tard)."
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onUpsertBrand(draft);
                setModalOpen(false);
              }}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
            >
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nom</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Code</label>
              <input
                value={draft.code ?? ''}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Statut</label>
              <select
                value={draft.status ?? 'Actif'}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
              >
                <option>Actif</option>
                <option>Inactif</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Contact</label>
              <input
                value={draft.contact ?? ''}
                onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Numéro WhatsApp lié</label>
              <input
                value={draft.whatsappNumber}
                onChange={(e) => setDraft({ ...draft, whatsappNumber: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Note</label>
              <textarea
                value={draft.note ?? ''}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

