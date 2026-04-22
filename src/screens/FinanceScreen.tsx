import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';
import type { Charge, ChargeDraft, ChargeType } from '../domain/finance';
import { trackSession } from '../lib/session';

const CHARGE_LABELS: Record<ChargeType, string> = {
  "prix_d'achat": "Prix d'achat",
  frais_publicitaires: 'Frais publicitaires',
  frais_livraison: 'Frais livraison',
  frais_confirmation: 'Frais confirmation',
  frais_emballage: 'Frais emballage',
  frais_transport: 'Frais transport',
  frais_contenu: 'Frais contenu',
  frais_cadeau: 'Frais cadeau',
  frais_risque: 'Frais risque',
  frais_divers: 'Frais divers',
};

function toneForChargeType(t: ChargeType): Parameters<typeof StatusChip>[0]['tone'] {
  switch (t) {
    case "prix_d'achat":
      return 'neutral';
    case 'frais_publicitaires':
      return 'info';
    case 'frais_livraison':
    case 'frais_transport':
      return 'warning';
    case 'frais_risque':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function FinanceScreen({
  charges,
  onCreateCharge,
}: {
  charges: Charge[];
  onCreateCharge: (draft: ChargeDraft) => void;
}) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<'Toutes' | Charge['brand']>('Toutes');
  const [type, setType] = useState<'Tous' | ChargeType>('Tous');
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<ChargeDraft>({
    date: '21/04/2026',
    brand: 'Multi-brand',
    type: 'frais_publicitaires',
    amount: 0,
    note: '',
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return charges.filter((c) => {
      const matchesQ =
        !query ||
        (c.note ?? '').toLowerCase().includes(query) ||
        CHARGE_LABELS[c.type].toLowerCase().includes(query) ||
        c.brand.toLowerCase().includes(query);
      const matchesBrand = brand === 'Toutes' ? true : c.brand === brand;
      const matchesType = type === 'Tous' ? true : c.type === type;
      return matchesQ && matchesBrand && matchesType;
    });
  }, [charges, q, brand, type]);

  const summary = useMemo(() => {
    const totalCharges = charges.reduce((s, c) => s + c.amount, 0);
    const ads = charges.filter((c) => c.type === 'frais_publicitaires').reduce((s, c) => s + c.amount, 0);
    const delivery = charges.filter((c) => c.type === 'frais_livraison').reduce((s, c) => s + c.amount, 0);
    const risk = charges.filter((c) => c.type === 'frais_risque').reduce((s, c) => s + c.amount, 0);
    return { totalCharges, ads, delivery, risk };
  }, [charges]);

  const columns = useMemo<Column<Charge>[]>(() => {
    return [
      {
        key: 'date',
        header: 'Date',
        cell: (c) => <span className="text-sm font-black text-zinc-900">{c.date}</span>,
      },
      {
        key: 'brand',
        header: 'Marque',
        cell: (c) => <span className="text-sm font-bold text-zinc-700">{c.brand}</span>,
      },
      {
        key: 'type',
        header: 'Type',
        cell: (c) => <StatusChip tone={toneForChargeType(c.type)}>{CHARGE_LABELS[c.type]}</StatusChip>,
      },
      {
        key: 'note',
        header: 'Note',
        cell: (c) => <span className="text-sm font-medium text-zinc-700">{c.note || '—'}</span>,
      },
      {
        key: 'amount',
        header: 'Montant',
        className: 'text-right',
        cell: (c) => <span className="text-sm font-black text-zinc-900">{formatCurrency(c.amount)}</span>,
      },
    ];
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        subtitle="Synthèse + charges (contexte opérations Maroc)."
        right={
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Ajouter charge
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Charges (total)</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(summary.totalCharges)}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Ads</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(summary.ads)}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Livraison</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(summary.delivery)}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Risque</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{formatCurrency(summary.risk)}</p>
        </div>
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <>
            <select value={brand} onChange={(e) => setBrand(e.target.value as any)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
              <option>Toutes</option>
              <option>Multi-brand</option>
              <option>Luxe Cosmetics</option>
              <option>Zest Home</option>
              <option>Moda Casa</option>
            </select>
            <select value={type} onChange={(e) => setType(e.target.value as any)} className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700 outline-none">
              <option value="Tous">Tous</option>
              {Object.keys(CHARGE_LABELS).map((k) => (
                <option key={k} value={k}>
                  {CHARGE_LABELS[k as ChargeType]}
                </option>
              ))}
            </select>
          </>
        }
      />

      <DataTable rows={filtered} columns={columns} emptyTitle="Aucune charge" emptyDescription="Ajoutez vos charges (ads, livraison, emballage…) pour suivre la marge nette." />

      <Modal
        open={createOpen}
        title="Ajouter une charge"
        subtitle="Enregistrer une dépense opérationnelle."
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setCreateOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 font-black text-sm text-zinc-700 hover:bg-zinc-50">
              Annuler
            </button>
            <button
              onClick={() => {
                onCreateCharge(draft);
                trackSession({ name: 'audit.finance.charge_create', ts: Date.now(), meta: { type: draft.type, amount: draft.amount, brand: draft.brand } });
                setCreateOpen(false);
              }}
              className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors"
            >
              Ajouter
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
            <input value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Marque</label>
            <select value={draft.brand} onChange={(e) => setDraft((d) => ({ ...d, brand: e.target.value as any }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none">
              <option>Multi-brand</option>
              <option>Luxe Cosmetics</option>
              <option>Zest Home</option>
              <option>Moda Casa</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</label>
            <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as ChargeType }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none">
              {Object.keys(CHARGE_LABELS).map((k) => (
                <option key={k} value={k}>
                  {CHARGE_LABELS[k as ChargeType]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Montant</label>
            <input type="number" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Note</label>
            <textarea value={draft.note ?? ''} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} rows={3} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

