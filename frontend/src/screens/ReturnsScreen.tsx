import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type Return = {
  id: number;
  order_ref: string;
  customer_name: string;
  product_name: string;
  reason: string;
  status: string;
  amount: number;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'requested', label: 'Demandé' },
  { value: 'in_transit', label: 'En transit' },
  { value: 'received', label: 'Reçu' },
  { value: 'refunded', label: 'Remboursé' },
  { value: 'refused', label: 'Refusé' },
];

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-blue-50 text-blue-700',
  in_transit: 'bg-yellow-50 text-yellow-700',
  received: 'bg-purple-50 text-purple-700',
  refunded: 'bg-green-50 text-green-700',
  refused: 'bg-red-50 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Demandé',
  in_transit: 'En transit',
  received: 'Reçu',
  refunded: 'Remboursé',
  refused: 'Refusé',
};

const formatMAD = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'MAD' }).format(n);

export function ReturnsScreen() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();
  const [rows, setRows] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<Return>>(
          'returns' + buildQuery({ per_page: 25, page, search: search || undefined, status: statusFilter || undefined })
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
  }, [page, search, statusFilter, activeBrandId]);

  const totalReturns = total;
  const inTransitCount = rows.filter(r => r.status === 'in_transit').length;
  const receivedCount = rows.filter(r => r.status === 'received').length;
  const refundedCount = rows.filter(r => r.status === 'refunded').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Retours" subtitle="Gestion des retours et remboursements" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total retours</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{totalReturns}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En transit</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{inTransitCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Réceptionnés</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{receivedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Remboursés</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{refundedCount}</p>
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
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<RotateCcw size={40} />} title="Aucun retour" description="Aucun retour trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">N° Retour</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Commande</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Produit</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Motif</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Montant</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm font-medium">#{row.id}</td>
                  <td className="px-4 py-3 text-sm">{row.order_ref}</td>
                  <td className="px-4 py-3 text-sm">{row.customer_name}</td>
                  <td className="px-4 py-3 text-sm">{row.product_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.reason}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{formatMAD(row.amount)}</td>
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
