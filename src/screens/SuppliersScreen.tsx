import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';

export type Supplier = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  category: string;
  avgLeadDays: number;
  status: 'Actif' | 'Inactif';
  note: string;
};

export type PurchaseOrder = {
  id: string;
  ref: string;
  supplierId: string;
  status: 'Brouillon' | 'Envoyée' | 'Partielle' | 'Reçue' | 'Annulée';
  amount: number;
  receivedQty: number;
  totalQty: number;
  payment: 'Non payé' | 'Partiel' | 'Payé';
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: Parameters<typeof StatusChip>[0]['tone'] }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="text-2xl font-black text-zinc-900">{value}</p>
        <StatusChip tone={tone ?? 'neutral'} />
      </div>
    </div>
  );
}

function toneForPoStatus(s: PurchaseOrder['status']): Parameters<typeof StatusChip>[0]['tone'] {
  if (s === 'Reçue') return 'success';
  if (s === 'Partielle') return 'warning';
  if (s === 'Annulée') return 'danger';
  if (s === 'Envoyée') return 'info';
  return 'neutral';
}

export function SuppliersScreen({
  suppliers,
  purchaseOrders,
  onUpsertSupplier,
}: {
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  onUpsertSupplier: (s: Supplier) => void;
}) {
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Supplier>({
    id: '',
    name: '',
    contact: '',
    phone: '+212 ',
    category: 'Général',
    avgLeadDays: 2,
    status: 'Actif',
    note: '',
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return suppliers.filter((x) => {
      if (!s) return true;
      const blob = `${x.name} ${x.contact} ${x.phone} ${x.category} ${x.status} ${x.note}`.toLowerCase();
      return blob.includes(s);
    });
  }, [suppliers, q]);

  const selected = useMemo(() => suppliers.find((s) => s.id === openId) ?? null, [suppliers, openId]);
  const supplierPos = useMemo(() => (selected ? purchaseOrders.filter((p) => p.supplierId === selected.id) : []), [purchaseOrders, selected]);

  const kpis = useMemo(() => {
    const active = suppliers.filter((s) => s.status === 'Actif').length;
    const poCount = purchaseOrders.length;
    const pendingReceipts = purchaseOrders.filter((p) => p.status === 'Envoyée' || p.status === 'Partielle').length;
    const bought = purchaseOrders.reduce((sum, p) => sum + p.amount, 0);
    return { active, poCount, pendingReceipts, bought };
  }, [suppliers, purchaseOrders]);

  function startCreate() {
    setDraft({
      id: `SUP-${Math.random().toString(16).slice(2, 8)}`,
      name: '',
      contact: '',
      phone: '+212 ',
      category: 'Général',
      avgLeadDays: 2,
      status: 'Actif',
      note: '',
    });
    setModalOpen(true);
  }

  function startEdit(s: Supplier) {
    setDraft({ ...s });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs"
        subtitle="Module procurement: fournisseurs + commandes fournisseurs + réception/paiement."
        right={
          <button
            onClick={startCreate}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nouveau fournisseur
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Fournisseurs actifs" value={kpis.active} tone="success" />
        <Kpi label="Commandes fournisseurs" value={kpis.poCount} />
        <Kpi label="Réceptions en attente" value={kpis.pendingReceipts} tone={kpis.pendingReceipts ? 'warning' : 'success'} />
        <Kpi label="Valeur achetée" value={formatCurrency(kpis.bought)} tone="info" />
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        right={<div className="text-sm font-black text-zinc-700">{filtered.length} fournisseurs</div>}
      />

      <DataTable
        rows={filtered}
        columns={[
          { key: 'name', header: 'Nom', cell: (s) => <button onClick={() => setOpenId(s.id)} className="font-black text-zinc-900 hover:underline">{s.name}</button> },
          { key: 'contact', header: 'Contact', cell: (s) => <span className="font-bold text-zinc-700">{s.contact || '—'}</span> },
          { key: 'phone', header: 'Téléphone', cell: (s) => <span className="font-bold text-zinc-700">{s.phone}</span> },
          { key: 'category', header: 'Catégorie', cell: (s) => <span className="font-bold text-zinc-700">{s.category}</span> },
          { key: 'lead', header: 'Délai moyen', cell: (s) => <StatusChip tone={s.avgLeadDays <= 2 ? 'success' : s.avgLeadDays <= 5 ? 'warning' : 'danger'}>{s.avgLeadDays} j</StatusChip> },
          { key: 'status', header: 'Statut', cell: (s) => <StatusChip tone={s.status === 'Actif' ? 'success' : 'warning'}>{s.status}</StatusChip> },
          { key: 'note', header: 'Note', cell: (s) => <span className="text-sm font-medium text-zinc-600 line-clamp-1">{s.note || '—'}</span> },
        ]}
        emptyTitle="Aucun fournisseur"
        emptyDescription="Crée un fournisseur pour commencer les achats."
      />

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-zinc-900">Commandes fournisseurs</p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Section liée à la réception et au paiement.</p>
          </div>
          <button
            onClick={() => alert('Créer commande fournisseur: placeholder')}
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
          >
            Nouvelle commande fournisseur
          </button>
        </div>

        <DataTable
          rows={purchaseOrders}
          density="compact"
          columns={[
            { key: 'ref', header: 'Référence', cell: (p) => <span className="font-black text-zinc-900">{p.ref}</span> },
            { key: 'supplier', header: 'Fournisseur', cell: (p) => <span className="font-bold text-zinc-700">{suppliers.find((s) => s.id === p.supplierId)?.name ?? '—'}</span> },
            { key: 'status', header: 'Statut', cell: (p) => <StatusChip tone={toneForPoStatus(p.status)}>{p.status}</StatusChip> },
            { key: 'amount', header: 'Montant', cell: (p) => <span className="font-black text-zinc-900">{formatCurrency(p.amount)}</span> },
            { key: 'received', header: 'Qtés reçues', cell: (p) => <span className="font-bold text-zinc-700">{p.receivedQty}/{p.totalQty}</span> },
            { key: 'pay', header: 'Paiement', cell: (p) => <StatusChip tone={p.payment === 'Payé' ? 'success' : p.payment === 'Partiel' ? 'warning' : 'neutral'}>{p.payment}</StatusChip> },
          ]}
          emptyTitle="Aucune commande fournisseur"
          emptyDescription="Crée une commande fournisseur (PO) pour suivre achats/réceptions."
        />
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setOpenId(null)}
        title={selected ? selected.name : ''}
        subtitle={selected ? `${selected.phone} • ${selected.status}` : ''}
        footer={
          selected && (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => selected && startEdit(selected)}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
              >
                Éditer
              </button>
              <button
                onClick={() => alert('Créer PO pour fournisseur: placeholder')}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
              >
                Créer commande fournisseur
              </button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Infos générales</p>
              <div className="mt-3 space-y-2 text-sm font-bold text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Contact</span>
                  <span className="text-zinc-900">{selected.contact || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Catégorie</span>
                  <span className="text-zinc-900">{selected.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Délai moyen</span>
                  <span className="text-zinc-900">{selected.avgLeadDays} jours</span>
                </div>
              </div>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Produits liés</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — à lier à `products.supplier`.</p>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Historique commandes</p>
              <DataTable
                rows={supplierPos}
                density="compact"
                columns={[
                  { key: 'ref', header: 'Réf', cell: (p) => <span className="font-black text-zinc-900">{p.ref}</span> },
                  { key: 'status', header: 'Statut', cell: (p) => <StatusChip tone={toneForPoStatus(p.status)}>{p.status}</StatusChip> },
                  { key: 'amount', header: 'Montant', cell: (p) => <span className="font-black text-zinc-900">{formatCurrency(p.amount)}</span> },
                  { key: 'recv', header: 'Reçu', cell: (p) => <span className="font-bold text-zinc-700">{p.receivedQty}/{p.totalQty}</span> },
                ]}
                emptyTitle="Aucun PO"
                emptyDescription="Aucune commande fournisseur pour ce fournisseur."
              />
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Conditions</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — délais paiement, remises, MOQ.</p>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Performance</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — taux retard, qualité, litiges.</p>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={draft.name ? `Éditer: ${draft.name}` : 'Créer un fournisseur'}
        subtitle="Module aligné stock/procurement."
        footer={
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                onUpsertSupplier(draft);
                setModalOpen(false);
              }}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
            >
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nom</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Contact</label>
            <input
              value={draft.contact}
              onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Téléphone</label>
            <input
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Catégorie</label>
            <input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Délai moyen (jours)</label>
            <input
              type="number"
              value={draft.avgLeadDays}
              onChange={(e) => setDraft({ ...draft, avgLeadDays: Number(e.target.value || 0) })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              min={0}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Statut</label>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
            >
              <option>Actif</option>
              <option>Inactif</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Note</label>
            <textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

