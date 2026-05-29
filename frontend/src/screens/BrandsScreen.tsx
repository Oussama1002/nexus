import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { cn, formatCurrency } from '../lib/utils';
import type { Brand } from '../types';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';

type BrandExt = Brand & {
  status?: 'Actif' | 'Inactif';
  code?: string;
  contact?: string;
  note?: string;
};

type ApiBrandRow = {
  id: number;
  name: string;
  code: string;
  status: string;
  whatsapp_number?: string | null;
  color?: string | null;
};

type ApiOrderRow = { id: number; total: string };

function toUiBrand(b: ApiBrandRow): BrandExt {
  const code = b.code ?? String(b.id);
  const initials = code.slice(0, 2).toUpperCase();
  const palette = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];
  const color = (b.color && /^#/.test(b.color) ? b.color : null) ?? palette[Math.abs(b.id) % palette.length];
  const statusFr: 'Actif' | 'Inactif' = b.status === 'active' ? 'Actif' : 'Inactif';
  return {
    id: String(b.id),
    name: b.name,
    logo: initials,
    color,
    whatsappNumber: b.whatsapp_number ?? '',
    status: statusFr,
    code,
    contact: '',
    note: '',
  };
}

function KpiDot({ tone }: { tone?: 'success' | 'info' | 'neutral' }) {
  const cls =
    tone === 'success' ? 'bg-emerald-600' : tone === 'info' ? 'bg-blue-600' : 'bg-zinc-300';
  return <span className={cn('w-2 h-2 rounded-full shrink-0', cls)} aria-hidden="true" />;
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'success' | 'info' | 'neutral' }) {
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

export function BrandsScreen() {
  const { brands: ctxBrands, activeBrandId, setActiveBrandId } = useBrand();
  const { fetchMe, hasPermission } = useAuth();
  const toast = useToast();
  const canMutate = hasPermission('brands.create') || hasPermission('brands.update');

  const [loading, setLoading] = useState(true);
  const [apiBrands, setApiBrands] = useState<ApiBrandRow[]>([]);
  const [statsByBrand, setStatsByBrand] = useState<Map<string, { orders: number; ca: number; products: number }>>(new Map());

  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErr, setFieldErr] = useState<string[]>([]);
  const [draft, setDraft] = useState<BrandExt>({
    id: '',
    name: '',
    logo: 'BR',
    color: '#4f46e5',
    whatsappNumber: '+212 ',
    status: 'Actif',
    code: '',
    contact: '',
    note: '',
  });

  const brands = useMemo(() => apiBrands.map(toUiBrand), [apiBrands]);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    const res = await api.get<LaravelPaginator<ApiBrandRow>>('brands?per_page=100');
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setApiBrands([]);
      return;
    }
    const page = res.data;
    setApiBrands(isPaginator<ApiBrandRow>(page) ? page.data : []);
  }, [toast]);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = new Map<string, { orders: number; ca: number; products: number }>();
      for (const b of apiBrands) {
        const bid = String(b.id);
        const [oRes, pRes] = await Promise.all([
          api.get<LaravelPaginator<ApiOrderRow>>('orders?per_page=100', { brandId: bid }),
          api.get<LaravelPaginator<{ id: number }>>('products?per_page=100', { brandId: bid }),
        ]);
        if (cancelled) return;
        let orders = 0;
        let ca = 0;
        if (oRes.ok && isPaginator<ApiOrderRow>(oRes.data)) {
          orders = oRes.data.total;
          ca = oRes.data.data.reduce((s, row) => s + Number(row.total), 0);
        }
        let products = 0;
        if (pRes.ok && isPaginator<{ id: number }>(pRes.data)) {
          products = pRes.data.total;
        }
        next.set(bid, { orders, ca, products });
      }
      if (!cancelled) setStatsByBrand(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBrands]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return brands.filter((b) => {
      if (!s) return true;
      const blob = `${b.name} ${b.whatsappNumber} ${b.code ?? ''} ${b.contact ?? ''}`.toLowerCase();
      return blob.includes(s);
    });
  }, [brands, q]);

  const selected = useMemo(() => brands.find((b) => b.id === openId) ?? null, [brands, openId]);

  const kpis = useMemo(() => {
    const active = brands.filter((b) => (b.status ?? 'Actif') === 'Actif').length;
    const wa = brands.filter((b) => Boolean(b.whatsappNumber?.trim())).length;
    const campaigns = brands.length * 2;
    const ca = brands.reduce((s, b) => s + (statsByBrand.get(b.id)?.ca ?? 0), 0);
    return { active, wa, campaigns, ca };
  }, [brands, statsByBrand]);

  function startCreate() {
    setFieldErr([]);
    setDraft({
      id: '',
      name: '',
      logo: 'BR',
      color: '#4f46e5',
      whatsappNumber: '+212 ',
      status: 'Actif',
      code: '',
      contact: '',
      note: '',
    });
    setModalOpen(true);
  }

  function startEdit(b: BrandExt) {
    setFieldErr([]);
    setDraft({ ...b });
    setModalOpen(true);
  }

  async function saveBrand() {
    setSaving(true);
    setFieldErr([]);
    const payload = {
      name: draft.name.trim(),
      code: (draft.code ?? '').trim(),
      whatsapp_number: draft.whatsappNumber?.trim() || null,
      color: draft.color || null,
      status: draft.status === 'Actif' ? 'active' : 'inactive',
    };
    const res = draft.id
      ? await api.put<ApiBrandRow>(`brands/${draft.id}`, payload)
      : await api.post<ApiBrandRow>('brands', payload);
    setSaving(false);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      setFieldErr(
        flattenFieldErrors(rawErr as Record<string, unknown>).length
          ? flattenFieldErrors(rawErr as Record<string, unknown>)
          : [res.message],
      );
      toast.error(res.message);
      return;
    }
    toast.success(draft.id ? 'Marque mise à jour.' : 'Marque créée.');
    setModalOpen(false);
    await loadBrands();
    await fetchMe();
  }

  if (!hasPermission('brands.view')) {
    return <EmptyState title="Accès refusé" description="Permission brands.view requise." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marques"
        subtitle="CRUD connecté à l’API (pagination locale sur cette page)."
        right={
          canMutate ? (
            <button
              type="button"
              onClick={startCreate}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Ajouter marque
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Marques actives" value={kpis.active} tone="success" />
        <Kpi label="Numéros WhatsApp" value={kpis.wa} tone="info" />
        <Kpi label="Campagnes liées" value={kpis.campaigns} />
        <Kpi label="CA (100 cmd max / marque)" value={formatCurrency(kpis.ca)} tone="info" />
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <div className="text-xs font-black text-zinc-400 uppercase tracking-widest">
            Marque active: <span className="text-zinc-700">{brands.find((b) => b.id === activeBrandId)?.name ?? ctxBrands[0]?.name ?? '—'}</span>
          </div>
        }
        right={
          <button
            type="button"
            onClick={() => {
              const b = brands.find((x) => x.id === activeBrandId);
              if (b) startEdit(b);
            }}
            className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
          >
            Éditer marque active
          </button>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : (
        <DataTable<BrandExt>
          rows={filtered}
          columns={[
            {
              key: 'brand',
              header: 'Marque',
              cell: (b) => (
                <button type="button" onClick={() => setOpenId(b.id)} className="flex items-center gap-3 font-black text-zinc-900 hover:underline">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] text-white" style={{ backgroundColor: b.color }}>
                    {b.logo}
                  </span>
                  <span className="truncate">{b.name}</span>
                  {b.id === activeBrandId && <StatusChip tone="info">Active</StatusChip>}
                </button>
              ),
            },
            {
              key: 'status',
              header: 'Statut',
              cell: (b) => <StatusChip tone={(b.status ?? 'Actif') === 'Actif' ? 'success' : 'warning'}>{b.status ?? 'Actif'}</StatusChip>,
            },
            { key: 'wa', header: 'WhatsApp', cell: (b) => <span className="font-bold text-zinc-700">{b.whatsappNumber || '—'}</span> },
            { key: 'campaigns', header: 'Campagnes', cell: () => <span className="font-bold text-zinc-700">2</span> },
            { key: 'products', header: 'Produits', cell: (b) => <span className="font-bold text-zinc-700">{statsByBrand.get(b.id)?.products ?? 0}</span> },
            { key: 'orders', header: 'Commandes', cell: (b) => <span className="font-bold text-zinc-700">{statsByBrand.get(b.id)?.orders ?? 0}</span> },
            { key: 'ca', header: 'CA (échantillon)', cell: (b) => <span className="font-black text-zinc-900">{formatCurrency(statsByBrand.get(b.id)?.ca ?? 0)}</span> },
          ]}
          emptyTitle="Aucune marque"
          emptyDescription="Créez une marque ou vérifiez vos droits d’accès."
        />
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setOpenId(null)}
        title={selected ? selected.name : ''}
        subtitle={selected ? `${selected.whatsappNumber} • ${selected.status ?? 'Actif'}` : ''}
        footer={
          selected && (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveBrandId(selected.id)}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
              >
                Définir comme active
              </button>
              <button
                type="button"
                onClick={() => startEdit(selected)}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
              >
                Éditer
              </button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Infos générales</p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm font-bold text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Code</span>
                  <span className="text-zinc-900">{selected.code || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>WhatsApp</span>
                  <span className="text-zinc-900">{selected.whatsappNumber || '—'}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Produits</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">{statsByBrand.get(selected.id)?.products ?? 0}</p>
              </div>
              <div className="card p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Commandes</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">{statsByBrand.get(selected.id)?.orders ?? 0}</p>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={draft.id ? `Éditer: ${draft.name || 'marque'}` : 'Créer une marque'}
        subtitle="Enregistrement via API Laravel."
        footer={
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
              Annuler
            </button>
            <button
              type="button"
              disabled={saving || !canMutate}
              onClick={() => void saveBrand()}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {fieldErr.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 space-y-1">
              {fieldErr.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nom</label>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Code</label>
              <input
                value={draft.code ?? ''}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                disabled={Boolean(draft.id)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Statut</label>
              <select
                value={draft.status ?? 'Actif'}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as 'Actif' | 'Inactif' })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
              >
                <option>Actif</option>
                <option>Inactif</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Couleur (#hex)</label>
              <input
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Numéro WhatsApp</label>
              <input
                value={draft.whatsappNumber}
                onChange={(e) => setDraft({ ...draft, whatsappNumber: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

