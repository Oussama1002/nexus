import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';

type ProductLite = { id: number; sku: string; name: string; stock_quantity: number };

const MOVEMENT_TYPES = ['in', 'out', 'reservation', 'release', 'adjustment', 'damaged', 'returned'] as const;
const MOVEMENT_TYPE_FR_FULL: Record<string, string> = {
  in: 'Entrée', out: 'Sortie', reservation: 'Réservation', release: 'Libération',
  adjustment: 'Ajustement', damaged: 'Endommagé', returned: 'Retour',
};

type StockMovement = {
  id: number;
  type: string;
  product_name: string;
  quantity: number;
  warehouse: string;
  reference: string | null;
  user_name: string;
  created_at: string;
};

const TYPE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'in', label: 'Entrée' },
  { value: 'out', label: 'Sortie' },
  { value: 'transfer', label: 'Transfert' },
  { value: 'adjustment', label: 'Ajustement' },
];

const TYPE_COLORS: Record<string, string> = {
  in: 'bg-green-50 text-green-700',
  out: 'bg-red-50 text-red-700',
  transfer: 'bg-blue-50 text-blue-700',
  adjustment: 'bg-orange-50 text-orange-700',
};

const TYPE_LABELS: Record<string, string> = {
  in: 'Entrée',
  out: 'Sortie',
  transfer: 'Transfert',
  adjustment: 'Ajustement',
};

export function StockMovementsScreen() {
  const { activeBrandId } = useBrand();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('stock.create');
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const [products, setProducts] = useState<ProductLite[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    product_id: '',
    movement_type: 'in' as (typeof MOVEMENT_TYPES)[number],
    quantity: '1',
    signed_delta: '',
    reason: 'manual_adjustment',
  });
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!activeBrandId) { setProducts([]); return; }
    const res = await api.get<LaravelPaginator<ProductLite>>('products?per_page=200');
    if (res.ok && isPaginator<ProductLite>(res.data)) setProducts(res.data.data);
  }, [activeBrandId]);
  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const productLabel = useMemo(() => {
    const p = products.find((p) => String(p.id) === form.product_id);
    return p ? `${p.sku} — ${p.name} (stock ${p.stock_quantity})` : '';
  }, [products, form.product_id]);

  async function submitCreate() {
    if (!form.product_id) { toast.error('Sélectionnez un produit.'); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      product_id: Number(form.product_id),
      movement_type: form.movement_type,
      reason: form.reason.trim() || null,
    };
    if (form.movement_type === 'adjustment') payload.signed_delta = Number(form.signed_delta);
    else payload.quantity = Number(form.quantity);
    const res = await api.post('stock-movements', payload);
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Mouvement enregistré.');
    setCreateOpen(false);
    setForm({ product_id: '', movement_type: 'in', quantity: '1', signed_delta: '', reason: 'manual_adjustment' });
    setRefreshTick((t) => t + 1);
    void loadProducts();
  }

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<StockMovement>>(
          'stock-movements' + buildQuery({ per_page: 25, page, search: search || undefined, type: typeFilter || undefined })
        );
        if (cancelled) return;
        if (res.ok) {
          setRows(res.data.data);
          setTotal(res.data.total);
          setLastPage(res.data.last_page);
        } else {
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [page, search, typeFilter, activeBrandId, refreshTick]);

  const inCount = rows.filter(r => r.type === 'in').length;
  const outCount = rows.filter(r => r.type === 'out').length;
  const transferCount = rows.filter(r => r.type === 'transfer').length;
  const adjustmentCount = rows.filter(r => r.type === 'adjustment').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Mouvements de stock"
        subtitle="Historique des entrées, sorties, transferts et ajustements."
      >
        {canCreate && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black"
          >
            <Plus className="w-4 h-4" /> Nouveau mouvement
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Entrées</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{inCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Sorties</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{outCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Transferts</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{transferCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ajustements</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{adjustmentCount}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
            placeholder="Rechercher…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState title="Aucun mouvement" description="Aucun mouvement de stock trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">ID</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Produit</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Quantité</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Entrepôt</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Référence</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Utilisateur</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm font-medium">#{row.id}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLORS[row.type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {TYPE_LABELS[row.type] ?? row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{row.product_name}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    <span className={row.type === 'in' ? 'text-green-600' : row.type === 'out' ? 'text-red-600' : ''}>
                      {row.type === 'in' ? '+' : row.type === 'out' ? '-' : ''}{row.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{row.warehouse}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.reference ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.user_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(row.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">Page {page} sur {lastPage} — {total} résultat(s)</p>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary p-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-secondary p-2" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCreateOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nouveau mouvement</p>
              <p className="text-lg font-black text-zinc-900">Enregistrer un mouvement de stock</p>
            </div>
            <label className="block text-xs font-bold text-zinc-500">
              Produit
              <select
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
                value={form.product_id}
                onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))}
              >
                <option value="">— Sélectionner —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name} (stock {p.stock_quantity})</option>
                ))}
              </select>
              {productLabel && <p className="mt-1 text-[11px] text-zinc-500">{productLabel}</p>}
            </label>
            <label className="block text-xs font-bold text-zinc-500">
              Type
              <select
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
                value={form.movement_type}
                onChange={(e) => setForm((f) => ({ ...f, movement_type: e.target.value as typeof f.movement_type }))}
              >
                {MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_TYPE_FR_FULL[t] ?? t}</option>)}
              </select>
            </label>
            {form.movement_type === 'adjustment' ? (
              <label className="block text-xs font-bold text-zinc-500">
                Delta signé (+/-)
                <input type="number" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" value={form.signed_delta} onChange={(e) => setForm((f) => ({ ...f, signed_delta: e.target.value }))} />
              </label>
            ) : (
              <label className="block text-xs font-bold text-zinc-500">
                Quantité
                <input type="number" min={1} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              </label>
            )}
            <label className="block text-xs font-bold text-zinc-500">
              Raison
              <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-2.5 rounded-xl border font-black text-sm">Annuler</button>
              <button type="button" disabled={saving || !form.product_id} onClick={() => void submitCreate()} className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-black text-sm disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
