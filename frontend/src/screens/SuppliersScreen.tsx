import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
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

export type SupplierTypeSlug =
  | 'product'
  | 'packaging'
  | 'raw_material'
  | 'service'
  | 'delivery'
  | 'other';

const SUPPLIER_TYPES: { value: SupplierTypeSlug; label: string }[] = [
  { value: 'product', label: 'Produit' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'raw_material', label: 'Matière première' },
  { value: 'service', label: 'Service' },
  { value: 'delivery', label: 'Livraison' },
  { value: 'other', label: 'Autre' },
];

function labelSupplierType(v: string): string {
  return SUPPLIER_TYPES.find((t) => t.value === v)?.label ?? v;
}

type ApiSupplier = {
  id: number;
  name: string;
  supplier_code: string | null;
  supplier_type: string;
  contact_name: string | null;
  phone: string | null;
  phone_secondary: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  category: string | null;
  products_supplied: string | null;
  avg_lead_days: number | null;
  min_order_amount: string | null;
  currency: string | null;
  payment_terms: string | null;
  preferred_payment_mode: string | null;
  status: string;
  note: string | null;
  quality_score: string | null;
  frequent_delays: boolean | null;
  complaints_notes: string | null;
  ice: string | null;
  if_number: string | null;
  rc_number: string | null;
  patente: string | null;
  rib_iban: string | null;
  contract_reference: string | null;
  price_list_reference: string | null;
  purchase_orders_count?: number;
  purchase_orders_max_created_at?: string | null;
};

type ApiPo = { id: number; reference: string; status: string; total_amount: string };

type Draft = {
  name: string;
  supplier_code: string;
  supplier_type: SupplierTypeSlug;
  category: string;
  status: 'active' | 'inactive' | 'blacklisted';
  contact_name: string;
  phone: string;
  phone_secondary: string;
  email: string;
  whatsapp: string;
  address: string;
  city: string;
  country: string;
  products_supplied: string;
  avg_lead_days: string;
  min_order_amount: string;
  currency: string;
  payment_terms: string;
  preferred_payment_mode: string;
  quality_score: string;
  frequent_delays: boolean;
  complaints_notes: string;
  ice: string;
  if_number: string;
  rc_number: string;
  patente: string;
  rib_iban: string;
  contract_reference: string;
  price_list_reference: string;
  note: string;
};

function emptyDraft(): Draft {
  return {
    name: '',
    supplier_code: '',
    supplier_type: 'product',
    category: '',
    status: 'active',
    contact_name: '',
    phone: '',
    phone_secondary: '',
    email: '',
    whatsapp: '',
    address: '',
    city: '',
    country: 'Maroc',
    products_supplied: '',
    avg_lead_days: '',
    min_order_amount: '',
    currency: 'MAD',
    payment_terms: '',
    preferred_payment_mode: '',
    quality_score: '',
    frequent_delays: false,
    complaints_notes: '',
    ice: '',
    if_number: '',
    rc_number: '',
    patente: '',
    rib_iban: '',
    contract_reference: '',
    price_list_reference: '',
    note: '',
  };
}

function rowToDraft(s: ApiSupplier): Draft {
  const st = s.supplier_type as SupplierTypeSlug;
  const typeOk = SUPPLIER_TYPES.some((t) => t.value === st);
  return {
    name: s.name,
    supplier_code: s.supplier_code ?? '',
    supplier_type: typeOk ? st : 'other',
    category: s.category ?? '',
    status:
      s.status === 'inactive' ? 'inactive' : s.status === 'blacklisted' ? 'blacklisted' : 'active',
    contact_name: s.contact_name ?? '',
    phone: s.phone ?? '',
    phone_secondary: s.phone_secondary ?? '',
    email: s.email ?? '',
    whatsapp: s.whatsapp ?? '',
    address: s.address ?? '',
    city: s.city ?? '',
    country: s.country ?? 'Maroc',
    products_supplied: s.products_supplied ?? '',
    avg_lead_days: s.avg_lead_days != null ? String(s.avg_lead_days) : '',
    min_order_amount: s.min_order_amount != null ? String(s.min_order_amount) : '',
    currency: s.currency ?? 'MAD',
    payment_terms: s.payment_terms ?? '',
    preferred_payment_mode: s.preferred_payment_mode ?? '',
    quality_score: s.quality_score != null ? String(s.quality_score) : '',
    frequent_delays: Boolean(s.frequent_delays),
    complaints_notes: s.complaints_notes ?? '',
    ice: s.ice ?? '',
    if_number: s.if_number ?? '',
    rc_number: s.rc_number ?? '',
    patente: s.patente ?? '',
    rib_iban: s.rib_iban ?? '',
    contract_reference: s.contract_reference ?? '',
    price_list_reference: s.price_list_reference ?? '',
    note: s.note ?? '',
  };
}

function draftToPayload(d: Draft): Record<string, unknown> {
  const parseNum = (v: string) => {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const parseIntOrNull = (v: string) => {
    const t = v.trim();
    if (t === '') return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
  };

  return {
    name: d.name.trim(),
    supplier_code: d.supplier_code.trim() || null,
    supplier_type: d.supplier_type,
    category: d.category.trim() || null,
    status: d.status,
    contact_name: d.contact_name.trim() || null,
    phone: d.phone.trim(),
    phone_secondary: d.phone_secondary.trim() || null,
    whatsapp: d.whatsapp.trim() || null,
    email: d.email.trim() || null,
    address: d.address.trim() || null,
    city: d.city.trim() || null,
    country: d.country.trim() || null,
    products_supplied: d.products_supplied.trim() || null,
    avg_lead_days: parseIntOrNull(d.avg_lead_days),
    min_order_amount: parseNum(d.min_order_amount),
    currency: d.currency.trim() || null,
    payment_terms: d.payment_terms.trim() || null,
    preferred_payment_mode: d.preferred_payment_mode.trim() || null,
    note: d.note.trim() || null,
    quality_score: parseNum(d.quality_score),
    frequent_delays: d.frequent_delays,
    complaints_notes: d.complaints_notes.trim() || null,
    ice: d.ice.trim() || null,
    if_number: d.if_number.trim() || null,
    rc_number: d.rc_number.trim() || null,
    patente: d.patente.trim() || null,
    rib_iban: d.rib_iban.trim() || null,
    contract_reference: d.contract_reference.trim() || null,
    price_list_reference: d.price_list_reference.trim() || null,
  };
}

const inputCls =
  'w-full px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500';

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-black text-zinc-900 border-b border-zinc-100 pb-2 mb-4 flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-xs font-black text-primary-800">{n}</span>
      {children}
    </h3>
  );
}

export function SuppliersScreen() {
  const { activeBrandId } = useBrand();
  const toast = useToast();
  const [rows, setRows] = useState<ApiSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [supplierPos, setSupplierPos] = useState<ApiPo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    const res = await api.get<LaravelPaginator<ApiSupplier>>('suppliers?per_page=100');
    setLoading(false);
    if (res.ok && isPaginator<ApiSupplier>(res.data)) setRows(res.data.data);
    else if (!res.ok) toast.error(res.message);
  }, [activeBrandId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((s) => s.id === openId) ?? null, [rows, openId]);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!openId || !activeBrandId) {
        setSupplierPos([]);
        return;
      }
      const res = await api.get<LaravelPaginator<ApiPo>>(`purchase-orders?supplier_id=${openId}&per_page=50`);
      if (c || !res.ok || !isPaginator<ApiPo>(res.data)) return;
      setSupplierPos(res.data.data);
    })();
    return () => {
      c = true;
    };
  }, [openId, activeBrandId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((x) =>
      `${x.name} ${x.contact_name ?? ''} ${x.phone ?? ''} ${x.city ?? ''} ${x.supplier_code ?? ''}`.toLowerCase().includes(s),
    );
  }, [rows, q]);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  }

  function startEdit(s: ApiSupplier) {
    setEditingId(s.id);
    setDraft(rowToDraft(s));
    setModalOpen(true);
  }

  async function saveSupplier() {
    if (!draft.name.trim()) {
      toast.error('Le nom fournisseur est obligatoire.');
      return;
    }
    if (!draft.phone.trim()) {
      toast.error('Le téléphone principal est obligatoire.');
      return;
    }
    if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      toast.error('Adresse e-mail invalide.');
      return;
    }

    const body = draftToPayload(draft);
    const res = editingId
      ? await api.put<ApiSupplier>(`suppliers/${editingId}`, body)
      : await api.post<ApiSupplier>('suppliers', body);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success(editingId ? 'Fournisseur mis à jour.' : 'Fournisseur créé.');
    setModalOpen(false);
    void load();
  }

  const kpis = useMemo(() => {
    const active = rows.filter((s) => s.status === 'active').length;
    return { active, total: rows.length };
  }, [rows]);

  function statusTone(st: string): 'success' | 'neutral' | 'danger' {
    if (st === 'active') return 'success';
    if (st === 'blacklisted') return 'danger';
    return 'neutral';
  }

  function statusLabel(st: string): string {
    if (st === 'active') return 'Actif';
    if (st === 'blacklisted') return 'Blacklisté';
    return 'Inactif';
  }

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs"
        subtitle="Fiches fournisseurs par marque — identification, contact, conditions commerciales, qualité et pièces."
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
            <button type="button" onClick={startCreate} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nouveau fournisseur
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase text-zinc-400">Actifs</p>
          <p className="text-2xl font-black text-zinc-900">{kpis.active}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase text-zinc-400">Total</p>
          <p className="text-2xl font-black text-zinc-900">{kpis.total}</p>
        </div>
      </div>

      <FilterBar query={q} onQueryChange={setQ} right={<span className="text-sm font-black">{loading ? '…' : `${filtered.length}`}</span>} />

      {filtered.length === 0 && !loading ? (
        <EmptyState title="Aucun fournisseur" description="Créez votre premier fournisseur pour cette marque." />
      ) : (
        <DataTable
          rows={filtered}
          columns={[
            {
              key: 'name',
              header: 'Nom',
              cell: (s) => (
                <button type="button" onClick={() => setOpenId(s.id)} className="font-black text-primary-600 hover:underline text-left">
                  {s.name}
                </button>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              cell: (s) => <span className="font-bold text-zinc-700">{labelSupplierType(s.supplier_type ?? 'other')}</span>,
            },
            { key: 'city', header: 'Ville', cell: (s) => <span className="font-bold">{s.city ?? '—'}</span> },
            { key: 'contact', header: 'Contact', cell: (s) => <span className="font-bold">{s.contact_name ?? '—'}</span> },
            { key: 'phone', header: 'Téléphone', cell: (s) => <span className="font-bold">{s.phone ?? '—'}</span> },
            {
              key: 'status',
              header: 'Statut',
              cell: (s) => <StatusChip tone={statusTone(s.status)}>{statusLabel(s.status)}</StatusChip>,
            },
            {
              key: 'edit',
              header: '',
              cell: (s) => (
                <button type="button" onClick={() => startEdit(s)} className="text-sm font-black text-zinc-600 hover:text-primary-600">
                  Modifier
                </button>
              ),
            },
          ]}
        />
      )}

      <Drawer open={!!selected} onClose={() => setOpenId(null)} title={selected?.name ?? ''}>
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-400">Type</p>
                <p className="font-bold text-zinc-900">{labelSupplierType(selected.supplier_type)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-400">Statut</p>
                <StatusChip tone={statusTone(selected.status)}>{statusLabel(selected.status)}</StatusChip>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">Commandes</p>
              <p className="font-bold text-zinc-800">
                {selected.purchase_orders_count ?? 0} BC
                {selected.purchase_orders_max_created_at
                  ? ` · Dernière : ${new Date(selected.purchase_orders_max_created_at).toLocaleDateString('fr-FR')}`
                  : ''}
              </p>
            </div>
            {selected.products_supplied ? (
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">Produits fournis</p>
                <p className="font-medium text-zinc-700 whitespace-pre-wrap">{selected.products_supplied}</p>
              </div>
            ) : null}
            {selected.note ? (
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-400 mb-1">Notes internes</p>
                <p className="font-medium text-zinc-700 whitespace-pre-wrap">{selected.note}</p>
              </div>
            ) : null}
            <div>
              <p className="text-xs font-black uppercase text-zinc-400 mb-2">BC récents</p>
              <div className="space-y-2">
                {supplierPos.map((p) => (
                  <div key={p.id} className="flex justify-between card-muted p-3 text-sm font-bold">
                    <span>{p.reference}</span>
                    <span>{formatCurrency(parseFloat(p.total_amount))}</span>
                  </div>
                ))}
                {supplierPos.length === 0 && <p className="text-sm text-zinc-500">Aucun BC.</p>}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Modifier fournisseur' : 'Nouveau fournisseur'}
        subtitle="Champs * obligatoires · Les autres enrichissent la fiche et les suivis."
        panelClassName="max-w-4xl max-h-[92vh] flex flex-col"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700">
              Annuler
            </button>
            <button type="button" onClick={() => void saveSupplier()} className="px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-black shadow-md">
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="max-h-[calc(92vh-12rem)] overflow-y-auto pr-1 space-y-8 -mr-1">
          <section>
            <SectionTitle n={1}>Identification</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Nom fournisseur *</label>
                <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} className={inputCls} placeholder="Raison sociale" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Code fournisseur</label>
                <input value={draft.supplier_code} onChange={(e) => patch({ supplier_code: e.target.value })} className={inputCls} placeholder="Code interne" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Type fournisseur *</label>
                <select
                  value={draft.supplier_type}
                  onChange={(e) => patch({ supplier_type: e.target.value as SupplierTypeSlug })}
                  className={inputCls}
                >
                  {SUPPLIER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Catégorie</label>
                <input value={draft.category} onChange={(e) => patch({ category: e.target.value })} className={inputCls} placeholder="ex. Textile, Emballage…" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Statut</label>
                <select value={draft.status} onChange={(e) => patch({ status: e.target.value as Draft['status'] })} className={inputCls}>
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="blacklisted">Blacklisté</option>
                </select>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle n={2}>Contact</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Nom contact principal</label>
                <input value={draft.contact_name} onChange={(e) => patch({ contact_name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Téléphone *</label>
                <input value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} className={inputCls} placeholder="+212 …" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Téléphone secondaire</label>
                <input value={draft.phone_secondary} onChange={(e) => patch({ phone_secondary: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">E-mail</label>
                <input type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">WhatsApp</label>
                <input value={draft.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value })} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Adresse</label>
                <textarea value={draft.address} onChange={(e) => patch({ address: e.target.value })} rows={2} className={`${inputCls} resize-y min-h-[72px]`} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Ville</label>
                <input value={draft.city} onChange={(e) => patch({ city: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Pays</label>
                <input value={draft.country} onChange={(e) => patch({ country: e.target.value })} className={inputCls} />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle n={3}>Informations commerciales</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Produits fournis</label>
                <textarea
                  value={draft.products_supplied}
                  onChange={(e) => patch({ products_supplied: e.target.value })}
                  rows={3}
                  className={`${inputCls} resize-y`}
                  placeholder="Références, familles de produits…"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Délai moyen de livraison (jours)</label>
                <input value={draft.avg_lead_days} onChange={(e) => patch({ avg_lead_days: e.target.value })} className={inputCls} inputMode="numeric" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Montant minimum de commande</label>
                <input value={draft.min_order_amount} onChange={(e) => patch({ min_order_amount: e.target.value })} className={inputCls} inputMode="decimal" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Devise</label>
                <input value={draft.currency} onChange={(e) => patch({ currency: e.target.value })} className={inputCls} placeholder="MAD" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Conditions de paiement</label>
                <textarea value={draft.payment_terms} onChange={(e) => patch({ payment_terms: e.target.value })} rows={2} className={`${inputCls} resize-y`} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Mode de paiement préféré</label>
                <input
                  value={draft.preferred_payment_mode}
                  onChange={(e) => patch({ preferred_payment_mode: e.target.value })}
                  className={inputCls}
                  placeholder="Virement, chèque, L/C…"
                />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle n={4}>Qualité &amp; suivi</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Note interne (score 0–10)</label>
                <input value={draft.quality_score} onChange={(e) => patch({ quality_score: e.target.value })} className={inputCls} inputMode="decimal" placeholder="ex. 8.5" />
              </div>
              <label className="flex items-center gap-3 md:col-span-2 cursor-pointer rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
                <input type="checkbox" checked={draft.frequent_delays} onChange={(e) => patch({ frequent_delays: e.target.checked })} className="h-4 w-4 rounded border-zinc-300" />
                <span className="text-sm font-bold text-zinc-800">Retards fréquents</span>
              </label>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Réclamations / incidents</label>
                <textarea value={draft.complaints_notes} onChange={(e) => patch({ complaints_notes: e.target.value })} rows={3} className={`${inputCls} resize-y`} />
              </div>
              <div className="md:col-span-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-3 text-xs font-medium text-zinc-500">
                Nombre de commandes et dernière commande sont calculés automatiquement à partir des bons de commande liés.
              </div>
            </div>
          </section>

          <section>
            <SectionTitle n={5}>Documents &amp; références</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">ICE</label>
                <input value={draft.ice} onChange={(e) => patch({ ice: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">IF</label>
                <input value={draft.if_number} onChange={(e) => patch({ if_number: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">RC</label>
                <input value={draft.rc_number} onChange={(e) => patch({ rc_number: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Patente</label>
                <input value={draft.patente} onChange={(e) => patch({ patente: e.target.value })} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">RIB / IBAN</label>
                <textarea value={draft.rib_iban} onChange={(e) => patch({ rib_iban: e.target.value })} rows={2} className={`${inputCls} resize-y font-mono text-xs`} />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Réf. contrat fournisseur</label>
                <input value={draft.contract_reference} onChange={(e) => patch({ contract_reference: e.target.value })} className={inputCls} placeholder="N° dossier ou lien interne" />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-zinc-500 mb-1">Réf. fiche prix</label>
                <input value={draft.price_list_reference} onChange={(e) => patch({ price_list_reference: e.target.value })} className={inputCls} />
              </div>
            </div>
          </section>

          <section>
            <SectionTitle n={6}>Notes internes</SectionTitle>
            <textarea value={draft.note} onChange={(e) => patch({ note: e.target.value })} rows={4} className={`${inputCls} resize-y`} placeholder="Commentaires libres, historique relationnel…" />
          </section>
        </div>
      </Modal>
    </div>
  );
}
