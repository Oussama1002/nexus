import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Box, Package, Search, Warehouse } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusChip } from '../components/ui/StatusChip';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';

type ApiProductRow = {
  id: number;
  brand_id: number;
  name: string;
  sku: string;
  category: string | null;
  product_type: string | null;
  stock_quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  status: string;
};

type Filter = 'all' | 'low' | 'out' | 'in_stock';

const MOVEMENT_TYPES = ['in', 'out', 'reservation', 'release', 'adjustment', 'damaged', 'returned'] as const;
const MOVEMENT_TYPE_FR: Record<string, string> = {
  in: 'Entrée', out: 'Sortie', reservation: 'Réservation', release: 'Libération',
  adjustment: 'Ajustement', damaged: 'Endommagé', returned: 'Retour',
};

/**
 * Stocks — real inventory levels per product for the active brand.
 * Movements (history + entry form) live on the separate "Mouvements de stock"
 * screen; this one only shows current stock and offers a quick-adjust modal.
 */
export function StocksScreen() {
  const { activeBrandId } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<ApiProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const [adjustProduct, setAdjustProduct] = useState<ApiProductRow | null>(null);
  const [adjustType, setAdjustType] = useState<(typeof MOVEMENT_TYPES)[number]>('in');
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('manual_adjustment');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeBrandId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const res = await api.get<LaravelPaginator<ApiProductRow>>('products?per_page=200');
    setLoading(false);
    if (!res.ok) { toast.error(res.message); setRows([]); return; }
    setRows(isPaginator<ApiProductRow>(res.data) ? res.data.data : []);
  }, [activeBrandId, toast]);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category && r.category !== category) return false;
      const available = r.stock_quantity - r.reserved_quantity;
      if (filter === 'low' && !(r.stock_quantity > 0 && r.stock_quantity <= r.low_stock_threshold)) return false;
      if (filter === 'out' && r.stock_quantity > 0) return false;
      if (filter === 'in_stock' && available <= 0) return false;
      if (s) {
        const h = `${r.name} ${r.sku} ${r.category ?? ''}`.toLowerCase();
        if (!h.includes(s)) return false;
      }
      return true;
    });
  }, [rows, search, category, filter]);

  const stats = useMemo(() => {
    let total = 0, low = 0, out = 0, units = 0;
    for (const r of rows) {
      total++;
      units += r.stock_quantity;
      if (r.stock_quantity <= 0) out++;
      else if (r.stock_quantity <= r.low_stock_threshold) low++;
    }
    return { total, low, out, units };
  }, [rows]);

  async function submitAdjust() {
    if (!adjustProduct) return;
    setAdjustSaving(true);
    const payload: Record<string, unknown> = {
      product_id: adjustProduct.id,
      movement_type: adjustType,
      reason: adjustReason || null,
    };
    if (adjustType === 'adjustment') payload.signed_delta = Number(adjustDelta);
    else payload.quantity = Number(adjustQty);
    const res = await api.post('stock-movements', payload);
    setAdjustSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Mouvement enregistré.');
    setAdjustProduct(null);
    setAdjustQty('1'); setAdjustDelta(''); setAdjustReason('manual_adjustment'); setAdjustType('in');
    await load();
  }

  if (!activeBrandId) return <EmptyState title="Marque requise" description="Choisissez une marque active." />;
  if (!hasPermission('stock.view')) return <EmptyState title="Accès refusé" description="Permission stock.view requise." />;
  const canAdjust = hasPermission('stock.create');

  return (
    <div className="space-y-6">
      <PageHeader title="Stocks" subtitle="Niveaux de stock actuels par produit pour la marque active." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Package className="w-4 h-4" />} label="Produits" value={stats.total} tone="neutral" />
        <StatCard icon={<Warehouse className="w-4 h-4" />} label="Unités en stock" value={stats.units} tone="primary" />
        <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Stock faible" value={stats.low} tone="warning" />
        <StatCard icon={<Box className="w-4 h-4" />} label="En rupture" value={stats.out} tone="danger" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
            placeholder="Rechercher SKU ou nom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Toutes catégories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-xs font-black">
          {[
            { k: 'all', label: 'Tous' },
            { k: 'in_stock', label: 'En stock' },
            { k: 'low', label: 'Faible' },
            { k: 'out', label: 'Rupture' },
          ].map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => setFilter(o.k as Filter)}
              className={`px-3 py-2 ${filter === o.k ? 'bg-primary-600 text-white' : 'bg-white text-zinc-600'}`}
            >{o.label}</button>
          ))}
        </div>
      </div>

      {!loading && filtered.length === 0 ? (
        <EmptyState title="Aucun produit" description="Aucun produit ne correspond aux filtres." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/60">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">SKU</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Produit</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Catégorie</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Stock</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Réservé</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Disponible</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Seuil</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : filtered.map((r) => {
                const available = r.stock_quantity - r.reserved_quantity;
                const tone: Parameters<typeof StatusChip>[0]['tone'] =
                  r.stock_quantity <= 0 ? 'danger'
                    : r.stock_quantity <= r.low_stock_threshold ? 'warning'
                      : 'success';
                const label =
                  r.stock_quantity <= 0 ? 'Rupture'
                    : r.stock_quantity <= r.low_stock_threshold ? 'Faible'
                      : 'En stock';
                return (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50 align-top">
                    <td className="px-4 py-3 text-sm font-black text-zinc-700">{r.sku}</td>
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.name}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{r.category ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-right font-black">{r.stock_quantity}</td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-600">{r.reserved_quantity}</td>
                    <td className="px-4 py-3 text-sm text-right font-black">{available}</td>
                    <td className="px-4 py-3 text-sm text-right text-zinc-500">{r.low_stock_threshold}</td>
                    <td className="px-4 py-3"><StatusChip tone={tone}>{label}</StatusChip></td>
                    <td className="px-4 py-3 text-right">
                      {canAdjust ? (
                        <button
                          type="button"
                          onClick={() => { setAdjustProduct(r); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-xs font-black text-zinc-700"
                        >
                          <ArrowDownUp className="w-3.5 h-3.5" /> Ajuster
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adjustProduct && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAdjustProduct(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Mouvement de stock</p>
              <p className="text-lg font-black text-zinc-900">{adjustProduct.sku} — {adjustProduct.name}</p>
              <p className="text-xs text-zinc-500">Stock actuel : <span className="font-black">{adjustProduct.stock_quantity}</span> (dont {adjustProduct.reserved_quantity} réservés)</p>
            </div>
            <label className="block text-xs font-bold text-zinc-500">
              Type
              <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" value={adjustType} onChange={(e) => setAdjustType(e.target.value as typeof adjustType)}>
                {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_TYPE_FR[t] ?? t}</option>)}
              </select>
            </label>
            {adjustType === 'adjustment' ? (
              <label className="block text-xs font-bold text-zinc-500">
                Delta signé (+/-)
                <input type="number" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} />
              </label>
            ) : (
              <label className="block text-xs font-bold text-zinc-500">
                Quantité
                <input type="number" min={1} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
              </label>
            )}
            <label className="block text-xs font-bold text-zinc-500">
              Raison
              <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setAdjustProduct(null)} className="flex-1 py-2.5 rounded-xl border font-black text-sm">Annuler</button>
              <button type="button" disabled={adjustSaving} onClick={() => void submitAdjust()} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-black text-sm disabled:opacity-50">
                {adjustSaving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'primary' | 'neutral' | 'warning' | 'danger' }) {
  const bg = tone === 'primary' ? 'bg-primary-50 text-primary-700'
    : tone === 'warning' ? 'bg-amber-50 text-amber-700'
      : tone === 'danger' ? 'bg-rose-50 text-rose-700'
        : 'bg-zinc-100 text-zinc-600';
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${bg}`}>{icon}</span>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      </div>
      <p className="text-2xl font-black text-zinc-900 mt-2">{value}</p>
    </div>
  );
}
