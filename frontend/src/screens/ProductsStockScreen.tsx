import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Filter, ImagePlus, Pencil, Plus, Upload } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../lib/utils';
import type { Product, ProductDraft } from '../domain/products';
import { trackSession } from '../lib/session';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';
import { resolvePublicAssetUrl } from '../lib/publicAssetUrl';

type ApiProductRow = {
  id: number;
  brand_id: number;
  name: string;
  sku: string;
  category: string | null;
  product_type: string | null;
  price: string;
  cost: string;
  stock_quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  status: string;
  image?: string | null;
  description?: string | null;
  pack_items?: { product_id: number; quantity: number }[] | null;
};

type PackItemRow = { product_id: number; quantity: number };

type ApiMovementRow = {
  id: number;
  product_id: number;
  movement_type: string;
  quantity: number | null;
  reason?: string | null;
  moved_at: string;
  created_at?: string;
  product?: { name: string; sku: string };
};

function mapProduct(p: ApiProductRow, brandName: string): Product {
  return {
    apiId: p.id,
    id: String(p.id),
    name: p.name,
    sku: p.sku,
    brand: brandName,
    category: p.category ?? '',
    productType: p.product_type ?? '',
    supplier: '—',
    price: Number(p.price),
    cost: Number(p.cost),
    stock: p.stock_quantity,
    reserved: p.reserved_quantity,
    lowStockThreshold: p.low_stock_threshold,
    status: p.status === 'active' ? 'Actif' : 'Inactif',
    image: p.image ?? '',
  };
}

function toneForProductStatus(s: Product['status']): Parameters<typeof StatusChip>[0]['tone'] {
  return s === 'Actif' ? 'success' : 'neutral';
}

const MOVEMENT_TYPES = ['in', 'out', 'reservation', 'release', 'adjustment', 'damaged', 'returned'] as const;

const MOVEMENT_TYPE_FR: Record<string, string> = {
  in: 'Entrée',
  out: 'Sortie',
  reservation: 'Réservation',
  release: 'Libération',
  adjustment: 'Ajustement',
  damaged: 'Endommagé',
  returned: 'Retour',
};

const REASON_FR: Record<string, string> = {
  initial_stock_on_create: 'Stock initial',
  manual_adjustment: 'Ajustement manuel',
  order_confirmed: 'Commande confirmée',
  order_cancelled: 'Commande annulée',
  order_shipped: 'Commande expédiée',
  order_delivered: 'Commande livrée',
  order_returned: 'Retour commande',
  order_reservation: 'Réservation commande',
  reservation_released: 'Réservation libérée',
  stock_transfer: 'Transfert de stock',
  damaged_item: 'Article endommagé',
  inventory_count: 'Inventaire',
  supplier_delivery: 'Livraison fournisseur',
  customer_return: 'Retour client',
  po_received: 'Réception bon de commande',
  production: 'Production',
  lost: 'Perte',
  expired: 'Périmé',
  gift: 'Cadeau / Offert',
  sample: 'Échantillon',
  correction: 'Correction',
};

export function ProductsStockScreen({ variant }: { variant: 'products' | 'stock' }) {
  const { activeBrandId, activeBrand, brands } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [subTab, setSubTab] = useState<'products' | 'packs'>('products');
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<ApiMovementRow[]>([]);
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<'Toutes' | string>('Toutes');
  const [status, setStatus] = useState<'Tous' | Product['status']>('Tous');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string[]>([]);
  const [draft, setDraft] = useState<ProductDraft>({
    name: '',
    sku: '',
    brand: '',
    category: '',
    productType: '',
    supplier: '—',
    price: 0,
    cost: 0,
    stock: 0,
    reserved: 0,
    lowStockThreshold: 10,
    status: 'Actif',
    image: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [description, setDescription] = useState('');
  const [packItems, setPackItems] = useState<PackItemRow[]>([]);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Product categories & types from settings
  const [productOptions, setProductOptions] = useState<{ categories: string[]; types: string[] }>({ categories: [], types: [] });

  useEffect(() => {
    if (!activeBrandId) return;
    void api.get<{ categories: string[]; types: string[] }>('settings/product-options').then((res) => {
      if (res.ok && res.data) setProductOptions(res.data);
    });
  }, [activeBrandId]);

  const [movForm, setMovForm] = useState({
    product_id: '',
    movement_type: 'in' as (typeof MOVEMENT_TYPES)[number],
    quantity: '1',
    signed_delta: '',
    reason: '',
  });

  const brandNames = useMemo(() => ['Toutes', ...brands.map((b) => b.name)], [brands]);

  const loadProducts = useCallback(async (withSpinner = true) => {
    if (!activeBrandId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    if (withSpinner) setLoading(true);
    const res = await api.get<LaravelPaginator<ApiProductRow>>('products?per_page=100');
    if (withSpinner) setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setProducts([]);
      return;
    }
    const page = res.data;
    const rows = isPaginator<ApiProductRow>(page) ? page.data : [];
    const nameById: Record<string, string> = {};
    for (const b of brands) nameById[b.id] = b.name;
    setProducts(rows.map((r) => mapProduct(r, nameById[String(r.brand_id)] ?? activeBrand.name)));
  }, [activeBrandId, activeBrand.name, brands, toast]);

  const loadMovements = useCallback(async () => {
    if (!activeBrandId) {
      setMovements([]);
      return;
    }
    const res = await api.get<LaravelPaginator<ApiMovementRow>>('stock-movements?per_page=100');
    if (!res.ok) {
      toast.error(res.message);
      setMovements([]);
      return;
    }
    setMovements(isPaginator<ApiMovementRow>(res.data) ? res.data.data : []);
  }, [activeBrandId, toast]);

  useEffect(() => {
    if (variant === 'products') void loadProducts(true);
    else {
      void loadProducts(false);
      void loadMovements();
    }
  }, [variant, loadProducts, loadMovements]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return products.filter((p) => {
      const cat = p.category.toLowerCase().trim();
      const isPackProduct = cat === 'packs' || cat === 'pack';
      if (subTab === 'packs' && !isPackProduct) return false;
      if (subTab === 'products' && isPackProduct) return false;
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
  }, [products, q, brand, status, onlyLowStock, subTab]);

  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const low = filtered.filter((p) => p.stock <= p.lowStockThreshold).length;
    const stockValue = filtered.reduce((s, p) => s + p.stock * p.cost, 0);
    return { total, low, stockValue };
  }, [filtered]);

  function openEditModal(p: Product) {
    setFormErr([]);
    setDraft({
      name: p.name,
      sku: p.sku,
      brand: p.brand,
      category: p.category,
      productType: p.productType,
      supplier: p.supplier,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      reserved: p.reserved,
      lowStockThreshold: p.lowStockThreshold,
      status: p.status,
      image: p.image,
    });
    setDescription('');
    setImageFile(null);
    setImagePreview(p.image ? resolvePublicAssetUrl(p.image) : '');
    setPackItems([]);
    setSelectedId(p.id);
    setEditOpen(true);
    void api.get<ApiProductRow>(`products/${p.apiId}`).then((res) => {
      if (res.ok && res.data) {
        if (res.data.description) setDescription(res.data.description);
        if (Array.isArray(res.data.pack_items)) setPackItems(res.data.pack_items);
      }
    });
  }

  const isPack = draft.category.toLowerCase().trim() === 'packs' || draft.category.toLowerCase().trim() === 'pack';
  const canEdit = hasPermission('products.update');

  const columns = useMemo<Column<Product>[]>(() => {
    const cols: Column<Product>[] = [
      {
        key: 'name',
        header: 'Produit',
        cell: (p) => (
          <div className="flex items-center gap-3">
            {p.image ? (
              <img
                src={resolvePublicAssetUrl(p.image)}
                alt={p.name}
                className="w-10 h-10 rounded-lg object-cover border border-zinc-200 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                <ImagePlus className="w-4 h-4 text-zinc-400" />
              </div>
            )}
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-black text-zinc-900 truncate">{p.name}</p>
              <p className="text-[11px] font-medium text-zinc-500">SKU {p.sku}</p>
            </div>
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
            <p className="text-sm font-black text-zinc-900">
              {p.stock} u <span className="text-zinc-500 font-bold">(rés. {p.reserved})</span>
            </p>
            {p.stock <= p.lowStockThreshold && <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">Alerte</p>}
          </div>
        ),
      },
      { key: 'cost', header: 'Coût', className: 'text-right', cell: (p) => <span className="text-sm font-black text-zinc-900">{formatCurrency(p.cost)}</span> },
      { key: 'price', header: 'Prix', className: 'text-right', cell: (p) => <span className="text-sm font-black text-zinc-900">{formatCurrency(p.price)}</span> },
    ];

    if (canEdit) {
      cols.push({
        key: 'edit',
        header: '',
        cell: (p) => (
          <button
            type="button"
            onClick={() => openEditModal(p)}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500"
            title="Modifier"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        ),
      });
    }

    cols.push({
      key: 'open',
      header: '',
      className: 'text-right',
      cell: (p) => (
        <button type="button" onClick={() => setSelectedId(p.id)} className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700">
          Ouvrir <ChevronRight className="w-4 h-4" />
        </button>
      ),
    });

    return cols;
  }, [canEdit]);

  async function saveProduct() {
    setSaving(true);
    setFormErr([]);
    const fd = new FormData();
    fd.append('name', draft.name.trim());
    fd.append('category', draft.category.trim());
    fd.append('product_type', draft.productType.trim());
    fd.append('price', String(draft.price));
    fd.append('cost', String(draft.cost));
    fd.append('low_stock_threshold', String(draft.lowStockThreshold));
    fd.append('status', 'active');
    fd.append('stock_quantity', String(draft.stock));
    if (description.trim()) fd.append('description', description.trim());
    if (imageFile) fd.append('image', imageFile);
    if (isPack && packItems.length > 0) fd.append('pack_items', JSON.stringify(packItems));
    const res = await api.post('products', fd);
    setSaving(false);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      setFormErr(fe.length ? fe : [res.message]);
      toast.error(res.message);
      return;
    }
    toast.success('Produit créé.');
    // Auto-save new category/type to settings if not already there
    const cat = draft.category.trim();
    const typ = draft.productType.trim();
    if (cat && !productOptions.categories.includes(cat)) {
      void api.post('settings/quick-add-list-item', { list: 'product_categories', value: cat });
      setProductOptions((p) => ({ ...p, categories: [...p.categories, cat] }));
    }
    if (typ && !productOptions.types.includes(typ)) {
      void api.post('settings/quick-add-list-item', { list: 'product_types', value: typ });
      setProductOptions((p) => ({ ...p, types: [...p.types, typ] }));
    }
    setCreateOpen(false);
    await loadProducts();
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    setFormErr([]);
    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('name', draft.name.trim());
    fd.append('sku', draft.sku.trim());
    fd.append('category', draft.category.trim());
    fd.append('product_type', draft.productType.trim());
    fd.append('price', String(draft.price));
    fd.append('cost', String(draft.cost));
    fd.append('low_stock_threshold', String(draft.lowStockThreshold));
    fd.append('status', draft.status === 'Actif' ? 'active' : 'inactive');
    if (description.trim()) fd.append('description', description.trim());
    if (imageFile) fd.append('image', imageFile);
    fd.append('pack_items', isPack && packItems.length > 0 ? JSON.stringify(packItems) : 'null');
    const res = await api.post(`products/${selected.apiId}`, fd);
    setSaving(false);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      setFormErr(fe.length ? fe : [res.message]);
      toast.error(res.message);
      return;
    }
    toast.success('Produit mis à jour.');
    const cat = draft.category.trim();
    const typ = draft.productType.trim();
    if (cat && !productOptions.categories.includes(cat)) {
      void api.post('settings/quick-add-list-item', { list: 'product_categories', value: cat });
      setProductOptions((p) => ({ ...p, categories: [...p.categories, cat] }));
    }
    if (typ && !productOptions.types.includes(typ)) {
      void api.post('settings/quick-add-list-item', { list: 'product_types', value: typ });
      setProductOptions((p) => ({ ...p, types: [...p.types, typ] }));
    }
    setEditOpen(false);
    setSelectedId(null);
    await loadProducts();
  }

  async function saveMovement() {
    setSaving(true);
    const payload: Record<string, unknown> = {
      product_id: Number(movForm.product_id),
      movement_type: movForm.movement_type,
      reason: movForm.reason.trim() || null,
    };
    if (movForm.movement_type === 'adjustment') {
      payload.signed_delta = Number(movForm.signed_delta);
    } else {
      payload.quantity = Number(movForm.quantity);
    }
    const res = await api.post('stock-movements', payload);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Mouvement enregistré.');
    await loadMovements();
    await loadProducts();
  }

  if (!activeBrandId) {
    return <EmptyState title="Marque requise" description="Choisissez une marque active." />;
  }

  if (variant === 'stock' && !hasPermission('stock.view')) {
    return <EmptyState title="Accès refusé" description="Permission stock.view requise." />;
  }
  if (variant === 'products' && !hasPermission('products.view')) {
    return <EmptyState title="Accès refusé" description="Permission products.view requise." />;
  }

  if (variant === 'stock') {
    return (
      <div className="space-y-6">
        <PageHeader title="Mouvements de stock" subtitle="Historique immuable + saisie de mouvements (API)." />
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <select
            value={movForm.product_id}
            onChange={(e) => setMovForm((m) => ({ ...m, product_id: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-zinc-200 font-bold text-sm"
          >
            <option value="">Produit…</option>
            {products.map((p) => (
              <option key={p.id} value={p.apiId}>
                {p.sku} — {p.name}
              </option>
            ))}
          </select>
          <select
            value={movForm.movement_type}
            onChange={(e) => setMovForm((m) => ({ ...m, movement_type: e.target.value as (typeof MOVEMENT_TYPES)[number] }))}
            className="px-3 py-2 rounded-xl border border-zinc-200 font-bold text-sm"
          >
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_TYPE_FR[t] ?? t}
              </option>
            ))}
          </select>
          {movForm.movement_type === 'adjustment' ? (
            <input
              placeholder="Delta signé"
              value={movForm.signed_delta}
              onChange={(e) => setMovForm((m) => ({ ...m, signed_delta: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-zinc-200 font-bold text-sm"
            />
          ) : (
            <input
              placeholder="Quantité"
              value={movForm.quantity}
              onChange={(e) => setMovForm((m) => ({ ...m, quantity: e.target.value }))}
              className="px-3 py-2 rounded-xl border border-zinc-200 font-bold text-sm"
            />
          )}
          <select
            value={movForm.reason}
            onChange={(e) => setMovForm((m) => ({ ...m, reason: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-zinc-200 font-bold text-sm md:col-span-2"
          >
            <option value="">— Raison —</option>
            {Object.entries(REASON_FR).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {hasPermission('stock.create') ? (
            <button
              type="button"
              disabled={saving || !movForm.product_id}
              onClick={() => void saveMovement()}
              className="py-2 rounded-xl bg-primary-600 text-white font-black text-sm disabled:opacity-50"
            >
              Enregistrer
            </button>
          ) : null}
        </div>
        <DataTable<ApiMovementRow>
          rows={movements}
          columns={
            [
              {
                key: 't',
                header: 'Date',
                cell: (m: ApiMovementRow) => (
                  <span className="font-bold text-zinc-700 text-sm">
                    {new Date(m.moved_at || m.created_at || Date.now()).toLocaleString()}
                  </span>
                ),
              },
              {
                key: 'p',
                header: 'Produit',
                cell: (m: ApiMovementRow) => <span className="font-bold text-zinc-800">{m.product?.name ?? m.product_id}</span>,
              },
              {
                key: 'type',
                header: 'Type',
                cell: (m: ApiMovementRow) => <StatusChip tone="neutral">{MOVEMENT_TYPE_FR[m.movement_type] ?? m.movement_type}</StatusChip>,
              },
              { key: 'q', header: 'Qté', cell: (m: ApiMovementRow) => <span className="font-black">{m.quantity ?? '—'}</span> },
              { key: 'r', header: 'Raison', cell: (m: ApiMovementRow) => <span className="text-sm text-zinc-600">{m.reason ? (REASON_FR[m.reason] ?? m.reason) : '—'}</span> },
            ] satisfies Column<ApiMovementRow>[]
          }
          emptyTitle="Aucun mouvement"
          emptyDescription="Créez un mouvement ou changez de marque."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produits & Stock"
        subtitle={"Catalogue connecté à l'API (stock via mouvements)."}
        right={
          hasPermission('products.create') ? (
            <button
              type="button"
              onClick={() => {
                setFormErr([]);
                setDraft({
                  name: '',
                  sku: '',
                  brand: activeBrand.name,
                  category: subTab === 'packs' ? 'Packs' : '',
                  productType: '',
                  supplier: '—',
                  price: 0,
                  cost: 0,
                  stock: 0,
                  reserved: 0,
                  lowStockThreshold: 10,
                  status: 'Actif',
                  image: '',
                });
                setImageFile(null);
                setImagePreview('');
                setDescription('');
                setPackItems([]);
                setCreateOpen(true);
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {subTab === 'packs' ? 'Créer un pack' : 'Ajouter produit'}
            </button>
          ) : null
        }
      />

      <div className="flex gap-1 border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setSubTab('products')}
          className={`px-4 py-2 text-sm font-black border-b-2 transition-colors ${subTab === 'products' ? 'border-primary-600 text-primary-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Produits
        </button>
        <button
          type="button"
          onClick={() => setSubTab('packs')}
          className={`px-4 py-2 text-sm font-black border-b-2 transition-colors ${subTab === 'packs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
        >
          Packs
        </button>
      </div>

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
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
              {brandNames.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
              <option>Tous</option>
              <option>Actif</option>
              <option>Inactif</option>
            </select>
            <button
              type="button"
              onClick={() => setOnlyLowStock((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-sm font-black ${onlyLowStock ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}
            >
              Low stock
            </button>
          </>
        }
        right={
          <button type="button" className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2">
            <Filter className="w-4 h-4" /> Filtres avancés
          </button>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : (
        <DataTable<Product>
          rows={filtered}
          columns={columns}
          emptyTitle={subTab === 'packs' ? 'Aucun pack' : 'Aucun produit'}
          emptyDescription={subTab === 'packs' ? 'Créez un pack en cliquant sur « Créer un pack ».' : 'Ajoutez des produits pour démarrer le suivi stock.'}
        />
      )}

      <Drawer
        open={!!selected}
        title={selected ? selected.name : ''}
        subtitle={selected ? `SKU ${selected.sku} • ${selected.brand}` : undefined}
        onClose={() => setSelectedId(null)}
        footer={
          selected && hasPermission('products.update') ? (
            <button
              type="button"
              onClick={() => openEditModal(selected)}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-black text-sm"
            >
              Éditer
            </button>
          ) : undefined
        }
      >
        {selected && (
          <div className="space-y-6">
            {selected.image && (
              <img
                src={resolvePublicAssetUrl(selected.image)}
                alt={selected.name}
                className="w-full h-48 object-contain rounded-xl border border-zinc-200 bg-zinc-50"
              />
            )}
            <div className="card-muted p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</p>
                <StatusChip tone={toneForProductStatus(selected.status)}>{selected.status}</StatusChip>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stock dispo</p>
                  <p className="mt-1 text-xl font-black text-zinc-900">{selected.stock} u</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Réservé</p>
                  <p className="mt-1 text-xl font-black text-zinc-900">{selected.reserved}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-500 font-medium">Les ajustements de quantité se font via l'écran Stocks (mouvements).</p>
          </div>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        title="Ajouter un produit"
        subtitle="Le SKU est généré automatiquement. Le statut est actif par défaut."
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">
              Annuler
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                void saveProduct();
                trackSession({ name: 'audit.product.create', ts: Date.now(), meta: { sku: draft.sku, stock: draft.stock } });
              }}
              className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              Ajouter
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formErr.length > 0 && (
            <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 space-y-1">
              {formErr.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom *</label>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" placeholder="Nom du produit" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Image du produit</label>
            <div className="flex items-center gap-4">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="w-20 h-20 rounded-xl object-cover border border-zinc-200" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-zinc-100 border border-dashed border-zinc-300 flex items-center justify-center">
                  <ImagePlus className="w-6 h-6 text-zinc-400" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                >
                  <Upload className="w-4 h-4" />
                  {imagePreview ? 'Changer' : 'Choisir une image'}
                </button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(''); }}
                    className="text-xs font-bold text-rose-600 hover:underline text-left"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Description du produit (optionnel)"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Marque *</label>
            <input value={draft.brand} disabled className="w-full px-4 py-3 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-500 font-bold outline-none cursor-not-allowed" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Catégorie *</label>
            <input
              list="product-categories-list"
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Choisir ou saisir une catégorie…"
            />
            <datalist id="product-categories-list">
              {productOptions.categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          {isPack && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Produits du pack</label>
              {packItems.map((pi, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={pi.product_id || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPackItems((prev) => prev.map((item, i) => i === idx ? { ...item, product_id: val } : item));
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold"
                  >
                    <option value="">— Choisir un produit —</option>
                    {products.filter((p) => p.category.toLowerCase() !== 'packs' && p.category.toLowerCase() !== 'pack').map((p) => (
                      <option key={p.apiId} value={p.apiId}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={pi.quantity}
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value));
                      setPackItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: val } : item));
                    }}
                    className="w-20 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-center"
                    placeholder="Qté"
                  />
                  <button type="button" onClick={() => setPackItems((prev) => prev.filter((_, i) => i !== idx))} className="text-rose-500 font-black text-lg px-2">×</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPackItems((prev) => [...prev, { product_id: 0, quantity: 1 }])}
                className="inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:underline"
              >
                <Plus className="w-4 h-4" /> Ajouter un produit au pack
              </button>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Type produit *</label>
            <input
              list="product-types-list"
              value={draft.productType}
              onChange={(e) => setDraft((d) => ({ ...d, productType: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Choisir ou saisir un type…"
            />
            <datalist id="product-types-list">
              {productOptions.types.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Stock initial</label>
            <input type="number" value={draft.stock} onChange={(e) => setDraft((d) => ({ ...d, stock: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" placeholder="0" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Coût d'achat</label>
            <input type="number" value={draft.cost} onChange={(e) => setDraft((d) => ({ ...d, cost: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Prix de vente *</label>
            <input type="number" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Seuil d'alerte</label>
            <input type="number" value={draft.lowStockThreshold} onChange={(e) => setDraft((d) => ({ ...d, lowStockThreshold: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" placeholder="10" />
          </div>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        title="Modifier produit"
        subtitle="Champs métier (pas de stock direct)."
        onClose={() => setEditOpen(false)}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setEditOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">
              Annuler
            </button>
            <button type="button" disabled={saving} onClick={() => void saveEdit()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm disabled:opacity-50">
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formErr.length > 0 && (
            <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 space-y-1">
              {formErr.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nom</label>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Image du produit</label>
            <div className="flex items-center gap-4">
              {imagePreview ? (
                <img src={imagePreview} alt="" className="w-20 h-20 rounded-xl object-cover border border-zinc-200" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-zinc-100 border border-dashed border-zinc-300 flex items-center justify-center">
                  <ImagePlus className="w-6 h-6 text-zinc-400" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  id="edit-product-img"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      setImagePreview(URL.createObjectURL(file));
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('edit-product-img')?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                >
                  <Upload className="w-4 h-4" />
                  {imagePreview ? 'Changer' : 'Choisir une image'}
                </button>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(''); }}
                    className="text-xs font-bold text-rose-600 hover:underline text-left"
                  >
                    Retirer
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              placeholder="Description du produit (optionnel)"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">SKU</label>
            <input value={draft.sku} onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Catégorie</label>
            <input
              list="product-categories-list-edit"
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Choisir ou saisir…"
            />
            <datalist id="product-categories-list-edit">
              {productOptions.categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          {isPack && (
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Produits du pack</label>
              {packItems.map((pi, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={pi.product_id || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPackItems((prev) => prev.map((item, i) => i === idx ? { ...item, product_id: val } : item));
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold"
                  >
                    <option value="">— Choisir un produit —</option>
                    {products.filter((p) => p.category.toLowerCase() !== 'packs' && p.category.toLowerCase() !== 'pack').map((p) => (
                      <option key={p.apiId} value={p.apiId}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={pi.quantity}
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value));
                      setPackItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: val } : item));
                    }}
                    className="w-20 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-center"
                    placeholder="Qté"
                  />
                  <button type="button" onClick={() => setPackItems((prev) => prev.filter((_, i) => i !== idx))} className="text-rose-500 font-black text-lg px-2">×</button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPackItems((prev) => [...prev, { product_id: 0, quantity: 1 }])}
                className="inline-flex items-center gap-1 text-sm font-bold text-primary-600 hover:underline"
              >
                <Plus className="w-4 h-4" /> Ajouter un produit au pack
              </button>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Type produit</label>
            <input
              list="product-types-list-edit"
              value={draft.productType}
              onChange={(e) => setDraft((d) => ({ ...d, productType: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Choisir ou saisir…"
            />
            <datalist id="product-types-list-edit">
              {productOptions.types.map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Coût d'achat</label>
            <input type="number" value={draft.cost} onChange={(e) => setDraft((d) => ({ ...d, cost: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Prix de vente</label>
            <input type="number" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Seuil d'alerte</label>
            <input type="number" value={draft.lowStockThreshold} onChange={(e) => setDraft((d) => ({ ...d, lowStockThreshold: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</label>
            <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as ProductDraft['status'] }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none">
              <option>Actif</option>
              <option>Inactif</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
