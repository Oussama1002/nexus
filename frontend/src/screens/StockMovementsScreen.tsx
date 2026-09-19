import React, { useEffect, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useBrand } from '../context/BrandContext';

const MOVEMENT_TYPES = ['in', 'out', 'reservation', 'release', 'adjustment', 'damaged', 'returned'] as const;
const MOVEMENT_TYPE_FR_FULL: Record<string, string> = {
  in: 'Entrée', out: 'Sortie', reservation: 'Réservation', release: 'Libération',
  adjustment: 'Ajustement', damaged: 'Endommagé', returned: 'Retour',
};

type StockMovement = {
  id: number;
  movement_type: string;
  product?: { name: string } | null;
  actor?: { name: string } | null;
  quantity: number;
  previous_stock: number | null;
  new_stock: number | null;
  reason: string | null;
  reference_type: string | null;
  reference_id: number | null;
  moved_at: string | null;
  created_at: string;
};

const TYPE_OPTIONS = [{ value: '', label: 'Tous' }, ...MOVEMENT_TYPES.map((t) => ({ value: t, label: MOVEMENT_TYPE_FR_FULL[t] }))];

const TYPE_COLORS: Record<string, string> = {
  in: 'bg-green-50 text-green-700',
  out: 'bg-red-50 text-red-700',
  returned: 'bg-blue-50 text-blue-700',
  adjustment: 'bg-orange-50 text-orange-700',
  damaged: 'bg-rose-50 text-rose-700',
};

const REFERENCE_FR: Record<string, string> = { order: 'Commande', purchase_order: 'Achat', shipment: 'Colis' };

function signedQty(r: StockMovement): string {
  const delta = r.previous_stock != null && r.new_stock != null ? r.new_stock - r.previous_stock : null;
  if (delta == null || delta === 0) return String(r.quantity);
  return delta > 0 ? `+${delta}` : String(delta);
}

export function StockMovementsScreen() {
  const { activeBrandId } = useBrand();
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<StockMovement> & { counts?: Record<string, number> }>(
          'stock-movements' + buildQuery({ per_page: 25, page, search: search || undefined, type: typeFilter || undefined })
        );
        if (cancelled) return;
        if (res.ok) {
          setRows(res.data.data);
          setCounts(res.data.counts ?? {});
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
  }, [page, search, typeFilter, activeBrandId]);

  const inCount = Number(counts.in ?? 0);
  const outCount = Number(counts.out ?? 0);
  const returnedCount = Number(counts.returned ?? 0);
  const adjustmentCount = Number(counts.adjustment ?? 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Mouvements de stock"
        subtitle="Historique des entrées, sorties, retours et ajustements."
      />

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
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Retours</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{returnedCount}</p>
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
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Stock avant → après</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Notes / Référence</th>
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
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLORS[row.movement_type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {MOVEMENT_TYPE_FR_FULL[row.movement_type] ?? row.movement_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-zinc-900">{row.product?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-black">
                    <span className={signedQty(row).startsWith('+') ? 'text-green-600' : signedQty(row).startsWith('-') ? 'text-red-600' : ''}>
                      {signedQty(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">
                    {row.previous_stock != null && row.new_stock != null ? `${row.previous_stock} → ${row.new_stock}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700 max-w-[260px]">
                    <p className="truncate" title={row.reason ?? ''}>{row.reason || '—'}</p>
                    {row.reference_type && (
                      <p className="text-xs text-zinc-400">{REFERENCE_FR[row.reference_type] ?? row.reference_type}{row.reference_id ? ` #${row.reference_id}` : ''}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">{row.actor?.name ?? 'Système'}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(row.moved_at ?? row.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
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

    </div>
  );
}
