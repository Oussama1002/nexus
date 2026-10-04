import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';
import { Drawer } from '../components/ui/Drawer';

type OrderDetail = {
  id: number;
  order_number: string;
  total: string;
  payment_method: string | null;
  shipping_address: string | null;
  created_at: string;
  customer?: { full_name: string; phone: string; city?: string | null; address?: string | null } | null;
  lines?: { id: number; product_name: string; quantity: number; unit_price: string }[];
  shipment?: {
    tracking_number: string | null;
    status: string;
    delivery_company?: { name: string } | null;
  } | null;
};

type Return = {
  id: number | string;
  order_ref: string;
  order_id?: number | null;
  customer_name: string;
  product_name: string;
  reason: string;
  carrier?: string | null;
  status: string;
  amount: number;
  source?: 'return' | 'order';
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
  const toast = useToast();
  const [rows, setRows] = useState<Return[]>([]);
  // Fiche commande ouverte en panneau lateral, sans quitter les Retours.
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const openOrder = async (orderId: number) => {
    setOrderLoading(true);
    setOrderDetail(null);
    const res = await api.get<OrderDetail>(`orders/${orderId}`);
    setOrderLoading(false);
    if (!res.ok) { toast.error(res.message); return; }
    setOrderDetail(res.data);
  };
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [carriers, setCarriers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<Return> & { carriers?: { id: number; name: string }[] }>(
          'returns' + buildQuery({
            per_page: 25,
            page,
            search: search || undefined,
            status: statusFilter || undefined,
            delivery_company_id: carrierFilter || undefined,
          })
        );
        if (cancelled) return;
        if (res.ok) {
          setRows(res.data.data);
          setTotal(res.data.total);
          setLastPage(res.data.last_page);
          if (res.data.carriers) setCarriers(res.data.carriers);
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
  }, [page, search, statusFilter, carrierFilter, activeBrandId]);

  const totalReturns = total;
  const inTransitCount = rows.filter(r => r.status === 'in_transit').length;
  const receivedCount = rows.filter(r => r.status === 'received').length;
  const refundedCount = rows.filter(r => r.status === 'refunded').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Retours" subtitle="Gestion des retours et remboursements" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Total retours</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{totalReturns}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">En transit</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{inTransitCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Réceptionnés</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{receivedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Remboursés</p>
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
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={carrierFilter}
          onChange={e => { setCarrierFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les transporteurs</option>
          {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<RotateCcw size={40} />} title="Aucun retour" description="Aucun retour trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">N° Retour</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Commande</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Client</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Produit</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Transporteur</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Motif</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Montant</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={String(row.id)} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    <div className="flex items-center gap-1.5">
                      <span>#{row.id}</span>
                      {row.source === 'order' && (
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase bg-blue-50 text-blue-700" title="Commande retournée">
                          Commande
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.order_ref ? (
                      <button
                        type="button"
                        onClick={() => row.order_id && void openOrder(row.order_id)}
                        disabled={!row.order_id}
                        className="font-black text-primary-600 hover:underline"
                      >
                        {row.order_ref}
                      </button>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">{row.customer_name}</td>
                  <td className="px-4 py-3 text-sm">{row.product_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-700">{row.carrier || '—'}</td>
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

      <Drawer
        open={orderLoading || !!orderDetail}
        onClose={() => setOrderDetail(null)}
        title={orderDetail?.order_number ?? 'Commande'}
      >
        {orderLoading ? (
          <p className="text-sm font-semibold text-zinc-500">Chargement…</p>
        ) : orderDetail ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Client</p>
              <p className="font-bold text-zinc-900">{orderDetail.customer?.full_name ?? '—'}</p>
              <p className="text-zinc-600">{orderDetail.customer?.phone ?? '—'}</p>
              <p className="text-zinc-600">
                {orderDetail.shipping_address || orderDetail.customer?.address || '—'}
                {orderDetail.customer?.city ? ` · ${orderDetail.customer.city}` : ''}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Produits</p>
              {orderDetail.lines?.length ? (
                <ul className="mt-1 space-y-1">
                  {orderDetail.lines.map(l => (
                    <li key={l.id} className="flex justify-between gap-3">
                      <span className="text-zinc-800">{l.product_name} × {l.quantity}</span>
                      <span className="font-bold text-zinc-900">{formatMAD(Number(l.unit_price) * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-zinc-500">—</p>}
            </div>

            <div className="flex justify-between border-t border-zinc-100 pt-3">
              <span className="font-black uppercase text-[10px] tracking-widest text-zinc-500">Total</span>
              <span className="font-black text-zinc-900">{formatMAD(Number(orderDetail.total))}</span>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Expédition</p>
              <p className="text-zinc-700">
                {orderDetail.shipment
                  ? `${orderDetail.shipment.delivery_company?.name ?? '—'} · ${orderDetail.shipment.tracking_number ?? 'sans suivi'}`
                  : 'Aucune expédition'}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Créée le</p>
              <p className="text-zinc-700">{new Date(orderDetail.created_at).toLocaleString('fr-FR')}</p>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
