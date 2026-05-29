import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Plus, RefreshCw, Truck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../lib/utils';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';

type ApiPoLine = {
  id: number;
  quantity_ordered: number;
  quantity_received: number;
  quantity_remaining?: number;
  unit_price: string;
  line_discount?: string;
  line_tax?: string;
  line_total: string;
  sku_snapshot?: string | null;
  product_name_snapshot?: string | null;
  product?: { name: string; sku: string };
};

type ApiPo = {
  id: number;
  reference: string;
  status: string;
  payment_status: string;
  total_amount: string;
  paid_amount?: string;
  remaining_amount?: string;
  currency?: string;
  supplier_id: number;
  supplier?: { id: number; name: string };
  brand?: { id: number; name: string };
  ordered_at?: string | null;
  expected_delivery_date?: string | null;
  received_at?: string | null;
  responsible_user_id?: number | null;
  responsible_user?: { id: number; name: string };
  payment_method?: string | null;
  payment_due_date?: string | null;
  shipping_mode?: string | null;
  carrier_name?: string | null;
  tracking_number?: string | null;
  warehouse_destination?: string | null;
  internal_notes?: string | null;
  supplier_conditions?: string | null;
  lines?: ApiPoLine[];
};

type ApiSupplier = { id: number; name: string };
type ApiProduct = { id: number; name: string; sku: string; price: string; cost?: string };

type ProcurementKpis = {
  purchase_orders_count: number;
  purchase_amount_total: number;
  active_suppliers_count: number;
  pending_orders_count: number;
  late_deliveries_count: number;
  quantity_received_total: number;
};

function statusTone(s: string): Parameters<typeof StatusChip>[0]['tone'] {
  if (s === 'received') return 'success';
  if (s === 'cancelled' || s === 'returned') return 'danger';
  if (s === 'partially_received') return 'warning';
  if (s === 'sent' || s === 'confirmed') return 'info';
  return 'neutral';
}

function statusFr(s: string): string {
  const m: Record<string, string> = {
    draft: 'Brouillon',
    sent: 'Envoyée',
    confirmed: 'Confirmée',
    partially_received: 'Partiellement reçue',
    received: 'Reçue',
    cancelled: 'Annulée',
    returned: 'Retournée',
  };
  return m[s] ?? s;
}

function paymentFr(s: string): string {
  const m: Record<string, string> = {
    unpaid: 'Non payé',
    partial: 'Partiel',
    paid: 'Payé',
    refunded: 'Remboursé',
    cancelled: 'Annulé',
  };
  return m[s] ?? s;
}

function parseNum(v: string | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function PurchaseOrdersScreen() {
  const { activeBrandId } = useBrand();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ApiPo[]>([]);
  const [kpis, setKpis] = useState<ProcurementKpis | null>(null);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | 'all'>('all');
  const [supplierFilter, setSupplierFilter] = useState<number | ''>('');
  const [paymentFilter, setPaymentFilter] = useState<string | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApiPo | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<number, string>>({});

  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [orderedAt, setOrderedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [hdrDiscount, setHdrDiscount] = useState('0');
  const [hdrTax, setHdrTax] = useState('0');
  const [shippingFee, setShippingFee] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [paymentDue, setPaymentDue] = useState('');
  const [shippingMode, setShippingMode] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [warehouseDest, setWarehouseDest] = useState('');
  const [supplierConditions, setSupplierConditions] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [lines, setLines] = useState<
    { product_id: number; quantity_ordered: number; unit_price: string; line_discount: string; line_tax: string }[]
  >([{ product_id: 0, quantity_ordered: 1, unit_price: '0', line_discount: '0', line_tax: '0' }]);

  const loadKpis = useCallback(async () => {
    if (!activeBrandId) return;
    const qs = new URLSearchParams();
    if (dateFrom) qs.set('date_from', dateFrom);
    if (dateTo) qs.set('date_to', dateTo);
    const res = await api.get<{ kpis: ProcurementKpis }>(`dashboards/procurement${qs.toString() ? `?${qs}` : ''}`);
    if (res.ok && res.data?.kpis) setKpis(res.data.kpis);
  }, [activeBrandId, dateFrom, dateTo]);

  const load = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    const qs = new URLSearchParams({ per_page: '100' });
    if (status !== 'all') qs.set('status', status);
    if (supplierFilter !== '') qs.set('supplier_id', String(supplierFilter));
    if (paymentFilter !== 'all') qs.set('payment_status', paymentFilter);
    if (dateFrom) qs.set('date_from', dateFrom);
    if (dateTo) qs.set('date_to', dateTo);
    if (q.trim()) qs.set('search', q.trim());
    const res = await api.get<LaravelPaginator<ApiPo>>(`purchase-orders?${qs.toString()}`);
    setLoading(false);
    if (res.ok && isPaginator<ApiPo>(res.data)) setRows(res.data.data);
    else if (!res.ok) toast.error(res.message);
    void loadKpis();
  }, [activeBrandId, dateFrom, dateTo, loadKpis, paymentFilter, q, status, supplierFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!activeBrandId) return;
      const [sRes, pRes] = await Promise.all([
        api.get<LaravelPaginator<ApiSupplier>>('suppliers?per_page=200'),
        api.get<LaravelPaginator<ApiProduct>>('products?per_page=200'),
      ]);
      if (c) return;
      if (sRes.ok && isPaginator<ApiSupplier>(sRes.data)) setSuppliers(sRes.data.data);
      if (pRes.ok && isPaginator<ApiProduct>(pRes.data)) setProducts(pRes.data.data);
    })();
    return () => {
      c = true;
    };
  }, [activeBrandId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let c = false;
    (async () => {
      const res = await api.get<ApiPo>(`purchase-orders/${selectedId}`);
      if (c) return;
      if (res.ok) setDetail(res.data);
      else toast.error(res.message);
    })();
    return () => {
      c = true;
    };
  }, [selectedId, toast]);

  const draftTotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const u = parseFloat(l.unit_price) || 0;
      const disc = parseFloat(l.line_discount) || 0;
      const tax = parseFloat(l.line_tax) || 0;
      return sum + Math.max(0, l.quantity_ordered * u - disc + tax);
    }, 0);
  }, [lines]);

  async function submitCreate() {
    if (!activeBrandId || !supplierId) {
      toast.error('Fournisseur requis.');
      return;
    }
    const cleanLines = lines
      .filter((l) => l.product_id > 0)
      .map((l) => ({
        product_id: l.product_id,
        quantity_ordered: l.quantity_ordered,
        unit_price: parseFloat(l.unit_price) || 0,
        line_discount: parseFloat(l.line_discount) || 0,
        line_tax: parseFloat(l.line_tax) || 0,
      }));
    if (!cleanLines.length) {
      toast.error('Ajoutez au moins une ligne avec un produit.');
      return;
    }
    const body: Record<string, unknown> = {
      supplier_id: supplierId,
      ordered_at: orderedAt,
      currency,
      status: 'draft',
      payment_status: paymentStatus,
      discount: parseFloat(hdrDiscount) || 0,
      tax: parseFloat(hdrTax) || 0,
      paid_amount: parseFloat(paidAmount) || 0,
      lines: cleanLines,
    };
    if (expectedDelivery) body.expected_delivery_date = expectedDelivery;
    if (responsibleUserId.trim()) body.responsible_user_id = parseInt(responsibleUserId, 10);
    if (shippingFee.trim()) body.shipping_fee = parseFloat(shippingFee);
    if (paymentMethod.trim()) body.payment_method = paymentMethod;
    if (paymentDue) body.payment_due_date = paymentDue;
    if (shippingMode.trim()) body.shipping_mode = shippingMode;
    if (carrierName.trim()) body.carrier_name = carrierName;
    if (trackingNumber.trim()) body.tracking_number = trackingNumber;
    if (warehouseDest.trim()) body.warehouse_destination = warehouseDest;
    if (supplierConditions.trim()) body.supplier_conditions = supplierConditions;
    if (internalNotes.trim()) body.internal_notes = internalNotes;

    const res = await api.post<ApiPo>('purchase-orders', body);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success('Bon de commande créé.');
    setCreateOpen(false);
    setLines([{ product_id: 0, quantity_ordered: 1, unit_price: '0', line_discount: '0', line_tax: '0' }]);
    void load();
  }

  async function receivePo(full: boolean) {
    if (!detail) return;
    let body: Record<string, unknown> = {};
    if (!full && detail.lines?.length) {
      const lines = detail.lines
        .map((l) => ({
          line_id: l.id,
          quantity: parseInt(receiveQty[l.id] ?? '0', 10) || 0,
        }))
        .filter((x) => x.quantity > 0);
      if (lines.length === 0) {
        toast.error('Indiquez au moins une quantité à réceptionner.');
        return;
      }
      body = { lines };
    }
    const res = await api.post(`purchase-orders/${detail.id}/receive`, body);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Réception enregistrée — stock mis à jour.');
    setReceiveOpen(false);
    setReceiveQty({});
    void load();
    setSelectedId(null);
  }

  async function sendSupplier(id: number) {
    const res = await api.post(`purchase-orders/${id}/send-supplier`, {});
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Marqué comme envoyé au fournisseur.');
    void load();
    setSelectedId(null);
  }

  async function cancelPo(id: number) {
    const res = await api.post(`purchase-orders/${id}/cancel`, {});
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Commande annulée.');
    void load();
    setSelectedId(null);
  }

  function openReceiveModal() {
    if (!detail?.lines?.length) return;
    const init: Record<number, string> = {};
    for (const l of detail.lines) {
      const rem = Math.max(0, l.quantity_ordered - (l.quantity_received ?? 0));
      init[l.id] = rem > 0 ? String(rem) : '0';
    }
    setReceiveQty(init);
    setReceiveOpen(true);
  }

  const filteredLocal = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.reference.toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes fournisseurs"
        subtitle="BC, lignes dynamiques, paiement & livraison, réception partielle → mouvements de stock."
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nouvelle commande
            </button>
          </div>
        }
      />

      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            ['BC (période)', kpis.purchase_orders_count],
            ['Montant achats', formatCurrency(kpis.purchase_amount_total)],
            ['Fournisseurs actifs', kpis.active_suppliers_count],
            ['En attente', kpis.pending_orders_count],
            ['Retards livraison', kpis.late_deliveries_count],
            ['Qté reçue', kpis.quantity_received_total],
          ].map(([label, val]) => (
            <div key={label as string} className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">{label as string}</p>
              <p className="text-lg font-black mt-1 text-zinc-900">{val}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-800"
        >
          <option value="all">Tous statuts</option>
          <option value="draft">Brouillon</option>
          <option value="sent">Envoyée</option>
          <option value="confirmed">Confirmée</option>
          <option value="partially_received">Partiellement reçue</option>
          <option value="received">Reçue</option>
          <option value="cancelled">Annulée</option>
          <option value="returned">Retournée</option>
        </select>
        <select
          value={supplierFilter === '' ? '' : String(supplierFilter)}
          onChange={(e) => setSupplierFilter(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-800 min-w-[160px]"
        >
          <option value="">Tous fournisseurs</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
          className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-800"
        >
          <option value="all">Tous paiements</option>
          <option value="unpaid">Non payé</option>
          <option value="partial">Partiel</option>
          <option value="paid">Payé</option>
          <option value="refunded">Remboursé</option>
          <option value="cancelled">Annulé</option>
        </select>
        <label className="text-[11px] font-bold text-zinc-500 uppercase">
          Du
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold"
          />
        </label>
        <label className="text-[11px] font-bold text-zinc-500 uppercase">
          Au
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold"
          />
        </label>
      </div>

      <FilterBar query={q} onQueryChange={setQ} right={<span className="text-sm font-black text-zinc-700">{loading ? '…' : `${filteredLocal.length} BC`}</span>} />

      {filteredLocal.length === 0 && !loading ? (
        <EmptyState title="Aucun bon de commande" description="Créez une commande ou élargissez les filtres." />
      ) : (
        <DataTable
          rows={filteredLocal}
          loading={loading}
          columns={[
            {
              key: 'ref',
              header: 'Référence',
              cell: (r) => (
                <button type="button" onClick={() => setSelectedId(r.id)} className="font-black text-primary-600 hover:underline">
                  {r.reference}
                </button>
              ),
            },
            {
              key: 'supplier',
              header: 'Fournisseur',
              cell: (r) => <span className="font-bold text-zinc-800">{r.supplier?.name ?? `#${r.supplier_id}`}</span>,
            },
            {
              key: 'brand',
              header: 'Brand',
              cell: (r) => <span className="text-zinc-600">{r.brand?.name ?? '—'}</span>,
            },
            {
              key: 'status',
              header: 'Statut',
              cell: (r) => <StatusChip tone={statusTone(r.status)}>{statusFr(r.status)}</StatusChip>,
            },
            {
              key: 'pay',
              header: 'Paiement',
              cell: (r) => <span className="text-sm font-bold">{paymentFr(r.payment_status)}</span>,
            },
            {
              key: 'total',
              header: 'Montant',
              className: 'text-right',
              cell: (r) => (
                <span className="font-black text-zinc-900">
                  {formatCurrency(parseNum(r.total_amount))} {r.currency ? <span className="text-zinc-400 text-xs">{r.currency}</span> : null}
                </span>
              ),
            },
            {
              key: 'orderDate',
              header: 'Date commande',
              cell: (r) => (
                <span className="text-sm">{r.ordered_at ? new Date(r.ordered_at).toLocaleDateString('fr-FR') : '—'}</span>
              ),
            },
            {
              key: 'exp',
              header: 'Livraison prévue',
              cell: (r) => (
                <span className="text-sm">
                  {r.expected_delivery_date ? new Date(r.expected_delivery_date).toLocaleDateString('fr-FR') : '—'}
                </span>
              ),
            },
            {
              key: 'resp',
              header: 'Responsable',
              cell: (r) => {
                const ru = (r as ApiPo & { responsible_user?: { name: string } }).responsible_user;
                return <span className="text-sm font-semibold text-zinc-700">{ru?.name ?? '—'}</span>;
              },
            },
          ]}
        />
      )}

      <Drawer open={!!selectedId} onClose={() => setSelectedId(null)} title={detail?.reference ?? ''} footer={null}>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <StatusChip tone={statusTone(detail.status)}>{statusFr(detail.status)}</StatusChip>
              <StatusChip tone="neutral">{paymentFr(detail.payment_status)}</StatusChip>
              {detail.received_at && (
                <span className="text-xs font-bold text-zinc-500">Réception {new Date(detail.received_at).toLocaleString('fr-FR')}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="card p-3">
                <p className="text-[10px] font-black uppercase text-zinc-400">Commande</p>
                <p className="font-bold">{detail.supplier?.name}</p>
                <p className="text-zinc-500 mt-1">
                  {detail.ordered_at ? new Date(detail.ordered_at).toLocaleDateString('fr-FR') : ''} → prévu{' '}
                  {detail.expected_delivery_date ? new Date(detail.expected_delivery_date).toLocaleDateString('fr-FR') : '—'}
                </p>
              </div>
              <div className="card p-3">
                <p className="text-[10px] font-black uppercase text-zinc-400">Paiement</p>
                <p className="font-bold">
                  Payé {formatCurrency(parseNum(detail.paid_amount))} / {formatCurrency(parseNum(detail.total_amount))}
                </p>
                <p className="text-zinc-500 text-xs mt-1">Reste {formatCurrency(parseNum(detail.remaining_amount))}</p>
              </div>
            </div>

            {(detail.shipping_mode || detail.carrier_name || detail.tracking_number) && (
              <div className="card p-4 flex gap-2 text-sm">
                <Truck className="w-5 h-5 text-zinc-400 shrink-0" />
                <div>
                  <p className="font-black text-zinc-800">Livraison fournisseur</p>
                  <p className="text-zinc-600">
                    {[detail.shipping_mode, detail.carrier_name, detail.tracking_number].filter(Boolean).join(' · ') || '—'}
                  </p>
                  {detail.warehouse_destination && <p className="text-xs text-zinc-500 mt-1">Entrepôt : {detail.warehouse_destination}</p>}
                </div>
              </div>
            )}

            <div className="card p-4 space-y-2">
              <p className="text-xs font-black uppercase text-zinc-400 flex items-center gap-2">
                <Package className="w-4 h-4" /> Produits commandés
              </p>
              {(detail.lines ?? []).map((l) => (
                <div key={l.id} className="flex justify-between text-sm font-bold text-zinc-800 border-b border-zinc-50 pb-2">
                  <span>
                    {l.product_name_snapshot ?? l.product?.name ?? 'Produit'}{' '}
                    <span className="text-zinc-400 font-normal text-xs">({l.sku_snapshot ?? l.product?.sku ?? 'SKU'})</span>
                  </span>
                  <span>
                    {l.quantity_received ?? 0}/{l.quantity_ordered} · {formatCurrency(parseNum(l.line_total))}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-zinc-100 flex justify-between font-black text-zinc-900">
                <span>Total TTC (lignes + entête)</span>
                <span>{formatCurrency(parseNum(detail.total_amount))}</span>
              </div>
            </div>

            {(detail.internal_notes || detail.supplier_conditions) && (
              <div className="card p-4 text-sm space-y-2">
                {detail.internal_notes && (
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-400">Notes internes</p>
                    <p className="text-zinc-700 whitespace-pre-wrap">{detail.internal_notes}</p>
                  </div>
                )}
                {detail.supplier_conditions && (
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-400">Conditions fournisseur</p>
                    <p className="text-zinc-700 whitespace-pre-wrap">{detail.supplier_conditions}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {detail.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => void sendSupplier(detail.id)}
                  className="w-full py-3 rounded-2xl bg-sky-600 text-white text-sm font-black hover:bg-sky-700"
                >
                  Envoyer au fournisseur
                </button>
              )}
              {!['received', 'cancelled', 'draft'].includes(detail.status) && (
                <button type="button" onClick={() => openReceiveModal()} className="w-full py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700">
                  Réceptionner commande
                </button>
              )}
              {!['received', 'cancelled', 'partially_received'].includes(detail.status) && (
                <button
                  type="button"
                  onClick={() => void cancelPo(detail.id)}
                  className="w-full py-3 rounded-2xl border border-red-200 text-red-700 text-sm font-black hover:bg-red-50"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Réception stock">
        {detail && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">Saisissez les quantités reçues pour cette livraison (partielle ou totale). Le stock est augmenté immédiatement.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-black uppercase text-zinc-400">
                    <th className="py-2">Produit</th>
                    <th className="py-2 text-right">Commandé</th>
                    <th className="py-2 text-right">Déjà reçu</th>
                    <th className="py-2 text-right">Restant</th>
                    <th className="py-2 text-right">À réceptionner</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lines ?? []).map((l) => {
                    const rem = Math.max(0, l.quantity_ordered - (l.quantity_received ?? 0));
                    return (
                      <tr key={l.id} className="border-b border-zinc-50">
                        <td className="py-2 font-bold text-zinc-800">{l.product_name_snapshot ?? l.product?.name}</td>
                        <td className="py-2 text-right">{l.quantity_ordered}</td>
                        <td className="py-2 text-right">{l.quantity_received ?? 0}</td>
                        <td className="py-2 text-right">{rem}</td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={rem}
                            value={receiveQty[l.id] ?? '0'}
                            onChange={(e) => setReceiveQty((prev) => ({ ...prev, [l.id]: e.target.value }))}
                            className="w-20 px-2 py-1 rounded-lg border border-zinc-200 font-bold text-right"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void receivePo(true)} className="flex-1 py-3 rounded-2xl bg-zinc-100 text-zinc-900 text-sm font-black">
                Tout réceptionner (restant)
              </button>
              <button type="button" onClick={() => void receivePo(false)} className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white text-sm font-black">
                Valider quantités
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle commande fournisseur" panelClassName="max-w-4xl">
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">
          <section className="space-y-3">
            <p className="text-xs font-black uppercase text-primary-600">Informations générales</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400">Fournisseur *</label>
                <select
                  value={supplierId === '' ? '' : String(supplierId)}
                  onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold"
                >
                  <option value="">— choisir —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400">Date commande *</label>
                <input
                  type="date"
                  value={orderedAt}
                  onChange={(e) => setOrderedAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400">Livraison prévue</label>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(e) => setExpectedDelivery(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-zinc-400">Devise</label>
                <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase text-zinc-400">Responsable achat (user id)</label>
                <input
                  value={responsibleUserId}
                  onChange={(e) => setResponsibleUserId(e.target.value)}
                  placeholder="Optionnel"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs font-black uppercase text-primary-600">Produits commandés</p>
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [...prev, { product_id: 0, quantity_ordered: 1, unit_price: '0', line_discount: '0', line_tax: '0' }])
                }
                className="text-sm font-black text-primary-600"
              >
                + Ligne
              </button>
            </div>
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end card-muted p-3">
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Produit *</label>
                  <select
                    value={l.product_id || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const next = [...lines];
                      next[idx] = { ...next[idx], product_id: v };
                      const pr = products.find((p) => p.id === v);
                      if (pr) next[idx].unit_price = pr.cost ?? pr.price;
                      setLines(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
                  >
                    <option value="">—</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Qté *</label>
                  <input
                    type="number"
                    min={1}
                    value={l.quantity_ordered}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], quantity_ordered: Math.max(1, Number(e.target.value) || 1) };
                      setLines(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                  />
                </div>
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Prix achat *</label>
                  <input
                    value={l.unit_price}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], unit_price: e.target.value };
                      setLines(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                  />
                </div>
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">Remise</label>
                  <input
                    value={l.line_discount}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], line_discount: e.target.value };
                      setLines(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                  />
                </div>
                <div className="col-span-4 md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-400">TVA</label>
                  <input
                    value={l.line_tax}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], line_tax: e.target.value };
                      setLines(next);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                  />
                </div>
              </div>
            ))}
          </section>

          <section className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase text-primary-600">Informations paiement</p>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm"
              >
                <option value="unpaid">Non payé</option>
                <option value="partial">Partiel</option>
                <option value="paid">Payé</option>
                <option value="refunded">Remboursé</option>
                <option value="cancelled">Annulé</option>
              </select>
              <input
                placeholder="Mode paiement"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm"
              />
              <input
                type="number"
                placeholder="Montant payé"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm"
              />
              <input type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-black uppercase text-primary-600">Remises globales & frais</p>
              <input value={hdrDiscount} onChange={(e) => setHdrDiscount(e.target.value)} placeholder="Remise entête" className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm" />
              <input value={hdrTax} onChange={(e) => setHdrTax(e.target.value)} placeholder="TVA entête" className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm" />
              <input value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} placeholder="Frais livraison" className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm" />
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-black uppercase text-primary-600">Livraison fournisseur</p>
            <div className="grid md:grid-cols-2 gap-2">
              <input value={shippingMode} onChange={(e) => setShippingMode(e.target.value)} placeholder="Mode livraison" className="px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm" />
              <input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} placeholder="Transporteur" className="px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm" />
              <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="N° suivi" className="px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm" />
              <input value={warehouseDest} onChange={(e) => setWarehouseDest(e.target.value)} placeholder="Entrepôt destination" className="px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm" />
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-black uppercase text-primary-600">Notes</p>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Notes internes"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm"
            />
            <textarea
              value={supplierConditions}
              onChange={(e) => setSupplierConditions(e.target.value)}
              placeholder="Conditions fournisseur"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm"
            />
          </section>

          <div className="flex justify-between items-center font-black text-lg text-zinc-900 border-t border-zinc-100 pt-4">
            <span>Total estimé (lignes)</span>
            <span>{formatCurrency(draftTotal)}</span>
          </div>
          <button type="button" onClick={() => void submitCreate()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Créer la commande
          </button>
        </div>
      </Modal>
    </div>
  );
}
