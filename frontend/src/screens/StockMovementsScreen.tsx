import React, { useEffect, useState } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

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
  const { toast } = useToast();
  const [rows, setRows] = useState<StockMovement[]>([]);
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
  }, [page, search, typeFilter, activeBrandId]);

  const inCount = rows.filter(r => r.type === 'in').length;
  const outCount = rows.filter(r => r.type === 'out').length;
  const transferCount = rows.filter(r => r.type === 'transfer').length;
  const adjustmentCount = rows.filter(r => r.type === 'adjustment').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Mouvements de stock" subtitle="Historique des entrées, sorties et transferts de stock" />

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
        <EmptyState icon={<ArrowDownUp size={40} />} title="Aucun mouvement" description="Aucun mouvement de stock trouvé pour les filtres sélectionnés." />
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
    </div>
  );
}
