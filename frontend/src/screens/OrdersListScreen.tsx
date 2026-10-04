import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Calendar, ChevronRight, Filter, Plus, Trash2, Truck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { CreateComplaintButton } from '../components/complaints/CreateComplaintButton';
import { cn, formatCurrency } from '../lib/utils';
import type { Order, OrderStatus, PaymentState } from '../domain/orders';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';
import { CarrierDispatchModal, type DispatchTarget } from '../components/orders/CarrierDispatchModal';

type ApiOrderRow = {
  id: number;
  brand_id: number;
  order_number: string;
  source: string | null;
  status: string;
  payment_method?: string | null;
  payment_state: string;
  bank_transfer_declared_paid?: boolean;
  bank_transfer_reference?: string | null;
  bank_transfer_verification_status?: string | null;
  bank_transfer_verification_note?: string | null;
  total: string;
  notes?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  customer?: { full_name: string; phone: string; city?: string | null } | null;
  lines?: { product_name: string; quantity: number; unit_price: string }[];
  shipment?: { id: number; tracking_number: string | null; external_tracking_id?: string | null; sync_error?: string | null; status: string; carrier_status?: string | null; delivery_company?: { id: number; name: string } | null } | null;
};

/** Réponse de GET orders/{id} : tout ce que la liste ne transporte pas. */
type OrderDetail = {
  id: number;
  order_number: string;
  source: string | null;
  payment_method: string | null;
  subtotal: string | null;
  shipping_fee: string | null;
  discount: string | null;
  total: string;
  shipping_address: string | null;
  created_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  customer?: { full_name: string; phone: string; email?: string | null; city?: string | null; address?: string | null } | null;
  lines?: { id: number; product_name: string; quantity: number; unit_price: string; product?: { sku?: string | null } | null }[];
  shipment?: {
    tracking_number: string | null;
    external_tracking_id?: string | null;
    sync_error?: string | null;
    status: string;
    recipient_city?: string | null;
    recipient_address?: string | null;
    cod_amount?: string | null;
    delivery_fee?: string | null;
    delivery_company?: { name: string } | null;
  } | null;
  events?: { id: number; event_type: string; from_status: string | null; to_status: string | null; note: string | null; event_at: string; actor?: { name: string } | null }[];
};

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'COD (contre remboursement)',
  prepaid: 'Prépayé',
  transfer: 'Virement bancaire',
  card: 'Carte bancaire',
};

function statusFr(s: string): OrderStatus {
  switch (s) {
    case 'draft':
      return 'Brouillon';
    case 'pending':
      return 'En attente';
    case 'confirmed':
      return 'Confirmé';
    case 'prepared':
      return 'Préparée';
    case 'shipped':
      return 'Expédiée';
    case 'cancelled':
      return 'Annulé';
    case 'returned':
      return 'Retourné';
    case 'delivered':
      return 'Livré';
    default:
      return 'Autre';
  }
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Saisie manuelle',
  whatsapp: 'WhatsApp',
  ads: 'Publicité',
  influencer: 'Influenceur',
  site: 'Site web',
  referral: 'Recommandation',
  carrier_import: 'Import transporteur',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

const SHIPMENT_LABELS: Record<string, string> = {
  pending: 'En attente',
  created: 'Chez le transporteur',
  picked_up: 'Ramassé',
  in_transit: 'En transit',
  out_for_delivery: 'En cours de livraison',
  delivered: 'Livré',
  failed: 'Échec livraison',
  returned: 'Retourné',
  cancelled: 'Annulé',
  shipped: 'Expédié',
};

const SHIPMENT_TONES: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  created: 'info',
  picked_up: 'info',
  in_transit: 'info',
  out_for_delivery: 'info',
  shipped: 'info',
  delivered: 'success',
  failed: 'danger',
  returned: 'danger',
  cancelled: 'danger',
};

function shipmentStatusFr(s: string): string {
  return SHIPMENT_LABELS[s] ?? s.replace(/_/g, ' ');
}

/** Rien chez le transporteur : ni expédition, ni identifiant renvoyé par lui. */
function needsDispatch(o: Order): boolean {
  if (['Annulé', 'Retourné'].includes(o.status)) return false;
  return !o.shipment || !o.shipment.sentToCarrier;
}

function sourceFr(src: string | null | undefined): string {
  if (!src || src === '—') return '—';
  return SOURCE_LABELS[src] ?? src.replace(/_/g, ' ');
}

function statusApi(s: OrderStatus): string {
  switch (s) {
    case 'Brouillon':
      return 'draft';
    case 'En attente':
      return 'pending';
    case 'Confirmé':
      return 'confirmed';
    case 'Préparée':
      return 'prepared';
    case 'Expédiée':
      return 'shipped';
    case 'Annulé':
      return 'cancelled';
    case 'Retourné':
      return 'returned';
    case 'Livré':
      return 'delivered';
    default:
      return 'other';
  }
}

function paymentFr(p: string, method?: string | null, transferStatus?: string | null, status?: string | null): PaymentState {
  if ((status === 'cancelled' || status === 'returned') && !['paid', 'partial', 'refunded'].includes(p)) {
    return status === 'cancelled' ? 'Annulé' : 'Retourné';
  }
  if (method === 'transfer' && p !== 'paid') {
    if (transferStatus === 'verified') return 'Payé';
    return 'Virement en vérification';
  }
  switch (p) {
    case 'paid':
      return 'Payé';
    case 'unpaid':
      return 'Impayé';
    case 'partial':
      return 'Partiel';
    case 'refunded':
      return 'Remboursé';
    case 'cod_pending':
      return 'COD en attente';
    default:
      return 'Impayé';
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function mapOrder(o: ApiOrderRow, brandName: string): Order {
  return {
    apiId: o.id,
    id: o.order_number,
    createdAt: fmtDate(o.created_at),
    brand: brandName,
    source: o.source ?? '—',
    customerName: o.customer?.full_name ?? '—',
    phone: o.customer?.phone ?? '—',
    city: o.customer?.city ?? '—',
    address: '',
    status: statusFr(o.status),
    payment: paymentFr(o.payment_state, o.payment_method, o.bank_transfer_verification_status, o.status),
    paymentMethod: o.payment_method ?? undefined,
    bankTransferDeclaredPaid: Boolean(o.bank_transfer_declared_paid ?? false),
    bankTransferReference: o.bank_transfer_reference ?? undefined,
    bankTransferVerificationStatus: o.bank_transfer_verification_status ?? undefined,
    bankTransferVerificationNote: o.bank_transfer_verification_note ?? undefined,
    total: Number(o.total),
    items:
      (o.lines ?? []).map((ln, i) => ({
        id: `ln-${i}`,
        name: ln.product_name,
        qty: ln.quantity,
        price: Number(ln.unit_price),
      })) ?? [],
    notes: o.notes ?? undefined,
    cancellationReason: o.cancellation_reason ?? undefined,
    shipment: o.shipment
      ? {
          tracking: o.shipment.tracking_number,
          status: o.shipment.status,
          carrier: o.shipment.delivery_company?.name ?? '-',
          // Seul un identifiant renvoyé par le transporteur prouve l'envoi.
          sentToCarrier: Boolean(o.shipment.external_tracking_id),
          syncError: o.shipment.sync_error ?? null,
        }
      : null,
  };
}

function toneForStatus(s: OrderStatus): Parameters<typeof StatusChip>[0]['tone'] {
  switch (s) {
    case 'Confirmé':
    case 'Livré':
      return 'success';
    case 'Préparée':
    case 'Expédiée':
      return 'info';
    case 'En attente':
    case 'Brouillon':
      return 'warning';
    case 'Annulé':
    case 'Retourné':
      return 'danger';
    default:
      return 'neutral';
  }
}

function toneForPayment(p: PaymentState): Parameters<typeof StatusChip>[0]['tone'] {
  switch (p) {
    case 'Payé':
      return 'success';
    case 'Impayé':
      return 'danger';
    case 'Partiel':
      return 'warning';
    case 'Remboursé':
      return 'info';
    case 'COD en attente':
      return 'warning';
    case 'Virement en vérification':
      return 'info';
    default:
      return 'neutral';
  }
}

export function OrdersListScreen({ onNewOrder }: { onNewOrder: () => void }) {
  const { activeBrandId, activeBrand, brands } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const assignedFilter = searchParams.get('assigned_user_id');
  // Arrivee depuis un autre module (Retours, Suivi colis…) : la commande
  // visee s'ouvre directement au lieu d'etre cherchee a la main.
  const focusOrderRef = searchParams.get('order_ref');

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Order[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'Tous'>('Tous');
  const [payment, setPayment] = useState<PaymentState | 'Tous'>('Tous');
  const [brand, setBrand] = useState<string>('Toutes');
  const [dateRange, setDateRange] = useState<'Aujourd’hui' | '7 jours' | '30 jours' | '90 jours'>('7 jours');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  // Vue « Archives » : commandes mises de côté (non supprimées).
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  // Commande non encore expédiée : popup de choix du transporteur.
  const [dispatchTarget, setDispatchTarget] = useState<DispatchTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDispatch = useCallback((o: Order) => {
    setDispatchTarget({
      orderId: o.apiId,
      orderRef: o.id,
      recipientName: o.customerName,
      phone: o.phone,
      city: o.city,
      address: o.address,
      codAmount: o.paymentMethod === 'cod' ? o.total : 0,
    });
  }, []);

  const load = useCallback(async () => {
    if (!activeBrandId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ per_page: '100' });
    if (assignedFilter) params.set('assigned_user_id', assignedFilter);
    if (showArchived) params.set('archived', '1');
    const res = await api.get<LaravelPaginator<ApiOrderRow>>(`orders?${params.toString()}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setRows([]);
      return;
    }
    const page = res.data;
    const data = isPaginator<ApiOrderRow>(page) ? page.data : [];
    const nameById: Record<string, string> = {};
    for (const b of brands) nameById[b.id] = b.name;
    setRows(data.map((o) => mapOrder(o, nameById[String(o.brand_id)] ?? activeBrand.name)));
  }, [activeBrandId, activeBrand.name, brands, toast, assignedFilter, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const brandNames = useMemo(() => ['Toutes', ...brands.map((b) => b.name)], [brands]);

  const filtered = useMemo(() => {
    return rows.filter((o) => {
      const query = q.trim().toLowerCase();
      const matchesQuery =
        !query ||
        o.id.toLowerCase().includes(query) ||
        o.customerName.toLowerCase().includes(query) ||
        o.phone.toLowerCase().includes(query) ||
        o.city.toLowerCase().includes(query);
      const matchesStatus = status === 'Tous' ? true : o.status === status;
      const matchesPayment = payment === 'Tous' ? true : o.payment === payment;
      const matchesBrand = brand === 'Toutes' ? true : o.brand === brand;
      return matchesQuery && matchesStatus && matchesPayment && matchesBrand;
    });
  }, [rows, q, status, payment, brand]);

  useEffect(() => {
    if (!focusOrderRef) return;
    // Les filtres par defaut masqueraient la commande ciblee.
    setQ(focusOrderRef);
    setStatus('Tous');
    setDateRange('90 jours');
    setSelectedId(focusOrderRef);
  }, [focusOrderRef]);

  const selected = useMemo(
    () => filtered.find((o) => o.id === selectedId) ?? rows.find((o) => o.id === selectedId) ?? null,
    [filtered, rows, selectedId],
  );

  // Détail complet (frais, facture, expédition, historique) : la liste ne
  // transporte qu'un résumé.
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    void (async () => {
      const res = await api.get<OrderDetail>(`orders/${selected.apiId}`);
      if (!cancelled && res.ok && res.data) setDetail(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function patchStatus(next: OrderStatus, extraPayload?: Record<string, unknown>) {
    if (!selected) return;
    setStatusSaving(true);
    const res = await api.patch(`orders/${selected.apiId}/status`, { status: statusApi(next), ...extraPayload });
    setStatusSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      const rawErr = 'errors' in res ? res.errors : {};
      const lines = flattenFieldErrors(rawErr as Record<string, unknown>);
      if (lines.length) toast.error(lines.join(' '));
      return;
    }
    toast.success('Statut commande mis à jour.');
    await load();
  }

  /**
   * Archiver : la commande quitte la liste sans être supprimée, et le colis
   * est annulé chez le transporteur. Si cette annulation échoue, on demande
   * confirmation avant d'archiver quand même.
   */
  async function archiveOrder(force = false) {
    if (!selected) return;
    setArchiving(true);
    const res = await api.post(`orders/${selected.apiId}/archive`, force ? { force: true } : {});
    setArchiving(false);
    if (!res.ok) {
      toast.error(res.message);
      if (!force && /transporteur/i.test(res.message)) {
        const proceed = window.confirm(
          `${res.message}\n\nArchiver quand même ? Le colis restera actif chez le transporteur et devra être annulé manuellement.`,
        );
        if (proceed) await archiveOrder(true);
      }
      return;
    }
    toast.success(res.message);
    setSelectedId(null);
    await load();
  }

  async function restoreOrder() {
    if (!selected) return;
    setArchiving(true);
    const res = await api.post(`orders/${selected.apiId}/restore`, {});
    setArchiving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    setSelectedId(null);
    await load();
  }

  async function deleteOrder() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await api.del(`orders/${selected.apiId}`);
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(res.message || 'Impossible de supprimer cette commande.');
      return;
    }
    setDeleteModalOpen(false);
    setSelectedId(null);
    toast.success(res.message || 'Commande supprimée.');
    await load();
  }

  const columns = useMemo<Column<Order>[]>(() => {
    return [
      {
        key: 'id',
        header: 'Commande',
        cell: (o) => (
          <div className="space-y-1">
            <p className="text-sm font-black text-zinc-900">{o.id}</p>
            <p className="text-[11px] font-medium text-zinc-500">
              {o.createdAt} • {sourceFr(o.source)}
            </p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Client',
        cell: (o) => (
          <div className="space-y-1">
            <p className="text-sm font-bold text-zinc-900">{o.customerName}</p>
            <p className="text-[11px] font-medium text-zinc-500">
              {o.phone} • {o.city}
            </p>
          </div>
        ),
      },
      {
        key: 'produit',
        header: 'Produit',
        cell: (o) => {
          if (o.items.length === 0) return <span className="text-xs text-zinc-400">—</span>;
          const [first, ...rest] = o.items;
          return (
            <div className="space-y-0.5">
              <p className="text-sm font-bold text-zinc-900">
                {first.name}
                {first.qty > 1 && <span className="text-zinc-500 font-medium"> ×{first.qty}</span>}
              </p>
              {rest.length > 0 && (
                <p className="text-[11px] font-medium text-zinc-500">
                  + {rest.length} autre{rest.length > 1 ? 's' : ''} produit{rest.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          );
        },
      },
      {
        key: 'brand',
        header: 'Marque',
        cell: (o) => <span className="text-sm font-bold text-zinc-700">{o.brand}</span>,
      },
      {
        key: 'status',
        header: 'Statut',
        cell: (o) => <StatusChip tone={toneForStatus(o.status)}>{o.status}</StatusChip>,
      },
      {
        key: 'payment',
        header: 'Paiement',
        cell: (o) => <StatusChip tone={toneForPayment(o.payment)}>{o.payment}</StatusChip>,
      },
      {
        key: 'colis',
        header: 'Colis',
        cell: (o) => {
          if (!o.shipment) return <span className="text-xs text-zinc-400">Non envoyé</span>;
          const sh = o.shipment;

          // Tant que le transporteur n'a pas renvoyé d'identifiant, le colis
          // n'est pas chez lui : on le dit au lieu d'afficher son statut interne.
          if (!sh.sentToCarrier) {
            return (
              <div className="space-y-1">
                <StatusChip tone={sh.syncError ? 'danger' : 'warning'}>
                  {sh.syncError ? 'Échec envoi' : 'À envoyer'}
                </StatusChip>
                {sh.carrier !== '-' && <p className="text-[10px] text-zinc-400">{sh.carrier}</p>}
                {sh.syncError && <p className="text-[10px] text-rose-600 line-clamp-2">{sh.syncError}</p>}
              </div>
            );
          }

          return (
            <div className="space-y-1">
              <StatusChip tone={SHIPMENT_TONES[sh.status] ?? 'info'}>{shipmentStatusFr(sh.status)}</StatusChip>
              {sh.tracking && <p className="text-[10px] text-zinc-500 font-mono">{sh.tracking}</p>}
              {sh.carrier !== '-' && <p className="text-[10px] text-zinc-400">{sh.carrier}</p>}
            </div>
          );
        },
      },
      {
        key: 'total',
        header: 'Total',
        className: 'text-right',
        cell: (o) => <span className="text-sm font-black text-zinc-900">{formatCurrency(o.total)}</span>,
      },
      {
        key: 'open',
        header: '',
        className: 'text-right',
        cell: (o) => (
          <div className="inline-flex items-center gap-3">
            {needsDispatch(o) && hasPermission('shipments.create') && (
              <button
                type="button"
                onClick={() => openDispatch(o)}
                title="Envoyer au transporteur"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-colors"
              >
                <Truck className="w-3.5 h-3.5" /> Envoyer
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedId(o.id)}
              className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700"
            >
              Ouvrir <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ];
  }, [hasPermission, openDispatch]);

  if (!activeBrandId) {
    return <EmptyState title="Marque requise" description="Choisissez une marque active pour afficher les commandes." />;
  }

  if (!hasPermission('orders.view')) {
    return <EmptyState title="Accès refusé" description="Permission orders.view requise." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={showArchived ? 'Commandes — Archives' : 'Commandes'}
        subtitle={showArchived ? 'Commandes archivées (restaurables).' : 'Liste connectée à l’API (marque active).'}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setSelectedId(null); setShowArchived((v) => !v); }}
              className={cn(
                'px-4 py-2 rounded-2xl text-sm font-black inline-flex items-center gap-2 border',
                showArchived ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50',
              )}
            >
              <Archive className="w-4 h-4" /> {showArchived ? 'Commandes actives' : 'Archives'}
            </button>
            {hasPermission('orders.create') && !showArchived ? (
              <button
                type="button"
                onClick={onNewOrder}
                className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouvelle commande
              </button>
            ) : null}
          </div>
        }
      />

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <>
            <div className="hidden lg:flex items-center gap-2">
              <Calendar className="w-4 h-4 text-zinc-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
              >
                <option>Aujourd’hui</option>
                <option>7 jours</option>
                <option>30 jours</option>
                <option>90 jours</option>
              </select>
            </div>

            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
            >
              {brandNames.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus | 'Tous')}
              className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
            >
              <option>Tous</option>
              <option>Brouillon</option>
              <option>En attente</option>
              <option>Confirmé</option>
              <option>Préparée</option>
              <option>Expédiée</option>
              <option>Annulé</option>
              <option>Retourné</option>
              <option>Livré</option>
              <option>Autre</option>
            </select>

            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value as PaymentState | 'Tous')}
              className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none"
            >
              <option>Tous</option>
              <option>Payé</option>
              <option>Impayé</option>
              <option>Partiel</option>
              <option>Remboursé</option>
              <option>COD en attente</option>
              <option>Virement en vérification</option>
            </select>
          </>
        }
        right={
          <button
            type="button"
            className={cn('px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2')}
          >
            <Filter className="w-4 h-4" /> Filtres avancés
          </button>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : (
        <DataTable<Order>
          rows={filtered}
          columns={columns}
          density="comfortable"
          emptyTitle="Aucune commande"
          emptyDescription="Créez une commande ou vérifiez la marque active."
        />
      )}

      <Drawer open={!!selected} title={selected ? selected.id : ''} subtitle={selected ? `${selected.customerName} • ${selected.phone} • ${selected.city}` : undefined} onClose={() => setSelectedId(null)}>
        {selected && (
          <div className="space-y-6">
            <div className="card-muted p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">Statut</p>
                  <StatusChip tone={toneForStatus(selected.status)}>{selected.status}</StatusChip>
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">Colis</p>
                  {!selected.shipment ? (
                    <StatusChip tone="neutral">Non envoyé</StatusChip>
                  ) : !selected.shipment.sentToCarrier ? (
                    <StatusChip tone={selected.shipment.syncError ? 'danger' : 'warning'}>
                      {selected.shipment.syncError ? 'Échec envoi' : 'À envoyer'}
                    </StatusChip>
                  ) : (
                    <StatusChip tone={SHIPMENT_TONES[selected.shipment.status] ?? 'info'}>
                      {shipmentStatusFr(selected.shipment.status)}
                    </StatusChip>
                  )}
                  {selected.shipment?.sentToCarrier && selected.shipment.tracking && (
                    <p className="text-[10px] font-mono text-zinc-500">{selected.shipment.tracking}</p>
                  )}
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">Paiement</p>
                  <StatusChip tone={toneForPayment(selected.payment)}>{selected.payment}</StatusChip>
                </div>
              </div>
              {selected.paymentMethod === 'transfer' && (
                <div className="mt-4 border-t border-zinc-100 pt-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-700">Virement bancaire</p>
                  <p className="text-xs font-semibold text-zinc-700">
                    Déclaré payé: {selected.bankTransferDeclaredPaid ? 'Oui' : 'Non'}
                  </p>
                  <p className="text-xs font-semibold text-zinc-700">
                    Référence: {selected.bankTransferReference || '—'}
                  </p>
                  <p className="text-xs font-semibold text-zinc-700">
                    Vérification auto: {selected.bankTransferVerificationStatus || 'pending'}
                  </p>
                  {selected.bankTransferVerificationNote ? (
                    <p className="text-[11px] text-zinc-500">{selected.bankTransferVerificationNote}</p>
                  ) : null}
                </div>
              )}
              <div className="mt-4 border-t border-zinc-100 pt-3 space-y-1">
                {detail && (
                  <>
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
                      <span>Sous-total</span>
                      <span>{formatCurrency(Number(detail.subtotal ?? 0))}</span>
                    </div>
                    {Number(detail.shipping_fee ?? 0) > 0 && (
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-600">
                        <span>Livraison</span>
                        <span>{formatCurrency(Number(detail.shipping_fee))}</span>
                      </div>
                    )}
                    {Number(detail.discount ?? 0) > 0 && (
                      <div className="flex items-center justify-between text-xs font-semibold text-emerald-700">
                        <span>Remise</span>
                        <span>− {formatCurrency(Number(detail.discount))}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total</p>
                  <p className="text-lg font-black text-zinc-900">{formatCurrency(selected.total)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Informations</p>
              <div className="card-muted p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <span className="font-semibold text-zinc-500">Créée le</span>
                <span className="font-bold text-zinc-900 text-right">{fmtDateTime(detail?.created_at)}</span>

                <span className="font-semibold text-zinc-500">Confirmée le</span>
                <span className="font-bold text-zinc-900 text-right">{fmtDateTime(detail?.confirmed_at)}</span>

                <span className="font-semibold text-zinc-500">Livrée le</span>
                <span className="font-bold text-zinc-900 text-right">{fmtDateTime(detail?.delivered_at)}</span>

                <span className="font-semibold text-zinc-500">Origine</span>
                <span className="font-bold text-zinc-900 text-right">{sourceFr(selected.source)}</span>

                <span className="font-semibold text-zinc-500">Mode de paiement</span>
                <span className="font-bold text-zinc-900 text-right">
                  {PAYMENT_METHOD_LABELS[selected.paymentMethod ?? ''] ?? '—'}
                </span>

                <span className="font-semibold text-zinc-500">Marque</span>
                <span className="font-bold text-zinc-900 text-right">{selected.brand}</span>

                <span className="font-semibold text-zinc-500">Adresse de livraison</span>
                <span className="font-bold text-zinc-900 text-right">{detail?.shipping_address || '—'}</span>

                {detail?.customer?.email && (
                  <>
                    <span className="font-semibold text-zinc-500">E-mail client</span>
                    <span className="font-bold text-zinc-900 text-right break-all">{detail.customer.email}</span>
                  </>
                )}
              </div>
            </div>

            {detail?.shipment && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Expédition</p>
                <div className="card-muted p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <span className="font-semibold text-zinc-500">Transporteur</span>
                  <span className="font-bold text-zinc-900 text-right">{detail.shipment.delivery_company?.name ?? '—'}</span>

                  <span className="font-semibold text-zinc-500">N° de suivi</span>
                  <span className="font-mono text-zinc-900 text-right">{detail.shipment.external_tracking_id || detail.shipment.tracking_number || '—'}</span>

                  <span className="font-semibold text-zinc-500">Ville</span>
                  <span className="font-bold text-zinc-900 text-right">{detail.shipment.recipient_city || '—'}</span>

                  <span className="font-semibold text-zinc-500">À encaisser</span>
                  <span className="font-bold text-zinc-900 text-right">{formatCurrency(Number(detail.shipment.cod_amount ?? 0))}</span>

                  {detail.shipment.sync_error && (
                    <>
                      <span className="font-semibold text-rose-600">Dernier échec</span>
                      <span className="font-semibold text-rose-700 text-right">{detail.shipment.sync_error}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Produits</p>
              <div className="card overflow-hidden">
                <div className="divide-y divide-zinc-100">
                  {selected.items.map((it) => (
                    <div key={it.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-900">{it.name}</p>
                        <p className="text-[11px] text-zinc-500 font-medium">
                          {it.qty} × {formatCurrency(it.price)}
                        </p>
                      </div>
                      <p className="text-sm font-black text-zinc-900 shrink-0">{formatCurrency(it.price * it.qty)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {detail?.events && detail.events.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Historique</p>
                <div className="card overflow-hidden divide-y divide-zinc-100">
                  {detail.events.map((ev) => (
                    <div key={ev.id} className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900">
                          {ev.from_status && ev.to_status
                            ? `${statusFr(ev.from_status)} → ${statusFr(ev.to_status)}`
                            : ev.event_type.replace(/_/g, ' ')}
                        </p>
                        {ev.note && <p className="text-[11px] text-zinc-500">{ev.note}</p>}
                        {ev.actor?.name && <p className="text-[11px] text-zinc-400">par {ev.actor.name}</p>}
                      </div>
                      <p className="text-[11px] font-semibold text-zinc-500 shrink-0">{fmtDateTime(ev.event_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.notes && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Notes</p>
                <div className="card-muted p-4 text-sm font-medium text-zinc-700 whitespace-pre-wrap">{selected.notes}</div>
              </div>
            )}

            {selected.status === 'Annulé' && selected.cancellationReason && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Motif d'annulation</p>
                <div className="card-muted p-4 text-sm font-medium text-rose-700 whitespace-pre-wrap border border-rose-100 bg-rose-50/50 rounded-xl">
                  {selected.cancellationReason}
                </div>
              </div>
            )}

            {(hasPermission('orders.update') || hasPermission('orders.delete')) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Actions</p>
                  <CreateComplaintButton
                    preset={{
                      customer_name: selected.customerName,
                      customer_phone: selected.phone,
                      channel: 'telephone',
                      category: 'produit',
                      source_label: `Commande ${selected.id}`,
                    }}
                    title="Créer une réclamation pour cette commande"
                  />
                </div>
                {needsDispatch(selected) && hasPermission('shipments.create') && (
                  <div className="space-y-2">
                    {selected.shipment?.syncError && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                        Dernier échec d’envoi : {selected.shipment.syncError}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openDispatch(selected)}
                      className="w-full py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      <Truck className="w-4 h-4" />
                      {selected.shipment ? 'Renvoyer au transporteur' : 'Envoyer au transporteur'}
                    </button>
                  </div>
                )}
                {hasPermission('orders.update') && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={statusSaving || selected.status === 'Confirmé'}
                      onClick={() => void patchStatus('Confirmé')}
                      className="py-3 rounded-xl bg-primary-600 text-white font-black text-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      disabled={statusSaving || selected.status === 'Annulé'}
                      onClick={() => { setCancelReason(''); setCancelModalOpen(true); }}
                      className="py-3 rounded-xl border border-rose-200 text-rose-700 font-black text-sm hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  </div>
                )}
                {showArchived ? (
                  hasPermission('orders.update') && (
                    <button
                      type="button"
                      disabled={archiving}
                      onClick={() => void restoreOrder()}
                      className="w-full py-3 rounded-xl border border-zinc-300 bg-white text-zinc-900 font-black text-sm hover:bg-zinc-50 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <ArchiveRestore className="w-4 h-4" /> {archiving ? 'Restauration…' : 'Restaurer la commande'}
                    </button>
                  )
                ) : (
                  hasPermission('orders.delete') && (
                    <button
                      type="button"
                      disabled={archiving}
                      onClick={() => void archiveOrder()}
                      className="w-full py-3 rounded-xl border border-zinc-300 bg-white text-zinc-900 font-black text-sm hover:bg-zinc-50 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Archive className="w-4 h-4" /> {archiving ? 'Archivage…' : 'Archiver la commande'}
                    </button>
                  )
                )}
                {!showArchived && ['Brouillon', 'En attente', 'Annulé'].includes(selected.status) && (
                  <button
                    type="button"
                    onClick={() => { setDeleteError(null); setDeleteModalOpen(true); }}
                    className="w-full py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-black text-sm hover:bg-rose-100 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer définitivement
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Cancel with reason modal */}
      <Modal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Annuler la commande"
        subtitle={selected ? `Commande ${selected.id}` : ''}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setCancelModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
              Fermer
            </button>
            <button
              type="button"
              disabled={statusSaving || !cancelReason.trim()}
              onClick={async () => {
                await patchStatus('Annulé', { cancellation_reason: cancelReason.trim() });
                setCancelModalOpen(false);
              }}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 disabled:opacity-50"
            >
              {statusSaving ? 'Annulation…' : 'Confirmer l\'annulation'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-600">Indiquez la raison de l'annulation de cette commande.</p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium resize-none"
            placeholder="Motif d'annulation…"
            autoFocus
          />
        </div>
      </Modal>

      {/* Delete order modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Supprimer la commande"
        subtitle={selected ? `Êtes-vous sûr de vouloir supprimer ${selected.id} ?` : ''}
        footer={
          <div className="space-y-3">
            {deleteError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">{deleteError}</div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
                Annuler
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteOrder()}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-black hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        }
      >
        <p className="text-sm text-zinc-600">Cette action est irréversible. Toutes les lignes de commande seront également supprimées.</p>
      </Modal>

      <CarrierDispatchModal
        target={dispatchTarget}
        onClose={() => setDispatchTarget(null)}
        onSent={() => void load()}
      />
    </div>
  );
}
