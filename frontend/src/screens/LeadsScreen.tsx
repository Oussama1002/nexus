import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, MessageSquare, Plus, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import type { Lead, User } from '../types';
import type { OrderDraft } from '../domain/orders';
import { trackSession } from '../lib/session';
import { cn } from '../lib/utils';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';

type ApiLead = {
  id: number;
  brand_id: number;
  customer_id: number | null;
  assigned_user_id: number | null;
  source: string | null;
  status: string;
  estimated_value: string | null;
  product_interest?: string | null;
  interest_level?: string | null;
  notes: string | null;
  created_at: string;
  customer?: { full_name: string; phone: string; city?: string | null; address?: string | null; gender?: string | null } | null;
  assigned_user?: { id: number; name: string } | null;
  conversation?: { assigned_user?: { id: number; name: string } | null } | null;
};

type ApiUserRow = { id: number; name: string; email: string };

type ApiProductRow = { id: number; name: string };

const LEAD_SOURCE_OPTIONS = [
  'Meta',
  'Instagram',
  'TikTok',
  'Site web',
  'WhatsApp',
  'Google',
  'Référence client',
  'Salon / événement',
  'Autre',
] as const;

const INTEREST_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'faible', label: 'Faible' },
  { value: 'moyen', label: 'Moyen' },
  { value: 'eleve', label: 'Élevé' },
  { value: 'tres_eleve', label: 'Très élevé' },
];

const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'female', label: 'Femme' },
  { value: 'male', label: 'Homme' },
  { value: 'other', label: 'Autre' },
];

function interestLevelLabel(code: string | null | undefined): string {
  if (!code) return '—';
  const row = INTEREST_LEVEL_OPTIONS.find((o) => o.value === code);
  return row?.label ?? code;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function mapLead(l: ApiLead, brandName: string): Lead {
  return {
    id: String(l.id),
    name: l.customer?.full_name ?? '—',
    phone: l.customer?.phone ?? '—',
    brand: brandName,
    status: l.status,
    agent: l.assigned_user?.name ?? l.conversation?.assigned_user?.name ?? '—',
    createdAt: fmtDate(l.created_at),
    price: Number(l.estimated_value ?? 0),
    source: l.source ?? '—',
    customerId: l.customer_id ?? undefined,
  };
}

function KpiDot({ tone }: { tone?: 'success' | 'info' | 'danger' | 'warning' | 'neutral' }) {
  const cls =
    tone === 'success'
      ? 'bg-emerald-600'
      : tone === 'info'
        ? 'bg-blue-600'
        : tone === 'danger'
          ? 'bg-rose-600'
          : tone === 'warning'
            ? 'bg-amber-600'
            : 'bg-zinc-300';
  return <span className={cn('w-2 h-2 rounded-full shrink-0', cls)} aria-hidden="true" />;
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'success' | 'info' | 'danger' | 'warning' | 'neutral' }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="text-2xl font-black text-zinc-900">{value}</p>
        <KpiDot tone={tone} />
      </div>
    </div>
  );
}

export function LeadsScreen({
  onOpenConversation,
  onCreateOrderFromLead,
}: {
  onOpenConversation: (leadId: string) => void;
  onCreateOrderFromLead: (draft: Partial<OrderDraft>) => void;
}) {
  const { brands, activeBrandId, activeBrand } = useBrand();
  const { user, hasPermission } = useAuth();
  const toast = useToast();

  const brandNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const b of brands) m[b.id] = b.name;
    return m;
  }, [brands]);

  const [loading, setLoading] = useState(true);
  const [apiLeads, setApiLeads] = useState<ApiLead[]>([]);
  const [users, setUsers] = useState<ApiUserRow[]>([]);
  const [leadProducts, setLeadProducts] = useState<ApiProductRow[]>([]);

  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<string>('Marque active');
  const [status, setStatus] = useState<string>('Tous');
  const [source, setSource] = useState<string>('Toutes');
  const [confirmatrice, setConfirmatrice] = useState<string>('Toutes');
  const [openId, setOpenId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createErr, setCreateErr] = useState<string[]>([]);

  const emptyLeadForm = useCallback(
    () => ({
      brand_id: activeBrandId || '',
      full_name: '',
      phone: '',
      city: '',
      address: '',
      gender: '',
      source_preset: 'WhatsApp',
      source_other: '',
      product_select: '',
      product_other: '',
      interest_level: '',
    }),
    [activeBrandId],
  );

  const [newLead, setNewLead] = useState({
    brand_id: '',
    full_name: '',
    phone: '',
    city: '',
    address: '',
    gender: '',
    source_preset: 'WhatsApp' as (typeof LEAD_SOURCE_OPTIONS)[number],
    source_other: '',
    product_select: '',
    product_other: '',
    interest_level: '',
  });

  const [assignUserId, setAssignUserId] = useState<string>('');
  const [convertLines, setConvertLines] = useState<{ product_name: string; quantity: number; unit_price: number; product_id: string }[]>([
    { product_name: 'Ligne 1', quantity: 1, unit_price: 0, product_id: '' },
  ]);

  const activeBrandName = activeBrand.name;

  const loadLeads = useCallback(async () => {
    if (!activeBrandId) {
      setApiLeads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ per_page: '100' });
    if (status !== 'Tous') params.set('status', status);
    const res = await api.get<LaravelPaginator<ApiLead>>(`leads?${params.toString()}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setApiLeads([]);
      return;
    }
    setApiLeads(isPaginator<ApiLead>(res.data) ? res.data.data : []);
  }, [activeBrandId, status, toast]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const uRes = await api.get<LaravelPaginator<ApiUserRow>>('users?per_page=100');
      if (cancelled) return;
      if (uRes.ok && isPaginator<ApiUserRow>(uRes.data)) {
        setUsers(uRes.data.data);
      } else {
        setUsers(user ? [{ id: Number(user.id), name: user.name, email: user.email }] : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!createOpen || !newLead.brand_id) {
      setLeadProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await api.get<LaravelPaginator<ApiProductRow>>(`products?per_page=100`, { brandId: newLead.brand_id });
      if (cancelled) return;
      if (res.ok && isPaginator<ApiProductRow>(res.data)) setLeadProducts(res.data.data);
      else setLeadProducts([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, newLead.brand_id]);

  useEffect(() => {
    if (createOpen) {
      setNewLead(emptyLeadForm());
      setCreateErr([]);
      setQ(''); // Clear search filter to avoid confusion with phone input
    }
  }, [createOpen, emptyLeadForm]);

  const leads: Lead[] = useMemo(
    () => apiLeads.map((l) => mapLead(l, brandNameById[String(l.brand_id)] ?? '—')),
    [apiLeads, brandNameById],
  );

  const legacyUsers: User[] = useMemo(
    () =>
      users.map((u) => ({
        id: String(u.id),
        name: u.name,
        email: u.email,
        role: 'confirmatrice',
      })),
    [users],
  );

  const statusOptions = useMemo(() => ['Tous', 'new', 'contacted', 'qualified', 'confirmed', 'lost', 'archived'], []);
  const sources = useMemo(() => ['Toutes', ...Array.from(new Set(leads.map((l) => l.source))).sort()], [leads]);
  const confirmatrices = useMemo(
    () => ['Toutes', ...legacyUsers.filter((u) => u.role === 'confirmatrice').map((u) => u.name)],
    [legacyUsers],
  );
  const brandOptions = useMemo(() => ['Marque active', 'Toutes', ...brands.map((b) => b.name)], [brands]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads.filter((l) => {
      const brandMatch =
        brand === 'Toutes' ? true : brand === 'Marque active' ? l.brand === activeBrandName : l.brand === brand;
      if (!brandMatch) return false;
      if (status !== 'Tous' && l.status !== status) return false;
      if (source !== 'Toutes' && l.source !== source) return false;
      if (confirmatrice !== 'Toutes' && l.agent !== confirmatrice) return false;
      if (!s) return true;
      const blob = `${l.name} ${l.phone} ${l.brand} ${l.source} ${l.status} ${l.agent}`.toLowerCase();
      return blob.includes(s);
    });
  }, [leads, q, brand, status, source, confirmatrice, activeBrandName]);

  const kpis = useMemo(() => {
    const scope = filtered;
    const by = (st: string) => scope.filter((x) => x.status === st).length;
    return {
      newLeads: by('new'),
      inProgress: by('contacted'),
      confirmed: by('confirmed'),
      lost: by('lost'),
      noAnswer: by('contacted'),
      upsell: Math.max(0, Math.round(by('confirmed') * 0.15)),
    };
  }, [filtered]);

  const selected = useMemo(() => leads.find((l) => l.id === openId) ?? null, [leads, openId]);
  const selectedApi = useMemo(() => apiLeads.find((l) => String(l.id) === openId) ?? null, [apiLeads, openId]);

  useEffect(() => {
    if (selectedApi?.assigned_user_id) setAssignUserId(String(selectedApi.assigned_user_id));
    else setAssignUserId('');
  }, [selectedApi]);

  useEffect(() => {
    if (selectedApi) {
      const v = Number(selectedApi.estimated_value ?? 0);
      setConvertLines([{ product_name: 'Commande lead', quantity: 1, unit_price: v || 0, product_id: '' }]);
    }
  }, [selectedApi]);

  async function assignLead() {
    if (!selected) return;
    const res = await api.post(`leads/${selected.id}/assign`, { assigned_user_id: assignUserId ? Number(assignUserId) : null });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Assignation mise à jour.');
    await loadLeads();
  }

  async function patchLeadStatus(next: string) {
    if (!selected) return;
    const res = await api.patch(`leads/${selected.id}/status`, { status: next });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Statut lead mis à jour.');
    setOpenId(null);
    await loadLeads();
  }

  async function convertLead() {
    if (!selected) return;
    const lines = convertLines.map((l) => ({
      product_name: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      product_id: l.product_id ? Number(l.product_id) : undefined,
    }));
    const res = await api.post(`leads/${selected.id}/convert-to-order`, {
      lines,
      shipping_fee: 0,
      discount: 0,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Lead converti en commande.');
    setOpenId(null);
    await loadLeads();
  }

  async function createLead() {
    const bid = newLead.brand_id || activeBrandId;
    if (!bid) {
      setCreateErr(['Choisissez une marque.']);
      return;
    }

    const sourceRaw =
      newLead.source_preset === 'Autre'
        ? newLead.source_other.trim()
        : newLead.source_preset;

    if (!newLead.full_name.trim() || !newLead.phone.trim() || !newLead.city.trim()) {
      setCreateErr(['Remplissez le nom complet, le téléphone principal et la ville.']);
      return;
    }
    if (!sourceRaw) {
      setCreateErr(['Indiquez la source du lead.']);
      return;
    }
    if (newLead.source_preset === 'Autre' && !newLead.source_other.trim()) {
      setCreateErr(['Précisez la source (champ libre pour « Autre »).']);
      return;
    }

    const productInterest =
      newLead.product_other.trim() || (newLead.product_select ? newLead.product_select : '') || null;

    setCreateSaving(true);
    setCreateErr([]);
    const res = await api.post<ApiLead>(
      'leads',
      {
        customer: {
          full_name: newLead.full_name.trim(),
          phone: newLead.phone.trim(),
          city: newLead.city.trim(),
          address: newLead.address.trim() || null,
          gender: newLead.gender || null,
        },
        source: sourceRaw,
        product_interest: productInterest,
        interest_level: newLead.interest_level || null,
        status: 'new',
      },
      { brandId: bid },
    );
    setCreateSaving(false);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      setCreateErr(fe.length ? fe : [res.message]);
      toast.error(res.message);
      return;
    }
    toast.success('Lead créé.');
    setCreateOpen(false);
    setNewLead(emptyLeadForm());
    await loadLeads();
  }

  if (!activeBrandId) {
    return <EmptyState title="Marque requise" description="Choisissez une marque active pour charger les leads." />;
  }

  if (!hasPermission('leads.view')) {
    return <EmptyState title="Accès refusé" description="Permission leads.view requise." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle="Liste, assignation, statut et conversion connectées à l’API."
        right={
          hasPermission('leads.create') ? (
            <button
              type="button"
              onClick={() => {
                setCreateErr([]);
                setCreateOpen(true);
              }}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nouveau lead
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Kpi label="Nouveaux leads" value={kpis.newLeads} tone="info" />
        <Kpi label="En cours" value={kpis.inProgress} />
        <Kpi label="Confirmés" value={kpis.confirmed} tone="success" />
        <Kpi label="Perdus" value={kpis.lost} tone="danger" />
        <Kpi label="Sans réponse" value={kpis.noAnswer} tone="warning" />
        <Kpi label="Upsell potentiels" value={kpis.upsell} tone="info" />
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <div className="flex items-center gap-3 flex-wrap">
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={confirmatrice} onChange={(e) => setConfirmatrice(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {confirmatrices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        }
        right={<div className="text-sm font-black text-zinc-700">{filtered.length} leads</div>}
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : (
        <DataTable<Lead>
          rows={filtered}
          columns={[
            {
              key: 'who',
              header: 'Nom / téléphone',
              cell: (l) => (
                <button type="button" onClick={() => setOpenId(l.id)} className="text-left">
                  <p className="font-black text-zinc-900">{l.name}</p>
                  <p className="text-xs font-bold text-zinc-500">{l.phone}</p>
                </button>
              ),
            },
            { key: 'brand', header: 'Marque', cell: (l) => <span className="font-bold text-zinc-700">{l.brand}</span> },
            { key: 'source', header: 'Source', cell: (l) => <span className="font-bold text-zinc-700">{l.source}</span> },
            { key: 'agent', header: 'Assigné', cell: (l) => <span className="font-bold text-zinc-700">{l.agent}</span> },
            {
              key: 'status',
              header: 'Statut',
              cell: (l) => (
                <StatusChip tone={l.status === 'confirmed' ? 'success' : l.status === 'lost' ? 'danger' : l.status === 'new' ? 'info' : 'neutral'}>
                  {l.status}
                </StatusChip>
              ),
            },
            { key: 'createdAt', header: 'Date création', cell: (l) => <span className="font-bold text-zinc-700">{l.createdAt}</span> },
          ]}
          emptyTitle="Aucun lead"
          emptyDescription="Créez un lead ou ajustez les filtres."
        />
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setOpenId(null)}
        title={selected ? selected.name : ''}
        subtitle={selected ? `${selected.phone} • ${selected.brand}` : ''}
        footer={
          selected && (
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  trackSession({ name: 'audit.leads.open_conversation', ts: Date.now(), meta: { leadId: selected.id } });
                  onOpenConversation(selected.id);
                }}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Ouvrir conv
              </button>
              {hasPermission('leads.update') && (
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Assigner à</label>
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-800"
                  >
                    <option value="">— Non assigné —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void assignLead()} className="py-2 rounded-xl bg-zinc-900 text-white text-sm font-black">
                    Enregistrer assignation
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  trackSession({ name: 'audit.leads.create_order', ts: Date.now(), meta: { leadId: selected.id } });
                  onCreateOrderFromLead({
                    brand: selected.brand,
                    source: selected.source,
                    customerName: selected.name,
                    phone: selected.phone,
                    city: 'Casablanca',
                    customerId: selected.customerId,
                    leadId: Number(selected.id),
                  });
                }}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
              >
                Préparer commande (UI)
              </button>
              {hasPermission('leads.update') && (
                <>
                  <div className="card-muted p-3 space-y-2">
                    <p className="text-[10px] font-black uppercase text-zinc-500">Convertir en commande (API)</p>
                    {convertLines.map((ln, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                        <input
                          className="col-span-5 px-2 py-2 rounded-lg border border-zinc-200 text-xs font-bold"
                          value={ln.product_name}
                          onChange={(e) =>
                            setConvertLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product_name: e.target.value } : x)))
                          }
                        />
                        <input
                          type="number"
                          className="col-span-2 px-2 py-2 rounded-lg border border-zinc-200 text-xs font-bold"
                          value={ln.quantity}
                          onChange={(e) =>
                            setConvertLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))
                          }
                        />
                        <input
                          type="number"
                          className="col-span-2 px-2 py-2 rounded-lg border border-zinc-200 text-xs font-bold"
                          value={ln.unit_price}
                          onChange={(e) =>
                            setConvertLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_price: Number(e.target.value) } : x)))
                          }
                        />
                        <input
                          className="col-span-3 px-2 py-2 rounded-lg border border-zinc-200 text-xs font-bold"
                          placeholder="product_id"
                          value={ln.product_id}
                          onChange={(e) =>
                            setConvertLines((prev) => prev.map((x, i) => (i === idx ? { ...x, product_id: e.target.value } : x)))
                          }
                        />
                      </div>
                    ))}
                    <button type="button" onClick={() => void convertLead()} className="w-full py-2 rounded-xl bg-emerald-600 text-white text-sm font-black">
                      Convertir (API)
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void patchLeadStatus('lost')}
                    className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 bg-white text-sm font-black hover:bg-rose-50 inline-flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Marquer perdu
                  </button>
                </>
              )}
              <button type="button" className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center justify-center gap-2">
                <CalendarClock className="w-4 h-4" /> Programmer rappel
              </button>
            </div>
          )
        }
      >
        {selected && selectedApi && (
          <div className="space-y-5">
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Contact</p>
              <div className="mt-3 space-y-2 text-sm font-bold text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Marque</span>
                  <span className="text-zinc-900">{selected.brand}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Source</span>
                  <span className="text-zinc-900">{selected.source}</span>
                </div>
                {selectedApi.product_interest ? (
                  <div className="flex items-center justify-between gap-2">
                    <span>Produit d’intérêt</span>
                    <span className="text-zinc-900 text-right truncate max-w-[55%]">{selectedApi.product_interest}</span>
                  </div>
                ) : null}
                {selectedApi.interest_level ? (
                  <div className="flex items-center justify-between">
                    <span>Niveau d’intérêt</span>
                    <span className="text-zinc-900">{interestLevelLabel(selectedApi.interest_level)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span>Statut</span>
                  <span className="text-zinc-900">{selected.status}</span>
                </div>
                {selectedApi.customer?.city ? (
                  <div className="flex items-center justify-between gap-2">
                    <span>Ville</span>
                    <span className="text-zinc-900">{selectedApi.customer.city}</span>
                  </div>
                ) : null}
                {selectedApi.notes ? (
                  <div>
                    <span className="block text-[10px] uppercase text-zinc-400">Notes</span>
                    <p className="mt-1 font-medium text-zinc-600">{selectedApi.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouveau lead"
        subtitle="Crée le contact et le lead sur la marque choisie (champs * obligatoires)."
        footer={
          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700">
              Annuler
            </button>
            <button
              type="button"
              disabled={
                createSaving ||
                !newLead.brand_id ||
                !newLead.full_name.trim() ||
                !newLead.phone.trim() ||
                !newLead.city.trim() ||
                (newLead.source_preset === 'Autre' && !newLead.source_other.trim())
              }
              onClick={() => void createLead()}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black disabled:opacity-50"
            >
              {createSaving ? '…' : 'Créer'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[min(70vh,560px)] overflow-y-auto pr-1">
          {createErr.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 space-y-1">
              {createErr.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Brand / Marque <span className="text-rose-600">*</span>
              </label>
              <select
                value={newLead.brand_id}
                onChange={(e) => setNewLead((s) => ({ ...s, brand_id: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-800"
              >
                <option value="">— Choisir —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Nom complet <span className="text-rose-600">*</span>
              </label>
              <input
                value={newLead.full_name}
                onChange={(e) => setNewLead((s) => ({ ...s, full_name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-medium text-zinc-900"
                placeholder="Prénom et nom"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Téléphone principal <span className="text-rose-600">*</span>
              </label>
              <input
                value={newLead.phone}
                onChange={(e) => setNewLead((s) => ({ ...s, phone: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-medium text-zinc-900"
                placeholder="+212…"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Ville <span className="text-rose-600">*</span>
              </label>
              <input
                value={newLead.city}
                onChange={(e) => setNewLead((s) => ({ ...s, city: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-medium text-zinc-900"
                placeholder="Ville"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Adresse</label>
              <textarea
                value={newLead.address}
                onChange={(e) => setNewLead((s) => ({ ...s, address: e.target.value }))}
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-medium text-zinc-900 resize-none"
                placeholder="Rue, quartier, complément…"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sexe</label>
              <select
                value={newLead.gender}
                onChange={(e) => setNewLead((s) => ({ ...s, gender: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-800"
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.label + o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Source du lead <span className="text-rose-600">*</span>
              </label>
              <select
                value={newLead.source_preset}
                onChange={(e) =>
                  setNewLead((s) => ({
                    ...s,
                    source_preset: e.target.value as (typeof LEAD_SOURCE_OPTIONS)[number],
                  }))
                }
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-800"
              >
                {LEAD_SOURCE_OPTIONS.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
              {newLead.source_preset === 'Autre' ? (
                <input
                  value={newLead.source_other}
                  onChange={(e) => setNewLead((s) => ({ ...s, source_other: e.target.value }))}
                  className="mt-2 w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 text-sm font-medium"
                  placeholder="Précisez la source"
                />
              ) : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Produit d’intérêt</label>
              <select
                value={newLead.product_select}
                onChange={(e) => setNewLead((s) => ({ ...s, product_select: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-800"
              >
                <option value="">— Catalogue (optionnel) —</option>
                {leadProducts.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                value={newLead.product_other}
                onChange={(e) => setNewLead((s) => ({ ...s, product_other: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 text-sm font-medium mt-2"
                placeholder="Ou saisie libre (prioritaire sur la liste)"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Niveau d’intérêt</label>
              <select
                value={newLead.interest_level}
                onChange={(e) => setNewLead((s) => ({ ...s, interest_level: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-800"
              >
                {INTEREST_LEVEL_OPTIONS.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
