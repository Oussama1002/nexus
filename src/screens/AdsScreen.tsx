import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';
import type { Brand } from '../types';

export type Campaign = {
  id: string;
  name: string;
  brandId: string;
  source: 'Meta' | 'TikTok' | 'Google' | 'Snap' | 'Autre';
  budget: number;
  leads: number;
  orders: number;
  status: 'Active' | 'Pause' | 'Terminée';
  period: string;
  notes?: string;
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: Parameters<typeof StatusChip>[0]['tone'] }) {
  const dot =
    tone === 'success'
      ? 'bg-emerald-600'
      : tone === 'warning'
        ? 'bg-amber-600'
        : tone === 'danger'
          ? 'bg-rose-600'
          : tone === 'info'
            ? 'bg-blue-600'
            : 'bg-zinc-300';
  return (
    <div className="card p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3 min-w-0">
        <p className="text-2xl font-black text-zinc-900 min-w-0 truncate">{value}</p>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
      </div>
    </div>
  );
}

export function AdsScreen({
  brands,
  campaigns,
  onUpsertCampaign,
  activeBrandId,
}: {
  brands: Brand[];
  campaigns: Campaign[];
  onUpsertCampaign: (c: Campaign) => void;
  activeBrandId: string;
}) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<string>('Marque active');
  const [status, setStatus] = useState<string>('Tous');
  const [source, setSource] = useState<string>('Toutes');
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Campaign>({
    id: '',
    name: '',
    brandId: activeBrandId,
    source: 'Meta',
    budget: 0,
    leads: 0,
    orders: 0,
    status: 'Active',
    period: '—',
    notes: '',
  });

  const brandOptions = useMemo(() => ['Marque active', 'Toutes', ...brands.map((b) => b.id)], [brands]);
  const sources = useMemo(() => ['Toutes', 'Meta', 'TikTok', 'Google', 'Snap', 'Autre'], []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const active = activeBrandId;
    return campaigns.filter((c) => {
      const brandMatch =
        brand === 'Toutes' ? true : brand === 'Marque active' ? c.brandId === active : c.brandId === brand;
      if (!brandMatch) return false;
      if (status !== 'Tous' && c.status !== status) return false;
      if (source !== 'Toutes' && c.source !== source) return false;
      if (!s) return true;
      const blob = `${c.name} ${c.source} ${c.status} ${c.period}`.toLowerCase();
      return blob.includes(s);
    });
  }, [campaigns, q, brand, status, source, activeBrandId]);

  const kpis = useMemo(() => {
    const active = filtered.filter((c) => c.status === 'Active').length;
    const leads = filtered.reduce((s, c) => s + c.leads, 0);
    const spend = filtered.reduce((s, c) => s + c.budget, 0);
    const cpl = leads ? Math.round((spend / leads) * 100) / 100 : 0;
    const orders = filtered.reduce((s, c) => s + c.orders, 0);
    const transform = leads ? Math.round((orders / leads) * 1000) / 10 : 0;
    const activeBrands = new Set(filtered.map((c) => c.brandId)).size;
    return { active, leads, spend, cpl, transform, activeBrands };
  }, [filtered]);

  const selected = useMemo(() => campaigns.find((c) => c.id === openId) ?? null, [campaigns, openId]);

  function startCreate() {
    setDraft({
      id: `CMP-${Math.random().toString(16).slice(2, 8)}`,
      name: '',
      brandId: activeBrandId,
      source: 'Meta',
      budget: 0,
      leads: 0,
      orders: 0,
      status: 'Active',
      period: '—',
      notes: '',
    });
    setModalOpen(true);
  }

  function startEdit(c: Campaign) {
    setDraft({ ...c });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campagnes Ads"
        subtitle="Gestion multi-marques des campagnes (UI prête pour intégration Meta plus tard)."
        right={
          <button
            onClick={startCreate}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nouvelle campagne
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Kpi label="Campagnes actives" value={kpis.active} tone="success" />
        <Kpi label="Leads générés" value={kpis.leads} tone="info" />
        <Kpi label="Coût estimé" value={formatCurrency(kpis.spend)} />
        <Kpi label="Coût par lead" value={kpis.cpl ? formatCurrency(kpis.cpl) : '—'} tone={kpis.cpl && kpis.cpl <= 20 ? 'success' : 'warning'} />
        <Kpi label="Taux de transformation" value={`${kpis.transform}%`} tone={kpis.transform >= 8 ? 'success' : kpis.transform >= 4 ? 'warning' : 'danger'} />
        <Kpi label="Marques actives" value={kpis.activeBrands} />
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <div className="flex items-center gap-3 flex-wrap">
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b === 'Marque active' || b === 'Toutes' ? b : brands.find((x) => x.id === b)?.name ?? b}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              <option value="Tous">Tous statuts</option>
              <option value="Active">Active</option>
              <option value="Pause">Pause</option>
              <option value="Terminée">Terminée</option>
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Date: placeholder</span>
          </div>
        }
        right={<div className="text-sm font-black text-zinc-700">{filtered.length} campagnes</div>}
      />

      <DataTable
        rows={filtered}
        columns={[
          { key: 'name', header: 'Nom campagne', cell: (c) => <button onClick={() => setOpenId(c.id)} className="font-black text-zinc-900 hover:underline">{c.name}</button> },
          { key: 'brand', header: 'Marque', cell: (c) => <span className="font-bold text-zinc-700">{brands.find((b) => b.id === c.brandId)?.name ?? '—'}</span> },
          { key: 'source', header: 'Source', cell: (c) => <span className="font-bold text-zinc-700">{c.source}</span> },
          { key: 'budget', header: 'Budget', cell: (c) => <span className="font-black text-zinc-900">{formatCurrency(c.budget)}</span> },
          { key: 'leads', header: 'Leads', cell: (c) => <span className="font-bold text-zinc-700">{c.leads}</span> },
          { key: 'orders', header: 'Commandes', cell: (c) => <span className="font-bold text-zinc-700">{c.orders}</span> },
          { key: 'status', header: 'Statut', cell: (c) => <StatusChip tone={c.status === 'Active' ? 'success' : c.status === 'Pause' ? 'warning' : 'neutral'}>{c.status}</StatusChip> },
          { key: 'period', header: 'Période', cell: (c) => <span className="font-bold text-zinc-700">{c.period}</span> },
        ]}
        emptyTitle="Aucune campagne"
        emptyDescription="Crée une campagne pour démarrer le suivi."
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setOpenId(null)}
        title={selected ? selected.name : ''}
        subtitle={selected ? `${brands.find((b) => b.id === selected.brandId)?.name ?? '—'} • ${selected.source}` : ''}
        footer={
          selected && (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => startEdit(selected)}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
              >
                Éditer
              </button>
              <button className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700">
                Enregistrer (placeholder)
              </button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Résumé</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="card p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Budget</p>
                  <p className="mt-2 text-2xl font-black text-zinc-900">{formatCurrency(selected.budget)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">CPL</p>
                  <p className="mt-2 text-2xl font-black text-zinc-900">
                    {selected.leads ? formatCurrency(Math.round((selected.budget / selected.leads) * 100) / 100) : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Linked phone number</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — liaison au numéro WhatsApp de la marque.</p>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Notes</p>
              <p className="mt-2 text-sm font-medium text-zinc-700">{selected.notes || '—'}</p>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Source tracking</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — UTM, pixel, campagne ID, adsets.</p>
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={draft.name ? `Éditer: ${draft.name}` : 'Créer une campagne'}
        subtitle="Création (placeholder) — prêt pour Meta integration."
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
                onUpsertCampaign(draft);
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
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nom campagne</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Marque</label>
            <select
              value={draft.brandId}
              onChange={(e) => setDraft({ ...draft, brandId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Source</label>
            <select
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value as any })}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none"
            >
              {(['Meta', 'TikTok', 'Google', 'Snap', 'Autre'] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Budget</label>
            <input
              type="number"
              value={draft.budget}
              onChange={(e) => setDraft({ ...draft, budget: Number(e.target.value || 0) })}
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
              <option>Active</option>
              <option>Pause</option>
              <option>Terminée</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Notes</label>
            <textarea
              value={draft.notes ?? ''}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

