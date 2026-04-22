import React, { useMemo, useState } from 'react';
import { ChevronRight, Filter, Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';
import type { Product, ProductDraft } from '../domain/products';
import { trackSession } from '../lib/session';

function toneForProductStatus(s: Product['status']): Parameters<typeof StatusChip>[0]['tone'] {
  return s === 'Actif' ? 'success' : 'neutral';
}

export function ProductsStockScreen({
  products,
  onCreate,
  onUpdate,
}: {
  products: Product[];
  onCreate: (draft: ProductDraft) => void;
  onUpdate: (id: string, patch: Partial<ProductDraft>) => void;
}) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<'Toutes' | Product['brand']>('Toutes');
  const [status, setStatus] = useState<'Tous' | Product['status']>('Tous');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>({
    name: '',
    sku: '',
    brand: 'Luxe Cosmetics',
    supplier: 'Atlas Packaging',
    price: 0,
    cost: 0,
    stock: 0,
    lowStockThreshold: 10,
    status: 'Actif',
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQ =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.supplier.toLowerCase().includes(query);
      const matchesBrand = brand === 'Toutes' ? true : p.brand === brand;
      const matchesStatus = status === 'Tous' ? true : p.status === status;
      const matchesLow = onlyLowStock ? p.stock <= p.lowStockThreshold : true;
      return matchesQ && matchesBrand && matchesStatus && matchesLow;
    });
  }, [products, q, brand, status, onlyLowStock]);

  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);

  const kpis = useMemo(() => {
    const total = products.length;
    const low = products.filter((p) => p.stock <= p.lowStockThreshold).length;
    const stockValue = products.reduce((s, p) => s + p.stock * p.cost, 0);
    return { total, low, stockValue };
  }, [products]);

  const columns = useMemo<Column<Product>[]>(() => {
    return [
      {
        key: 'name',
        header: 'Produit',
        cell: (p) => (
          <div className="space-y-1">
            <p className="text-sm font-black text-zinc-900">{p.name}</p>
            <p className="text-[11px] font-medium text-zinc-500">SKU {p.sku} • {p.supplier}</p>
          </div>
        ),
      },
      { key: 'brand', header: 'Marque', cell: (p) => <span className="text-sm font-bold text-zinc-700">{p.brand}</span> },
      { key: 'status', header: 'Statut', cell: (p) => <StatusChip tone={toneForProductStatus(p.status)}>{p.status}</StatusChip> },
      {
        key: 'stock',
        header: 'Stock',
        cell: (p) => (
          <div className="space-y-1">
            <p className="text-sm font-black text-zinc-900">{p.stock} u</p>
            {p.stock <= p.lowStockThreshold && <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Alerte</p>}
          </div>
        ),
      },
      { key: 'cost', header: 'Coût', className: 'text-right', cell: (p) => <span className="text-sm font-black text-zinc-900">{formatCurrency(p.cost)}</span> },
      { key: 'price', header: 'Prix', className: 'text-right', cell: (p) => <span className="text-sm font-black text-zinc-900">{formatCurrency(p.price)}</span> },
      {
        key: 'open',
        header: '',
        className: 'text-right',
        cell: (p) => (
          <button onClick={() => setSelectedId(p.id)} className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700">
            Ouvrir <ChevronRight className="w-4 h-4" />
          </button>
        ),
      },
    ];
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produits & Stock"
        subtitle="Catalogue produits + stock actuel + alertes."
        right={
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Ajouter produit
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Produits</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{kpis.total}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Alertes stock</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{kpis.low}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Valeur (coût)</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(kpis.stockValue)}</p>
        </div>
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <>
            <select value={brand} onChange={(e) => setBrand(e.target.value as any)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
              <option>Toutes</option>
              <option>Luxe Cosmetics</option>
              <option>Zest Home</option>
              <option>Moda Casa</option>
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
              <option>Tous</option>
              <option>Actif</option>
              <option>Inactif</option>
            </select>
            <button
              onClick={() => setOnlyLowStock((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-sm font-black ${onlyLowStock ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
            >
              Low stock
            </button>
          </>
        }
        right={
          <button className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtres avancés
          </button>
        }
      />

      <DataTable rows={filtered} columns={columns} emptyTitle="Aucun produit" emptyDescription="Ajoutez des produits pour démarrer le suivi stock." />

      <Drawer
        open={!!selected}
        title={selected ? selected.name : ''}
        subtitle={selected ? `SKU ${selected.sku} • ${selected.brand}` : undefined}
        onClose={() => setSelectedId(null)}
      >
        {selected && (
          <div className="space-y-6">
            <div className="card-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</p>
                <StatusChip tone={toneForProductStatus(selected.status)}>{selected.status}</StatusChip>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stock</p>
                  <p className="mt-1 text-xl font-black text-zinc-900">{selected.stock} u</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Seuil</p>
                  <p className="mt-1 text-xl font-black text-zinc-900">{selected.lowStockThreshold}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onUpdate(selected.id, { status: selected.status === 'Actif' ? 'Inactif' : 'Actif' });
                  trackSession({ name: 'audit.product.status_toggle', ts: Date.now(), meta: { productId: selected.id, to: selected.status === 'Actif' ? 'Inactif' : 'Actif' } });
                }}
                className="py-3 rounded-xl border border-zinc-200 text-zinc-700 font-black text-sm hover:bg-zinc-50 transition-colors"
              >
                Basculer statut
              </button>
              <button
                onClick={() => {
                  onUpdate(selected.id, { stock: selected.stock + 1 });
                  trackSession({ name: 'audit.stock.adjust', ts: Date.now(), meta: { productId: selected.id, delta: +1 } });
                }}
                className="py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700 transition-colors"
              >
                +1 Stock
              </button>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        title="Ajouter un produit"
        subtitle="Catalogue + stock (demo)."
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setCreateOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">
              Annuler
            </button>
            <button
              onClick={() => {
                onCreate(draft);
                trackSession({ name: 'audit.product.create', ts: Date.now(), meta: { brand: draft.brand, sku: draft.sku, stock: draft.stock } });
                setCreateOpen(false);
              }}
              className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors"
            >
              Ajouter
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom</label>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">SKU</label>
            <input value={draft.sku} onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
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
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fournisseur</label>
            <input value={draft.supplier} onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Coût</label>
            <input type="number" value={draft.cost} onChange={(e) => setDraft((d) => ({ ...d, cost: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Prix</label>
            <input type="number" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stock</label>
            <input type="number" value={draft.stock} onChange={(e) => setDraft((d) => ({ ...d, stock: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Seuil</label>
            <input type="number" value={draft.lowStockThreshold} onChange={(e) => setDraft((d) => ({ ...d, lowStockThreshold: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</label>
            <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as any }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none">
              <option>Actif</option>
              <option>Inactif</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

