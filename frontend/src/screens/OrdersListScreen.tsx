import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronRight, Filter, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { cn, formatCurrency } from '../lib/utils';
import type { Order, OrderStatus, PaymentState } from '../domain/orders';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';

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
};

function statusFr(s: string): OrderStatus {
  switch (s) {
    case 'draft':
      return 'Brouillon';
    case 'pending':
      return 'En attente';
    case 'confirmed':
      return 'Confirmé';
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

function statusApi(s: OrderStatus): string {
  switch (s) {
    case 'Brouillon':
      return 'draft';
    case 'En attente':
      return 'pending';
    case 'Confirmé':
      return 'confirmed';
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

function paymentFr(p: string, method?: string | null, transferStatus?: string | null): PaymentState {
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
    payment: paymentFr(o.payment_state, o.payment_method, o.bank_transfer_verification_status),
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
  };
}

function toneForStatus(s: OrderStatus): Parameters<typeof StatusChip>[0]['tone'] {
  switch (s) {
    case 'Confirmé':
    case 'Livré':
      return 'success';
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!activeBrandId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await api.get<LaravelPaginator<ApiOrderRow>>('orders?per_page=100');
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
  }, [activeBrandId, activeBrand.name, brands, toast]);

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

  const selected = useMemo(
    () => filtered.find((o) => o.id === selectedId) ?? rows.find((o) => o.id === selectedId) ?? null,
    [filtered, rows, selectedId],
  );

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
    toast.success('Commande supprimée.');
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
              {o.createdAt} • {o.source}
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
          <button
            type="button"
            onClick={() => setSelectedId(o.id)}
            className="inline-flex items-center gap-2 text-sm font-bold text-primary-600 hover:text-primary-700"
          >
            Ouvrir <ChevronRight className="w-4 h-4" />
          </button>
        ),
      },
    ];
  }, []);

  if (!activeBrandId) {
    return <EmptyState title="Marque requise" description="Choisissez une marque active pour afficher les commandes." />;
  }

  if (!hasPermission('orders.view')) {
    return <EmptyState title="Accès refusé" description="Permission orders.view requise." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commandes"
        subtitle="Liste connectée à l’API (marque active)."
        right={
          hasPermission('orders.create') ? (
            <button
              type="button"
              onClick={onNewOrder}
              className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nouvelle commande
            </button>
          ) : null
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
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Statut</p>
                  <StatusChip tone={toneForStatus(selected.status)}>{selected.status}</StatusChip>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Paiement</p>
                  <StatusChip tone={toneForPayment(selected.payment)}>{selected.payment}</StatusChip>
                </div>
              </div>
              {selected.paymentMethod === 'transfer' && (
                <div className="mt-4 border-t border-zinc-100 pt-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Virement bancaire</p>
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
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total</p>
                <p className="text-lg font-black text-zinc-900">{formatCurrency(selected.total)}</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Produits</p>
              <div className="card overflow-hidden">
                <div className="divide-y divide-zinc-100">
                  {selected.items.map((it) => (
                    <div key={it.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{it.name}</p>
                        <p className="text-[11px] text-zinc-500 font-medium">Qté {it.qty}</p>
                      </div>
                      <p className="text-sm font-black text-zinc-900">{formatCurrency(it.price)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

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

            {hasPermission('orders.update') && (
              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Actions</p>
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
                {hasPermission('orders.delete') && ['Brouillon', 'En attente', 'Annulé'].includes(selected.status) && (
                  <button
                    type="button"
                    onClick={() => { setDeleteError(null); setDeleteModalOpen(true); }}
                    className="w-full py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-black text-sm hover:bg-rose-100 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer la commande
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
    </div>
  );
}
