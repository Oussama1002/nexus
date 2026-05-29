import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Plus, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../lib/utils';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';

type ApiDc = {
  id: number;
  name: string;
  code?: string | null;
  email?: string | null;
  contact_name: string | null;
  phone: string | null;
  status: string;
};
type ApiDp = {
  id: number;
  label: string;
  amount: string;
  state: string;
  period_start: string | null;
  period_end: string | null;
  reconciled_at: string | null;
  delivery_company?: { name: string };
};

export function DeliveryScreen() {
  const { activeBrandId } = useBrand();
  const toast = useToast();
  const [tab, setTab] = useState<'Sociétés' | 'COD'>('Sociétés');
  const [companies, setCompanies] = useState<ApiDc[]>([]);
  const [payments, setPayments] = useState<ApiDp[]>([]);
  const [codSummary, setCodSummary] = useState<{ total_cod_pending: number; shipments: unknown[] } | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [dcModal, setDcModal] = useState(false);
  const [dcName, setDcName] = useState('');
  const [dcCode, setDcCode] = useState('');
  const [dcEmail, setDcEmail] = useState('');
  const [dcPhone, setDcPhone] = useState('');
  const [dcApiUrl, setDcApiUrl] = useState('');
  const [dcApiKeyRef, setDcApiKeyRef] = useState('');
  const [dcAvgCost, setDcAvgCost] = useState('');
  const [dcAvgDays, setDcAvgDays] = useState('');
  const [dcNotes, setDcNotes] = useState('');
  const [settModal, setSettModal] = useState(false);
  const [settLabel, setSettLabel] = useState('');
  const [settDc, setSettDc] = useState<number | ''>('');
  const [settShipments, setSettShipments] = useState<number[]>([]);
  const [settPeriodStart, setSettPeriodStart] = useState('');
  const [settPeriodEnd, setSettPeriodEnd] = useState('');
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputePaymentId, setDisputePaymentId] = useState<number | null>(null);
  const [disputeNote, setDisputeNote] = useState('');

  const loadCompanies = useCallback(async () => {
    const res = await api.get<LaravelPaginator<ApiDc>>('delivery-companies?per_page=100');
    if (res.ok && isPaginator<ApiDc>(res.data)) setCompanies(res.data.data);
    else if (!res.ok) toast.error(res.message);
  }, [toast]);

  const loadPayments = useCallback(async () => {
    if (!activeBrandId) return;
    const res = await api.get<LaravelPaginator<ApiDp>>('delivery-payments?per_page=50');
    if (res.ok && isPaginator<ApiDp>(res.data)) setPayments(res.data.data);
    else if (!res.ok) toast.error(res.message);
  }, [activeBrandId, toast]);

  const loadCodSummary = useCallback(async () => {
    if (!activeBrandId) return;
    const res = await api.get<{ total_cod_pending: number; shipments: unknown[] }>('delivery-payments/cod-summary');
    if (res.ok && res.data && typeof res.data === 'object' && 'total_cod_pending' in res.data) {
      setCodSummary(res.data as { total_cod_pending: number; shipments: unknown[] });
    }
  }, [activeBrandId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadCompanies(), loadPayments(), loadCodSummary()]);
    setLoading(false);
  }, [loadCompanies, loadPayments, loadCodSummary]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredDc = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return companies;
    return companies.filter((c) => c.name.toLowerCase().includes(s));
  }, [companies, q]);

  async function saveDc() {
    if (!dcName.trim()) return;
    const body: Record<string, unknown> = { name: dcName.trim(), status: 'active' };
    if (dcCode.trim()) body.code = dcCode.trim().toLowerCase();
    if (dcEmail.trim()) body.email = dcEmail.trim();
    if (dcPhone.trim()) body.phone = dcPhone.trim();
    if (dcApiUrl.trim()) body.api_url = dcApiUrl.trim();
    if (dcApiKeyRef.trim()) body.api_key_ref = dcApiKeyRef.trim();
    if (dcAvgCost.trim()) body.avg_cost = parseFloat(dcAvgCost);
    if (dcAvgDays.trim()) body.avg_delivery_days = parseInt(dcAvgDays, 10);
    if (dcNotes.trim()) body.notes = dcNotes.trim();
    const res = await api.post('delivery-companies', body);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success('Transporteur créé.');
    setDcModal(false);
    setDcName('');
    setDcCode('');
    setDcEmail('');
    setDcPhone('');
    setDcApiUrl('');
    setDcApiKeyRef('');
    setDcAvgCost('');
    setDcAvgDays('');
    setDcNotes('');
    void loadCompanies();
  }

  async function submitDispute() {
    if (!disputePaymentId || !disputeNote.trim()) {
      toast.error('Motif du litige requis.');
      return;
    }
    const res = await api.patch(`delivery-payments/${disputePaymentId}`, {
      state: 'disputed',
      note: disputeNote.trim(),
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Règlement marqué en litige.');
    setDisputeModal(false);
    setDisputePaymentId(null);
    setDisputeNote('');
    void loadPayments();
    void loadCodSummary();
  }

  async function reconcile(id: number) {
    const res = await api.post(`delivery-payments/${id}/reconcile`, {});
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Règlement réconcilié.');
    void loadPayments();
    void loadCodSummary();
  }

  async function createSettlement() {
    if (!settLabel.trim() || settDc === '') {
      toast.error('Libellé et transporteur requis.');
      return;
    }
    const res = await api.post('delivery-payments', {
      delivery_company_id: settDc,
      label: settLabel.trim(),
      shipment_ids: settShipments,
      state: 'draft',
      period_start: settPeriodStart || undefined,
      period_end: settPeriodEnd || undefined,
    });
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success('Règlement créé.');
    setSettModal(false);
    setSettPeriodStart('');
    setSettPeriodEnd('');
    void loadPayments();
    void loadCodSummary();
  }

  useEffect(() => {
    if (!settModal || !codSummary?.shipments || !Array.isArray(codSummary.shipments)) return;
    type Row = { id: number };
    const ids = (codSummary.shipments as Row[]).map((x) => x.id).filter(Boolean);
    setSettShipments(ids);
  }, [settModal, codSummary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livraison"
        subtitle="Transporteurs & règlements COD (API)."
        right={
          <button type="button" onClick={() => void refresh()} className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex gap-2 items-center">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        }
      />

      <div className="flex gap-2 border-b border-zinc-100 pb-2">
        {(['Sociétés', 'COD'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-black ${tab === t ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Sociétés' && (
        <>
          <div className="flex justify-end">
            <button type="button" onClick={() => setDcModal(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex gap-2 items-center">
              <Plus className="w-4 h-4" /> Nouveau transporteur
            </button>
          </div>
          <FilterBar query={q} onQueryChange={setQ} right={<span className="text-sm font-black">{loading ? '…' : filteredDc.length}</span>} />
          {filteredDc.length === 0 ? (
            <EmptyState title="Aucun transporteur" description="Ajoutez une société de livraison." />
          ) : (
            <DataTable
              rows={filteredDc}
              columns={[
                { key: 'n', header: 'Nom', cell: (c) => <span className="font-black">{c.name}</span> },
                { key: 'code', header: 'Code', cell: (c) => <span className="text-xs font-bold text-zinc-600">{c.code ?? '—'}</span> },
                { key: 'co', header: 'Contact', cell: (c) => <span>{c.contact_name ?? '—'}</span> },
                { key: 'ph', header: 'Téléphone', cell: (c) => <span>{c.phone ?? '—'}</span> },
                {
                  key: 'st',
                  header: 'Statut',
                  cell: (c) => <StatusChip tone={c.status === 'active' ? 'success' : 'neutral'}>{c.status}</StatusChip>,
                },
              ]}
            />
          )}
        </>
      )}

      {tab === 'COD' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-400">COD en attente</p>
                <p className="text-2xl font-black text-zinc-900">{formatCurrency(codSummary?.total_cod_pending ?? 0)}</p>
              </div>
              <CreditCard className="w-10 h-10 text-primary-500" />
            </div>
            <div className="card p-5 flex items-center justify-end">
              <button type="button" onClick={() => setSettModal(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black">
                Nouveau règlement
              </button>
            </div>
          </div>

          <p className="text-xs font-black uppercase text-zinc-400">Règlements</p>
          {payments.length === 0 ? (
            <EmptyState title="Aucun règlement" description="Créez un règlement pour les expéditions COD." />
          ) : (
            <DataTable
              rows={payments}
              columns={[
                { key: 'l', header: 'Libellé', cell: (p) => <span className="font-black">{p.label}</span> },
                { key: 'dc', header: 'Transporteur', cell: (p) => <span>{p.delivery_company?.name ?? '—'}</span> },
                {
                  key: 'st',
                  header: 'État',
                  cell: (p) => <StatusChip tone={p.state === 'reconciled' ? 'success' : p.state === 'disputed' ? 'danger' : 'warning'}>{p.state}</StatusChip>,
                },
                {
                  key: 'am',
                  header: 'Montant',
                  className: 'text-right',
                  cell: (p) => <span className="font-black">{formatCurrency(parseFloat(p.amount))}</span>,
                },
                {
                  key: 'act',
                  header: '',
                  cell: (p) => {
                    if (p.state === 'reconciled') {
                      return (
                        <span className="text-xs text-zinc-400">{p.reconciled_at ? new Date(p.reconciled_at).toLocaleDateString() : ''}</span>
                      );
                    }
                    if (p.state === 'disputed') {
                      return <span className="text-xs font-black text-rose-600">Litige</span>;
                    }
                    return (
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button type="button" onClick={() => void reconcile(p.id)} className="text-sm font-black text-primary-600">
                          Réconcilier
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDisputePaymentId(p.id);
                            setDisputeNote('');
                            setDisputeModal(true);
                          }}
                          className="text-sm font-black text-rose-600"
                        >
                          Litige
                        </button>
                      </div>
                    );
                  },
                },
              ]}
            />
          )}
        </div>
      )}

      <Modal open={dcModal} onClose={() => setDcModal(false)} title="Nouveau transporteur">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <input
            value={dcName}
            onChange={(e) => setDcName(e.target.value)}
            placeholder="Nom *"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
          />
          <input
            value={dcCode}
            onChange={(e) => setDcCode(e.target.value)}
            placeholder="Code (ex. sendit, ameex, manual)"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
          />
          <input
            value={dcEmail}
            onChange={(e) => setDcEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
          />
          <input
            value={dcPhone}
            onChange={(e) => setDcPhone(e.target.value)}
            placeholder="Téléphone"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
          />
          <input
            value={dcApiUrl}
            onChange={(e) => setDcApiUrl(e.target.value)}
            placeholder="URL API / tracking"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
          />
          <input
            value={dcApiKeyRef}
            onChange={(e) => setDcApiKeyRef(e.target.value)}
            placeholder="Référence clé API (stockage sûr recommandé)"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={dcAvgCost}
              onChange={(e) => setDcAvgCost(e.target.value)}
              placeholder="Coût moyen"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
            />
            <input
              value={dcAvgDays}
              onChange={(e) => setDcAvgDays(e.target.value)}
              placeholder="Délai moyen (j)"
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
            />
          </div>
          <textarea
            value={dcNotes}
            onChange={(e) => setDcNotes(e.target.value)}
            placeholder="Notes"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold min-h-[64px]"
          />
          <button type="button" onClick={() => void saveDc()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Créer
          </button>
        </div>
      </Modal>

      <Modal open={settModal} onClose={() => setSettModal(false)} title="Règlement COD">
        <div className="space-y-3">
          <input value={settLabel} onChange={(e) => setSettLabel(e.target.value)} placeholder="Libellé" className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold" />
          <select
            value={settDc === '' ? '' : String(settDc)}
            onChange={(e) => setSettDc(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold"
          >
            <option value="">Transporteur</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={settPeriodStart} onChange={(e) => setSettPeriodStart(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 font-bold text-sm" />
            <input type="date" value={settPeriodEnd} onChange={(e) => setSettPeriodEnd(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 font-bold text-sm" />
          </div>
          <p className="text-xs text-zinc-500">
            {settShipments.length} expédition(s) COD sélectionnée(s) depuis le résumé en attente.
          </p>
          <button type="button" onClick={() => void createSettlement()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Créer le règlement
          </button>
        </div>
      </Modal>

      <Modal open={disputeModal} onClose={() => setDisputeModal(false)} title="Marquer en litige">
        <div className="space-y-3">
          <textarea
            value={disputeNote}
            onChange={(e) => setDisputeNote(e.target.value)}
            placeholder="Motif *"
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold min-h-[96px]"
          />
          <button type="button" onClick={() => void submitDispute()} className="w-full py-3 rounded-2xl bg-rose-600 text-white font-black">
            Confirmer le litige
          </button>
        </div>
      </Modal>
    </div>
  );
}
