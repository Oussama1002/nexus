import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CopyPlus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusChip } from '../components/ui/StatusChip';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

type EntryStatus = 'testing' | 'winning' | 'losing' | 'archived';

type MediaBuyingEntry = {
  id: number;
  title: string;
  angle: string;
  format: string | null;
  hook: string | null;
  script: string | null;
  status: EntryStatus;
  roas: string | null;
  cpa: string | null;
  ctr: string | null;
  spend: string;
  leads: number;
  confirmed_orders: number;
  repurpose_priority: number;
  repurpose_notes: string | null;
  tested_at: string | null;
  source_entry?: { id: number; title: string; angle: string } | null;
  campaign?: { id: number; name: string } | null;
};

type Draft = {
  title: string;
  angle: string;
  format: string;
  hook: string;
  script: string;
  status: EntryStatus;
  roas: string;
  cpa: string;
  ctr: string;
  spend: string;
  leads: string;
  confirmed_orders: string;
  repurpose_priority: string;
  repurpose_notes: string;
  tested_at: string;
};

function emptyDraft(): Draft {
  return {
    title: '',
    angle: '',
    format: 'video',
    hook: '',
    script: '',
    status: 'testing',
    roas: '',
    cpa: '',
    ctr: '',
    spend: '0',
    leads: '0',
    confirmed_orders: '0',
    repurpose_priority: '0',
    repurpose_notes: '',
    tested_at: '',
  };
}

function toPayload(d: Draft): Record<string, unknown> {
  const asNum = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const asNumOrNull = (v: string) => {
    if (!v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    title: d.title.trim(),
    angle: d.angle.trim(),
    format: d.format.trim() || null,
    hook: d.hook.trim() || null,
    script: d.script.trim() || null,
    status: d.status,
    roas: asNumOrNull(d.roas),
    cpa: asNumOrNull(d.cpa),
    ctr: asNumOrNull(d.ctr),
    spend: asNum(d.spend),
    leads: asNum(d.leads),
    confirmed_orders: asNum(d.confirmed_orders),
    repurpose_priority: asNum(d.repurpose_priority),
    repurpose_notes: d.repurpose_notes.trim() || null,
    tested_at: d.tested_at || null,
  };
}

function statusTone(status: EntryStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'winning') return 'success';
  if (status === 'testing') return 'warning';
  if (status === 'losing') return 'danger';
  return 'neutral';
}

export function MediaBuyingScreen() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('campaigns.create');
  const canUpdate = hasPermission('campaigns.update');
  const canDelete = hasPermission('campaigns.delete');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [winningOnly, setWinningOnly] = useState(false);
  const [rows, setRows] = useState<MediaBuyingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ per_page: '200' });
    if (q.trim()) qs.set('search', q.trim());
    if (status) qs.set('status', status);
    if (winningOnly) qs.set('winning_only', '1');
    const res = await api.get<LaravelPaginator<MediaBuyingEntry>>(`media-buying?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setRows([]);
      return;
    }
    setRows(isPaginator<MediaBuyingEntry>(res.data) ? res.data.data : []);
  }, [q, status, winningOnly, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    const winning = rows.filter((r) => r.status === 'winning');
    const winningCount = winning.length;
    const topAngles = new Map<string, number>();
    for (const row of winning) {
      const key = row.angle.trim().toLowerCase();
      if (!key) continue;
      topAngles.set(key, (topAngles.get(key) ?? 0) + 1);
    }
    const bestAngle = Array.from(topAngles.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
    return {
      total: rows.length,
      winning: winningCount,
      repurposeReady: rows.filter((r) => r.status === 'winning' && (r.repurpose_priority ?? 0) >= 1).length,
      bestAngle,
    };
  }, [rows]);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  }

  function openEdit(row: MediaBuyingEntry) {
    setEditingId(row.id);
    setDraft({
      title: row.title,
      angle: row.angle,
      format: row.format ?? '',
      hook: row.hook ?? '',
      script: row.script ?? '',
      status: row.status,
      roas: row.roas ?? '',
      cpa: row.cpa ?? '',
      ctr: row.ctr ?? '',
      spend: row.spend ?? '0',
      leads: String(row.leads ?? 0),
      confirmed_orders: String(row.confirmed_orders ?? 0),
      repurpose_priority: String(row.repurpose_priority ?? 0),
      repurpose_notes: row.repurpose_notes ?? '',
      tested_at: row.tested_at ?? '',
    });
    setModalOpen(true);
  }

  async function save() {
    if (!draft.title.trim() || !draft.angle.trim()) {
      toast.error('Titre et angle sont obligatoires.');
      return;
    }
    const body = toPayload(draft);
    const res = editingId
      ? await api.put(`media-buying/${editingId}`, body)
      : await api.post('media-buying', body);
    if (!res.ok) {
      const e = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(e as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success(editingId ? 'Fiche media buying mise à jour.' : 'Fiche media buying créée.');
    setModalOpen(false);
    await load();
  }

  async function repurpose(row: MediaBuyingEntry) {
    const res = await api.post(`media-buying/${row.id}/repurpose`, {
      title: `${row.title} (repurpose)`,
      notes: `Repurpose auto depuis winning ad #${row.id}`,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Angle gagnant repurposé en nouvelle variation testing.');
    await load();
  }

  async function remove(row: MediaBuyingEntry) {
    if (!window.confirm(`Supprimer "${row.title}" ?`)) return;
    const res = await api.del(`media-buying/${row.id}`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Fiche supprimée.');
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Buying / Publicité"
        subtitle="Analyse angles, formats, scripts et détection des winning ads pour repurposing systématique."
        right={
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
            </button>
            {canCreate ? (
              <button type="button" onClick={openCreate} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nouvelle pub
              </button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Total ads</p><p className="text-2xl font-black">{kpis.total}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Winning ads</p><p className="text-2xl font-black">{kpis.winning}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Prêtes repurpose</p><p className="text-2xl font-black">{kpis.repurposeReady}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Top angle</p><p className="text-sm font-black break-words">{kpis.bestAngle}</p></div>
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        right={
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
              <option value="">Tous statuts</option>
              <option value="testing">testing</option>
              <option value="winning">winning</option>
              <option value="losing">losing</option>
              <option value="archived">archived</option>
            </select>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold">
              <input type="checkbox" checked={winningOnly} onChange={(e) => setWinningOnly(e.target.checked)} />
              Winning only
            </label>
          </div>
        }
      />

      {rows.length === 0 && !loading ? (
        <EmptyState title="Aucune pub analysée" description="Ajoutez vos ads et marquez les gagnantes pour capitaliser sur les angles performants." />
      ) : (
        <DataTable<MediaBuyingEntry>
          rows={rows}
          columns={[
            { key: 't', header: 'Pub', cell: (r) => <button type="button" className="font-black text-primary-600 hover:underline" onClick={() => openEdit(r)}>{r.title}</button> },
            { key: 'a', header: 'Angle', cell: (r) => <span className="font-bold">{r.angle}</span> },
            { key: 'f', header: 'Format', cell: (r) => <span>{r.format ?? '—'}</span> },
            { key: 's', header: 'Statut', cell: (r) => <StatusChip tone={statusTone(r.status)}>{r.status}</StatusChip> },
            { key: 'roas', header: 'ROAS', cell: (r) => <span>{r.roas ?? '—'}</span> },
            { key: 'cpa', header: 'CPA', cell: (r) => <span>{r.cpa ?? '—'}</span> },
            { key: 'leads', header: 'Leads', cell: (r) => <span>{r.leads}</span> },
            { key: 'prio', header: 'Repurpose', cell: (r) => <span>{r.repurpose_priority}</span> },
            {
              key: 'act',
              header: '',
              cell: (r) => (
                <div className="flex items-center gap-3">
                  {canCreate ? (
                    <button type="button" onClick={() => void repurpose(r)} className="text-sm font-black text-emerald-700 hover:underline inline-flex items-center gap-1" disabled={r.status !== 'winning'}>
                      <CopyPlus className="w-3.5 h-3.5" /> Repurpose
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button type="button" onClick={() => void remove(r)} className="text-sm font-black text-rose-700 hover:underline inline-flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Suppr.
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Modifier angle pub' : 'Nouvelle fiche pub'}
        subtitle="Documentez hooks/scripts/formats pour identifier les winning ads."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
            <button type="button" onClick={() => void save()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">{editingId ? 'Mettre à jour' : 'Créer'}</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-black uppercase text-zinc-500">Titre
              <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">Angle
              <input value={draft.angle} onChange={(e) => setDraft((d) => ({ ...d, angle: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">Format
              <input value={draft.format} onChange={(e) => setDraft((d) => ({ ...d, format: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" placeholder="video, image, ugc..." />
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">Statut
              <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as EntryStatus }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold">
                <option value="testing">testing</option>
                <option value="winning">winning</option>
                <option value="losing">losing</option>
                <option value="archived">archived</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-black uppercase text-zinc-500 block">Hook
            <textarea value={draft.hook} onChange={(e) => setDraft((d) => ({ ...d, hook: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
          </label>
          <label className="text-xs font-black uppercase text-zinc-500 block">Script
            <textarea value={draft.script} onChange={(e) => setDraft((d) => ({ ...d, script: e.target.value }))} rows={4} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-xs font-black uppercase text-zinc-500">ROAS<input value={draft.roas} onChange={(e) => setDraft((d) => ({ ...d, roas: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" /></label>
            <label className="text-xs font-black uppercase text-zinc-500">CPA<input value={draft.cpa} onChange={(e) => setDraft((d) => ({ ...d, cpa: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" /></label>
            <label className="text-xs font-black uppercase text-zinc-500">CTR<input value={draft.ctr} onChange={(e) => setDraft((d) => ({ ...d, ctr: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" /></label>
            <label className="text-xs font-black uppercase text-zinc-500">Spend<input value={draft.spend} onChange={(e) => setDraft((d) => ({ ...d, spend: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" /></label>
            <label className="text-xs font-black uppercase text-zinc-500">Leads<input value={draft.leads} onChange={(e) => setDraft((d) => ({ ...d, leads: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" /></label>
            <label className="text-xs font-black uppercase text-zinc-500">Confirmées<input value={draft.confirmed_orders} onChange={(e) => setDraft((d) => ({ ...d, confirmed_orders: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" /></label>
            <label className="text-xs font-black uppercase text-zinc-500">Priorité repurpose<input value={draft.repurpose_priority} onChange={(e) => setDraft((d) => ({ ...d, repurpose_priority: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" /></label>
            <label className="text-xs font-black uppercase text-zinc-500">Date test<input type="date" value={draft.tested_at} onChange={(e) => setDraft((d) => ({ ...d, tested_at: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" /></label>
          </div>
          <label className="text-xs font-black uppercase text-zinc-500 block">Notes repurpose
            <textarea value={draft.repurpose_notes} onChange={(e) => setDraft((d) => ({ ...d, repurpose_notes: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
