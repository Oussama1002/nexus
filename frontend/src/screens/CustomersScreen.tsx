import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { CustomerFicheDrawer } from '../components/customers/CustomerFicheDrawer';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';
import {
  CLIENT_SOURCE_OPTIONS,
  CLIENT_TYPE_OPTIONS,
  INTEREST_LEVEL_OPTIONS,
  LANGUAGE_OPTIONS,
  LIFECYCLE_OPTIONS,
  PAYMENT_PREF_OPTIONS,
  customerToForm,
  emptyCustomerForm,
  formToApiPayload,
  labelFromOptions,
  type CustomerFormState,
} from '../lib/customerFormConstants';

type ApiCustomer = {
  id: number;
  brand_id: number;
  full_name: string;
  phone: string;
  email?: string | null;
  city?: string | null;
  lifecycle_status?: string | null;
  status: string;
  assigned_user?: { name: string } | null;
  latest_conversation?: { assigned_user?: { id: number; name: string } | null } | null;
};

type ApiLeadRow = { id: number; source: string | null; status: string; customer?: ApiCustomer | null };
type ApiLeadDetail = ApiLeadRow & {
  notes?: string | null;
  interest_level?: string | null;
  product_interest?: string | null;
  assigned_user_id?: number | null;
  customer?: Record<string, unknown> | null;
};

function mapLeadSourceToClientSource(src: string | null | undefined): string {
  if (!src) return '';
  const s = src.toLowerCase();
  if (s.includes('whatsapp')) return 'whatsapp';
  if (s.includes('ads') || s.includes('facebook') || s.includes('meta')) return 'ads';
  if (s.includes('influ')) return 'influencer';
  if (s.includes('site') || s.includes('web')) return 'site';
  if (s.includes('référence') || s.includes('ref')) return 'referral';
  return 'manual';
}

export function CustomersScreen() {
  const { activeBrandId, brands } = useBrand();
  const { hasPermission, fetchMe } = useAuth();

  const brandNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const b of brands) m[String(b.id)] = b.name;
    return m;
  }, [brands]);
  const toast = useToast();
  const canCreate = hasPermission('customers.create');
  const canUpdate = hasPermission('customers.update');

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ApiCustomer[]>([]);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiCustomer | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErr, setFieldErr] = useState<string[]>([]);

  const [ficheId, setFicheId] = useState<number | null>(null);

  const [createSource, setCreateSource] = useState<'manual' | 'lead'>('manual');
  const [leadsOpen, setLeadsOpen] = useState<ApiLeadRow[]>([]);
  const [leadSelectId, setLeadSelectId] = useState<string>('');

  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [usersOpts, setUsersOpts] = useState<{ id: number; name: string }[]>([]);

  const [form, setForm] = useState<CustomerFormState>(() => emptyCustomerForm());

  const load = useCallback(async () => {
    if (!activeBrandId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const statusParam = statusFilter === 'active' ? '' : statusFilter === 'archived' ? '&status=archived' : '&status=all';
    const res = await api.get<LaravelPaginator<ApiCustomer>>(`customers?per_page=100${statusParam}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setRows([]);
      return;
    }
    const page = res.data;
    setRows(isPaginator<ApiCustomer>(page) ? page.data : []);
  }, [activeBrandId, statusFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadLeadsOpen = useCallback(async () => {
    const res = await api.get<LaravelPaginator<ApiLeadRow>>('leads?without_customer=1&per_page=100');
    if (res.ok && isPaginator<ApiLeadRow>(res.data)) setLeadsOpen(res.data.data);
    else setLeadsOpen([]);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await api.get<LaravelPaginator<{ id: number; name: string }>>('users?per_page=100');
    if (res.ok && isPaginator(res.data)) setUsersOpts(res.data.data);
  }, []);

  useEffect(() => {
    if (modalOpen && createSource === 'lead') void loadLeadsOpen();
  }, [modalOpen, createSource, loadLeadsOpen]);

  useEffect(() => {
    if (modalOpen) void loadUsers();
  }, [modalOpen, loadUsers]);

  useEffect(() => {
    if (!modalOpen || createSource !== 'lead' || !leadSelectId) return;
    let c = false;
    (async () => {
      const res = await api.get<ApiLeadDetail>(`leads/${leadSelectId}`);
      if (c || !res.ok || !res.data) return;
      const lead = res.data as ApiLeadDetail;
      if (lead.customer && typeof lead.customer === 'object') {
        const merged = customerToForm(lead.customer as Record<string, unknown>);
        merged.origin_lead_id = String(lead.id);
        merged.client_source = merged.client_source || mapLeadSourceToClientSource(lead.source);
        merged.interest_level = merged.interest_level || lead.interest_level || '';
        merged.preferred_products = merged.preferred_products || lead.product_interest || '';
        merged.internal_notes = merged.internal_notes || lead.notes || '';
        if (lead.assigned_user_id) merged.assigned_user_id = String(lead.assigned_user_id);
        setForm(merged);
      } else {
        setForm({
          ...emptyCustomerForm(),
          origin_lead_id: String(lead.id),
          internal_notes: lead.notes ?? '',
          client_source: mapLeadSourceToClientSource(lead.source),
          interest_level: lead.interest_level ?? '',
          preferred_products: lead.product_interest ?? '',
          assigned_user_id: lead.assigned_user_id ? String(lead.assigned_user_id) : '',
        });
      }
    })();
    return () => {
      c = true;
    };
  }, [leadSelectId, modalOpen, createSource]);

  function openCreate() {
    setEditing(null);
    setFieldErr([]);
    setCreateSource('manual');
    setLeadSelectId('');
    setForm(emptyCustomerForm());
    setModalOpen(true);
  }

  function openEditFromFiche(c: ApiCustomer) {
    setEditing(c);
    setFieldErr([]);
    setCreateSource('manual');
    setLeadSelectId('');
    (async () => {
      const res = await api.get<{ customer: Record<string, unknown> }>(`customers/${c.id}`);
      if (res.ok && res.data?.customer) {
        setForm(customerToForm(res.data.customer));
      } else {
        setForm(customerToForm(c as unknown as Record<string, unknown>));
      }
      setModalOpen(true);
    })();
  }

  async function save() {
    if (!activeBrandId) return;
    if (!form.full_name.trim() || !form.phone.trim() || !form.city.trim()) {
      toast.error('Nom, téléphone et ville sont obligatoires.');
      return;
    }
    setSaving(true);
    setFieldErr([]);
    const payload = formToApiPayload(form, {
      includeOriginLead: !editing && createSource === 'lead' && !!form.origin_lead_id,
    });
    const res = editing
      ? await api.put<ApiCustomer>(`customers/${editing.id}`, payload)
      : await api.post<ApiCustomer>('customers', payload);
    setSaving(false);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const lines = flattenFieldErrors(rawErr as Record<string, unknown>);
      setFieldErr(lines.length ? lines : [res.message]);
      toast.error(res.message);
      return;
    }
    toast.success(editing ? 'Client mis à jour.' : 'Client créé.');
    setModalOpen(false);
    await load();
    void fetchMe();
    if (ficheId && editing?.id === ficheId) setFicheId(ficheId);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.phone.toLowerCase().includes(s) ||
        (c.email ?? '').toLowerCase().includes(s),
    );
  }, [rows, q]);

  const selCustomer = useMemo(() => rows.find((r) => r.id === ficheId) ?? null, [rows, ficheId]);

  const inputCls =
    'w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium';

  if (!activeBrandId) {
    return <EmptyState title="Choisir une marque" description="Sélectionnez une marque active pour gérer les clients." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Fiches clients complètes — identité, livraison, CRM, préférences."
        right={
          canCreate ? (
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nouveau client
            </button>
          ) : null
        }
      />

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'active' | 'archived' | 'all')}
            className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-700"
          >
            <option value="active">Actifs</option>
            <option value="archived">Archivés</option>
            <option value="all">Tous</option>
          </select>
        }
        right={<span className="text-sm font-black text-zinc-700">{filtered.length} clients</span>}
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : (
        <DataTable<ApiCustomer>
          rows={filtered}
          columns={[
            {
              key: 'name',
              header: 'Client',
              cell: (c) => (
                <button
                  type="button"
                  onClick={() => setFicheId(c.id)}
                  className="text-left w-full"
                >
                  <p className="font-black text-zinc-900">{c.full_name}</p>
                  <p className="text-xs font-bold text-zinc-500">{c.phone}</p>
                </button>
              ),
            },
            { key: 'brand', header: 'Marque', cell: (c) => <span className="font-bold text-zinc-700">{brandNameById[String(c.brand_id)] ?? '—'}</span> },
            { key: 'city', header: 'Ville', cell: (c) => <span className="font-bold text-zinc-700">{c.city ?? '—'}</span> },
            { key: 'email', header: 'Email', cell: (c) => <span className="font-bold text-zinc-700">{c.email ?? '—'}</span> },
            {
              key: 'lifecycle',
              header: 'Statut',
              cell: (c) => (
                <span className="text-xs font-bold">
                  {labelFromOptions(
                    LIFECYCLE_OPTIONS as unknown as { value: string; label: string }[],
                    (c.lifecycle_status as string) || (c.status === 'blacklisted' ? 'blacklisted' : c.status === 'inactive' ? 'inactive' : 'active'),
                  )}
                </span>
              ),
            },
            {
              key: 'assign',
              header: 'Assigné',
              cell: (c) => {
                const name = c.assigned_user?.name ?? c.latest_conversation?.assigned_user?.name;
                return <span className={`text-xs font-bold ${name ? 'text-zinc-700' : 'text-zinc-400'}`}>{name ?? '—'}</span>;
              },
            },
          ]}
          emptyTitle="Aucun client"
          emptyDescription="Créez un client ou convertissez un lead."
        />
      )}

      <CustomerFicheDrawer
        customerId={ficheId}
        open={ficheId !== null}
        onClose={() => setFicheId(null)}
        canUpdate={canUpdate}
        onArchive={() => { toast.success('Client mis à jour.'); void load(); }}
        onDelete={() => { toast.success('Client supprimé définitivement.'); void load(); }}
        onEdit={() => {
          if (selCustomer) {
            setFicheId(null);
            openEditFromFiche(selCustomer);
          }
        }}
      />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        panelClassName="max-w-4xl"
        title={editing ? 'Modifier la fiche client' : 'Nouveau client'}
        subtitle={
          editing
            ? 'Mettre à jour les informations essentielles.'
            : createSource === 'lead'
              ? 'Convertir un lead sans client lié, ou saisie libre (onglet Manuel).'
              : 'Création libre — tous les champs optionnels sauf nom, téléphone, ville.'
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
              Annuler
            </button>
            <button
              type="button"
              disabled={saving || (!canCreate && !editing) || (editing && !canUpdate)}
              onClick={() => void save()}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[min(78vh,720px)] overflow-y-auto pr-1">
          {fieldErr.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 space-y-1">
              {fieldErr.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}

          {!editing && (
            <div className="flex gap-2 border-b border-zinc-100 pb-3">
              {(['manual', 'lead'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setCreateSource(m);
                    setLeadSelectId('');
                    if (m === 'manual') setForm(emptyCustomerForm());
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${createSource === m ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-700'}`}
                >
                  {m === 'manual' ? 'Saisie libre' : 'Depuis un lead'}
                </button>
              ))}
            </div>
          )}

          {!editing && createSource === 'lead' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Sélectionner un lead (sans client)</label>
              <select
                value={leadSelectId}
                onChange={(e) => setLeadSelectId(e.target.value)}
                className={inputCls + ' font-bold'}
              >
                <option value="">— Choisir —</option>
                {leadsOpen.map((l) => (
                  <option key={l.id} value={l.id}>
                    #{l.id} · {l.source ?? '—'} ({l.status})
                  </option>
                ))}
              </select>
              {leadsOpen.length === 0 && <p className="text-xs text-amber-700">Aucun lead ouvert sans client. Utilisez la saisie libre.</p>}
            </div>
          )}

          <p className="text-[11px] font-black uppercase text-primary-700">Identité</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Nom complet *" value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <Field label="Téléphone principal *" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
            <Field label="Téléphone secondaire" value={form.phone_secondary} onChange={(v) => setForm((f) => ({ ...f, phone_secondary: v }))} />
            <Field label="Email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
            <Field label="Ville *" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
            <Field label="Quartier" value={form.neighborhood} onChange={(v) => setForm((f) => ({ ...f, neighborhood: v }))} />
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Adresse complète</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                rows={2}
                className={inputCls}
              />
            </div>
          </div>

          <p className="text-[11px] font-black uppercase text-primary-700 pt-2">Informations commerciales</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField
              label="Source client"
              value={form.client_source}
              onChange={(v) => setForm((f) => ({ ...f, client_source: v }))}
              options={CLIENT_SOURCE_OPTIONS}
            />
            <SelectField
              label="Statut client"
              value={form.lifecycle_status}
              onChange={(v) => setForm((f) => ({ ...f, lifecycle_status: v }))}
              options={LIFECYCLE_OPTIONS}
            />
            <SelectField
              label="Type client"
              value={form.client_type}
              onChange={(v) => setForm((f) => ({ ...f, client_type: v }))}
              options={CLIENT_TYPE_OPTIONS}
            />
            <SelectField
              label="Niveau d'intérêt"
              value={form.interest_level}
              onChange={(v) => setForm((f) => ({ ...f, interest_level: v }))}
              options={INTEREST_LEVEL_OPTIONS}
            />
            <SelectField
              label="Confirmatrice assignée"
              value={form.assigned_user_id}
              onChange={(v) => setForm((f) => ({ ...f, assigned_user_id: v }))}
              options={[{ value: '', label: '—' }, ...usersOpts.map((u) => ({ value: String(u.id), label: u.name }))]}
            />
          </div>

          <p className="text-[11px] font-black uppercase text-primary-700 pt-2">Livraison</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Ville livraison" value={form.delivery_city} onChange={(v) => setForm((f) => ({ ...f, delivery_city: v }))} />
            <Field label="Zone / région" value={form.delivery_zone} onChange={(v) => setForm((f) => ({ ...f, delivery_zone: v }))} />
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Adresse livraison par défaut</label>
              <textarea
                value={form.delivery_address}
                onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))}
                rows={2}
                className={inputCls}
              />
            </div>
            <Field label="Point de repère" value={form.delivery_landmark} onChange={(v) => setForm((f) => ({ ...f, delivery_landmark: v }))} />
            <Field label="Frais livraison par défaut (MAD)" value={form.default_shipping_fee} onChange={(v) => setForm((f) => ({ ...f, default_shipping_fee: v }))} />
          </div>

          <p className="text-[11px] font-black uppercase text-primary-700 pt-2">Notes & préférences</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Notes internes</label>
              <textarea
                value={form.internal_notes}
                onChange={(e) => setForm((f) => ({ ...f, internal_notes: e.target.value }))}
                rows={3}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Produits préférés</label>
              <textarea
                value={form.preferred_products}
                onChange={(e) => setForm((f) => ({ ...f, preferred_products: e.target.value }))}
                rows={2}
                className={inputCls}
              />
            </div>
            <Field label="Taille / couleur préférée" value={form.preferred_variant} onChange={(v) => setForm((f) => ({ ...f, preferred_variant: v }))} />
            <SelectField
              label="Langue préférée"
              value={form.preferred_language}
              onChange={(v) => setForm((f) => ({ ...f, preferred_language: v }))}
              options={LANGUAGE_OPTIONS}
            />
            <SelectField
              label="Préférence de paiement"
              value={form.preferred_payment}
              onChange={(v) => setForm((f) => ({ ...f, preferred_payment: v }))}
              options={PAYMENT_PREF_OPTIONS}
            />
          </div>

          <p className="text-[11px] font-black uppercase text-primary-700 pt-2">Risque / qualité</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Score client (0–100)" value={form.risk_score} onChange={(v) => setForm((f) => ({ ...f, risk_score: v }))} />
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-400">Motif blacklist (si applicable)</label>
              <textarea
                value={form.blacklist_reason}
                onChange={(e) => setForm((f) => ({ ...f, blacklist_reason: e.target.value }))}
                rows={2}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputCls =
    'w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium';
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase text-zinc-400">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  const inputCls =
    'w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium';
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase text-zinc-400">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls + ' font-bold'}>
        {options.map((o) => (
          <option key={`${o.value}-${o.label}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
