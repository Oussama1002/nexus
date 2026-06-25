import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Barcode, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../lib/utils';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';

type ApiShipment = {
  id: number;
  tracking_number: string | null;
  status: string;
  payment_status?: string | null;
  cod_amount: string;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  recipient_city?: string | null;
  city?: string | null;
  carrier_label_url?: string | null;
  sync_error?: string | null;
  order?: { id: number; order_number: string; total?: string; status?: string; assigned_user_id?: number | null } | null;
  delivery_company?: { id: number; name: string; code?: string | null } | null;
};

type ApiOrderLite = { id: number; order_number: string; status: string };

type ApiOrderDetail = {
  id: number;
  order_number: string;
  status: string;
  total: string;
  payment_method: string;
  shipping_address?: string | null;
  customer?: { full_name: string | null; phone: string | null; city: string | null } | null;
};

type ShipmentEventRow = {
  id: number;
  event_type: string;
  status: string | null;
  note: string | null;
  description?: string | null;
  location?: string | null;
  event_at: string;
};

const STATUSES = [
  'pending',
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'cancelled',
] as const;

const STATUS_UPDATE_OPTIONS = [
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
  'cancelled',
] as const;

function statusFr(s: string): string {
  const m: Record<string, string> = {
    pending: 'En attente',
    created: 'Créée',
    picked_up: 'Enlevée',
    in_transit: 'En transit',
    out_for_delivery: 'En livraison',
    delivered: 'Livrée',
    failed: 'Échec',
    returned: 'Retournée',
    cancelled: 'Annulée',
    cod_pending: 'COD en attente',
    cod_received: 'COD reçu',
    reconciled: 'Réconcilié',
    disputed: 'Litige',
    not_applicable: 'N/A',
  };
  return m[s] ?? s;
}

function toneForStatus(s: string): Parameters<typeof StatusChip>[0]['tone'] {
  if (s === 'delivered') return 'success';
  if (s === 'returned' || s === 'failed' || s === 'cancelled') return 'danger';
  if (s === 'in_transit' || s === 'picked_up' || s === 'out_for_delivery') return 'info';
  return 'warning';
}

export function ShipmentsScreen() {
  const { activeBrandId } = useBrand();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [rows, setRows] = useState<ApiShipment[]>([]);
  const [ordersConfirmed, setOrdersConfirmed] = useState<ApiOrderLite[]>([]);
  const [ordersPrepared, setOrdersPrepared] = useState<ApiOrderLite[]>([]);
  const [carriers, setCarriers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | 'all'>('all');
  const [paymentStatus, setPaymentStatus] = useState<string | 'all'>('all');
  const [carrierFilter, setCarrierFilter] = useState<string | 'all'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [orderId, setOrderId] = useState<number | ''>('');
  const [deliveryCompanyId, setDeliveryCompanyId] = useState<number | ''>('');
  const [orderDetail, setOrderDetail] = useState<ApiOrderDetail | null>(null);
  const [existingForOrder, setExistingForOrder] = useState<number>(0);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [insuranceFee, setInsuranceFee] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [notes, setNotes] = useState('');

  const [events, setEvents] = useState<ShipmentEventRow[]>([]);

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState<string>('in_transit');
  const [evLocation, setEvLocation] = useState('');
  const [evDescription, setEvDescription] = useState('');
  const [evAt, setEvAt] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const load = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    const qs = new URLSearchParams({ per_page: '50' });
    if (status !== 'all') qs.set('status', status);
    if (paymentStatus !== 'all') qs.set('payment_status', paymentStatus);
    if (carrierFilter !== 'all') qs.set('delivery_company_id', carrierFilter);
    if (cityFilter.trim()) qs.set('recipient_city', cityFilter.trim());
    if (dateFrom) qs.set('from', dateFrom);
    if (dateTo) qs.set('to', dateTo);
    if (q.trim()) qs.set('search', q.trim());

    const res = await api.get<LaravelPaginator<ApiShipment>>(`shipments?${qs}`);
    setLoading(false);
    if (res.ok && isPaginator<ApiShipment>(res.data)) setRows(res.data.data);
    else if (!res.ok) toast.error(res.message);
  }, [activeBrandId, carrierFilter, cityFilter, dateFrom, dateTo, paymentStatus, q, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!activeBrandId) return;
      const [oConf, oPrep, dcRes] = await Promise.all([
        api.get<LaravelPaginator<ApiOrderLite>>('orders?status=confirmed&per_page=100'),
        api.get<LaravelPaginator<ApiOrderLite>>('orders?status=prepared&per_page=100'),
        api.get<LaravelPaginator<{ id: number; name: string }>>('delivery-companies?per_page=100'),
      ]);
      if (c) return;
      if (oConf.ok && isPaginator<ApiOrderLite>(oConf.data)) setOrdersConfirmed(oConf.data.data);
      if (oPrep.ok && isPaginator<ApiOrderLite>(oPrep.data)) setOrdersPrepared(oPrep.data.data);
      if (dcRes.ok && isPaginator<{ id: number; name: string }>(dcRes.data)) setCarriers(dcRes.data.data);
    })();
    return () => {
      c = true;
    };
  }, [activeBrandId]);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!orderId) {
        setOrderDetail(null);
        return;
      }
      const res = await api.get<ApiOrderDetail>(`orders/${orderId}`);
      if (c || !res.ok || !res.data) return;
      setOrderDetail(res.data as ApiOrderDetail);
      const o = res.data as ApiOrderDetail;
      setRecipientName(o.customer?.full_name ?? '');
      setRecipientPhone(o.customer?.phone ?? '');
      setRecipientCity(o.customer?.city ?? '');
      setRecipientAddress(o.shipping_address ?? '');
      const cod =
        o.payment_method === 'cod' && o.total !== undefined ? parseFloat(o.total).toFixed(2) : '';
      setCodAmount(cod);
    })();
    return () => {
      c = true;
    };
  }, [orderId]);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!orderId) {
        setExistingForOrder(0);
        return;
      }
      const res = await api.get<LaravelPaginator<{ id: number }>>(`shipments?order_id=${orderId}&per_page=5`);
      if (c || !res.ok || !isPaginator<{ id: number }>(res.data)) return;
      setExistingForOrder(res.data.data.length);
    })();
    return () => {
      c = true;
    };
  }, [orderId]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!selectedId) {
        setEvents([]);
        return;
      }
      const res = await api.get<ShipmentEventRow[]>(`shipments/${selectedId}/events`);
      if (cancel || !res.ok || !Array.isArray(res.data)) return;
      setEvents(res.data as ShipmentEventRow[]);
    })();
    return () => {
      cancel = true;
    };
  }, [selectedId]);

  async function createShipment() {
    if (!orderId) {
      toast.error('Choisissez une commande.');
      return;
    }
    if (!deliveryCompanyId) {
      toast.error('Choisissez un transporteur.');
      return;
    }
    if (!recipientName.trim() || !recipientPhone.trim() || !recipientCity.trim() || !recipientAddress.trim()) {
      toast.error('Destinataire : nom, téléphone, ville et adresse sont requis.');
      return;
    }

    const body: Record<string, unknown> = {
      order_id: orderId,
      delivery_company_id: deliveryCompanyId,
      recipient_name: recipientName.trim(),
      recipient_phone: recipientPhone.trim(),
      recipient_city: recipientCity.trim(),
      recipient_address: recipientAddress.trim(),
    };
    if (codAmount.trim()) body.cod_amount = parseFloat(codAmount);
    if (deliveryFee.trim()) body.delivery_fee = parseFloat(deliveryFee);
    if (insuranceFee.trim()) body.insurance_fee = parseFloat(insuranceFee);
    if (pickupDate) body.pickup_date = pickupDate;
    if (notes.trim()) body.notes = notes.trim();

    const res = await api.post<ApiShipment>('shipments', body);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success('Expédition créée.');
    setCreateOpen(false);
    setOrderId('');
    setDeliveryCompanyId('');
    setNotes('');
    void load();
  }

  async function runSync(id: number) {
    const res = await api.post<{ shipment: ApiShipment; provider: { ok?: boolean; message?: string } }>(
      `shipments/${id}/sync`,
      {},
    );
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.data?.provider?.ok ? 'Synchronisation OK.' : res.data?.provider?.message ?? 'Sync terminée.');
    void load();
    if (selectedId === id) setSelectedId(id);
  }

  async function fetchLabelMeta(id: number) {
    const res = await api.get<{ label_url: string | null; tracking_number: string | null }>(`shipments/${id}/label`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    const url = res.data?.label_url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.success(`Étiquette locale — suivi ${res.data?.tracking_number ?? '—'}`);
  }

  async function submitStatusChange() {
    if (!selectedId) return;
    const body: Record<string, unknown> = {
      status: nextStatus,
      location: evLocation.trim() || undefined,
      description: evDescription.trim() || undefined,
      event_at: evAt || undefined,
      failure_reason: nextStatus === 'failed' ? failureReason.trim() || undefined : undefined,
      return_reason: nextStatus === 'returned' ? returnReason.trim() || undefined : undefined,
    };
    const res = await api.patch(`shipments/${selectedId}/status`, body);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Statut mis à jour.');
    setStatusModalOpen(false);
    setFailureReason('');
    setReturnReason('');
    void load();
    if (selectedId) {
      const sid = selectedId;
      const evRes = await api.get<ShipmentEventRow[]>(`shipments/${sid}/events`);
      if (evRes.ok && Array.isArray(evRes.data)) setEvents(evRes.data as ShipmentEventRow[]);
    }
  }

  const columns = useMemo<Column<ApiShipment>[]>(() => {
    return [
      {
        key: 'tracking',
        header: 'Suivi',
        cell: (s) => (
          <div className="space-y-1">
            <button type="button" onClick={() => setSelectedId(s.id)} className="text-sm font-black text-primary-600 hover:underline">
              {s.tracking_number ?? '—'}
            </button>
            <p className="text-[11px] text-zinc-500">{s.order ? `Commande ${s.order.order_number}` : '—'}</p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Destinataire',
        cell: (s) => (
          <div>
            <p className="text-sm font-bold text-zinc-900">{s.recipient_name ?? '—'}</p>
            <p className="text-[11px] text-zinc-500">
              {s.recipient_phone ?? ''}
              {(s.recipient_city ?? s.city) ? ` • ${s.recipient_city ?? s.city}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'carrier',
        header: 'Transporteur',
        cell: (s) => <span className="text-sm font-bold text-zinc-700">{s.delivery_company?.name ?? '—'}</span>,
      },
      {
        key: 'status',
        header: 'Statut',
        cell: (s) => <StatusChip tone={toneForStatus(s.status)}>{statusFr(s.status)}</StatusChip>,
      },
      {
        key: 'pay',
        header: 'Paiement',
        cell: (s) =>
          s.payment_status ? (
            <StatusChip tone={s.payment_status === 'cod_pending' ? 'warning' : 'neutral'}>
              {statusFr(s.payment_status)}
            </StatusChip>
          ) : (
            '—'
          ),
      },
      {
        key: 'cod',
        header: 'COD',
        className: 'text-right',
        cell: (s) => <span className="text-sm font-black">{formatCurrency(parseFloat(s.cod_amount))}</span>,
      },
      {
        key: 'go',
        header: '',
        className: 'text-right',
        cell: (s) => (
          <button type="button" onClick={() => setSelectedId(s.id)} className="text-sm font-bold text-primary-600 inline-flex items-center gap-1">
            Détail <ChevronRight className="w-4 h-4" />
          </button>
        ),
      },
    ];
  }, []);

  const mergeOrders = useMemo(() => {
    const map = new Map<number, ApiOrderLite>();
    for (const o of ordersConfirmed) map.set(o.id, o);
    for (const o of ordersPrepared) map.set(o.id, o);
    return Array.from(map.values()).sort((a, b) => b.id - a.id);
  }, [ordersConfirmed, ordersPrepared]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suivi colis"
        subtitle="Création manuelle, statuts, événements et synchro transporteur."
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Créer
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold"
        >
          <option value="all">Tous les statuts</option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {statusFr(st)}
            </option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value as typeof paymentStatus)}
          className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold"
        >
          <option value="all">Paiement (tous)</option>
          <option value="not_applicable">N/A</option>
          <option value="cod_pending">COD en attente</option>
          <option value="cod_received">COD reçu</option>
          <option value="reconciled">Réconcilié</option>
          <option value="disputed">Litige</option>
        </select>
        <select
          value={carrierFilter}
          onChange={(e) => setCarrierFilter(e.target.value as typeof carrierFilter)}
          className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold min-w-[160px]"
        >
          <option value="all">Transporteur</option>
          {carriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Ville destinataire"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold w-40"
        />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" />
      </div>

      <FilterBar query={q} onQueryChange={setQ} right={<span className="text-sm font-black">{loading ? '…' : `${rows.length} expéditions`}</span>} />

      {rows.length === 0 && !loading && carriers.length === 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm space-y-2">
          <p className="font-black text-rose-800">API transporteur non connectée</p>
          <p className="text-rose-700">
            Aucune société de livraison n'est configurée. Rendez-vous dans{' '}
            <strong>Centre de paramètres → Livraison</strong> pour connecter l'API de votre transporteur (Sendit, Ameex…) avant d'utiliser le suivi colis et le KPI livraison.
          </p>
        </div>
      ) : rows.length === 0 && !loading ? (
        <EmptyState title="Aucune expédition" description="Créez une expédition depuis une commande confirmée ou préparée." />
      ) : (
        <DataTable rows={rows} columns={columns} />
      )}

      <Drawer open={!!selected} onClose={() => setSelectedId(null)} title={selected?.tracking_number ?? ''}>
        {selected && (
          <div className="space-y-4">
            <div className="card-muted p-4 space-y-2">
              <p className="text-xs font-black uppercase text-zinc-400">Statut expédition</p>
              <div className="flex flex-wrap gap-2">
                <StatusChip tone={toneForStatus(selected.status)}>{statusFr(selected.status)}</StatusChip>
                {selected.payment_status && (
                  <StatusChip tone="neutral">{statusFr(selected.payment_status)}</StatusChip>
                )}
              </div>
              {selected.sync_error && (
                <p className="text-xs text-rose-600 font-bold">Sync : {selected.sync_error}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                {hasPermission('shipments.sync') && (
                  <button
                    type="button"
                    onClick={() => void runSync(selected.id)}
                    className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-black"
                  >
                    Synchroniser
                  </button>
                )}
                {hasPermission('shipments.label') && (
                  <button
                    type="button"
                    onClick={() => void fetchLabelMeta(selected.id)}
                    className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-black inline-flex items-center gap-1"
                  >
                    <Barcode className="w-4 h-4" /> Étiquette
                  </button>
                )}
                {hasPermission('shipments.status') && (
                  <button
                    type="button"
                    onClick={() => {
                      setNextStatus('in_transit');
                      setStatusModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-primary-600 text-white text-xs font-black"
                  >
                    Mettre à jour le statut
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase text-zinc-400 mb-2">Historique</p>
              <div className="space-y-2">
                {events.length === 0 && <p className="text-sm text-zinc-500">Aucun événement.</p>}
                {events.map((ev) => (
                  <div key={ev.id} className="card-muted p-3 text-sm border-l-4 border-primary-500">
                    <p className="font-black text-zinc-900">{ev.event_type}</p>
                    {ev.status && <p className="text-zinc-600">{statusFr(ev.status)}</p>}
                    {ev.location && <p className="text-zinc-500 text-xs">{ev.location}</p>}
                    {ev.description && <p className="text-zinc-600">{ev.description}</p>}
                    {ev.note && <p className="text-zinc-500">{ev.note}</p>}
                    <p className="text-[10px] text-zinc-400">{new Date(ev.event_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Mise à jour du statut">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Nouveau statut</label>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
            >
              {STATUS_UPDATE_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {statusFr(st)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Lieu (optionnel)</label>
            <input value={evLocation} onChange={(e) => setEvLocation(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Description</label>
            <textarea value={evDescription} onChange={(e) => setEvDescription(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold min-h-[72px]" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Date événement</label>
            <input
              type="datetime-local"
              value={evAt}
              onChange={(e) => setEvAt(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
            />
          </div>
          {nextStatus === 'failed' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Motif échec *</label>
              <input value={failureReason} onChange={(e) => setFailureReason(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-rose-200 font-bold" />
            </div>
          )}
          {nextStatus === 'returned' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Motif retour *</label>
              <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-amber-200 font-bold" />
            </div>
          )}
          <button
            type="button"
            onClick={() => void submitStatusChange()}
            className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black"
          >
            Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle expédition">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Commande (confirmée ou préparée)</label>
            <select
              value={orderId === '' ? '' : String(orderId)}
              onChange={(e) => setOrderId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
            >
              <option value="">—</option>
              {mergeOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number} ({statusFr(o.status)})
                </option>
              ))}
            </select>
          </div>

          {orderDetail && (
            <div className="card-muted p-3 text-sm space-y-1">
              <p>
                <span className="font-black">Total commande :</span> {formatCurrency(parseFloat(orderDetail.total))}
              </p>
              <p>
                <span className="font-black">Statut :</span> {statusFr(orderDetail.status)}
              </p>
            </div>
          )}

          {orderDetail && !['confirmed', 'prepared'].includes(orderDetail.status) && (
            <div className="flex gap-2 items-start text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>La commande doit être confirmée ou préparée pour créer une expédition.</span>
            </div>
          )}

          {existingForOrder > 0 && (
            <div className="flex gap-2 items-start text-rose-800 bg-rose-50 border border-rose-100 rounded-xl p-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Cette commande a déjà une expédition en base ({existingForOrder}). Supprimez-la côté API ou choisissez une autre commande.</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Transporteur *</label>
            <select
              value={deliveryCompanyId === '' ? '' : String(deliveryCompanyId)}
              onChange={(e) => setDeliveryCompanyId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
            >
              <option value="">—</option>
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Destinataire *</label>
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Téléphone *</label>
              <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Ville *</label>
            <input value={recipientCity} onChange={(e) => setRecipientCity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Adresse complète *</label>
            <textarea value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold min-h-[80px]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">COD</label>
              <input value={codAmount} onChange={(e) => setCodAmount(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Frais livraison</label>
              <input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Assurance</label>
              <input value={insuranceFee} onChange={(e) => setInsuranceFee(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Date enlèvement</label>
            <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase text-zinc-400">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold min-h-[64px]" />
          </div>

          <button type="button" onClick={() => void createShipment()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Créer l&apos;expédition
          </button>
        </div>
      </Modal>
    </div>
  );
}
