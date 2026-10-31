import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';

type Complaint = {
  id: number;
  brand?: { id: number; name: string } | null;
  platform: string | null;
  channel: string | null;
  customer_name: string | null;
  customer_link: string | null;
  received_at: string | null;
  reason: string | null;
  description: string | null;
  screenshot_url: string | null;
  status: string;
  assigned_to_text: string | null;
  updates_count?: number;
};

type Update = { id: number; note: string; status_after: string | null; created_at: string; user?: { name: string } | null };

const PLATFORMS = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Autre'];
const CHANNELS = [{ v: 'dm', l: 'Message privé' }, { v: 'comment', l: 'Commentaire' }];
const REASONS = [
  { v: 'retard', l: 'Retard de livraison' },
  { v: 'defectueux', l: 'Produit défectueux' },
  { v: 'remboursement', l: 'Remboursement' },
  { v: 'service', l: 'Service client' },
  { v: 'autre', l: 'Autre' },
];
const STATUSES = [
  { v: 'nouvelle', l: 'Nouvelle', tone: 'warning' as const },
  { v: 'en_cours', l: 'En cours', tone: 'info' as const },
  { v: 'transmise', l: 'Transmise', tone: 'purple' as const },
  { v: 'resolue', l: 'Résolue', tone: 'success' as const },
  { v: 'cloturee', l: 'Clôturée', tone: 'neutral' as const },
];

function label(list: { v: string; l: string }[], v: string | null): string {
  return list.find((x) => x.v === v)?.l ?? (v ?? '—');
}
function statusMeta(v: string) {
  return STATUSES.find((s) => s.v === v) ?? { v, l: v, tone: 'neutral' as const };
}
function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

type Draft = {
  platform: string; channel: string; customer_name: string; customer_link: string;
  received_at: string; reason: string; description: string; screenshot_url: string;
  status: string; assigned_to_text: string;
};
function emptyDraft(): Draft {
  return { platform: 'Instagram', channel: 'dm', customer_name: '', customer_link: '', received_at: '', reason: 'service', description: '', screenshot_url: '', status: 'nouvelle', assigned_to_text: '' };
}

export function SocialComplaintsScreen() {
  const { activeBrandId } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canCreate = hasPermission('social_complaints.create');
  const canUpdate = hasPermission('social_complaints.update');

  const [rows, setRows] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  // Liste déroulante des clients (avec saisie libre si le client n'existe pas).
  const [custOptions, setCustOptions] = useState<{ id: number; full_name: string; phone: string | null }[]>([]);
  const [showCust, setShowCust] = useState(false);

  const [detail, setDetail] = useState<Complaint | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteStatus, setNoteStatus] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeBrandId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const res = await api.get<Paginated<Complaint>>('social-complaints' + buildQuery({ per_page: 100, status: statusFilter || undefined, reason: reasonFilter || undefined, search: search.trim() || undefined }));
    setLoading(false);
    setRows(res.ok && res.data ? res.data.data : []);
    const sres = await api.get<Record<string, number>>('social-complaints/stats');
    if (sres.ok && sres.data) setStats(sres.data);
  }, [activeBrandId, statusFilter, reasonFilter, search]);

  useEffect(() => { void load(); }, [load]);

  // Charge les clients correspondant à la saisie quand le formulaire est ouvert.
  useEffect(() => {
    if (!modalOpen) return;
    const t = window.setTimeout(async () => {
      const res = await api.get<{ id: number; full_name: string; phone: string | null }[]>('social-complaints/customer-options' + buildQuery({ search: draft.customer_name.trim() || undefined }));
      if (res.ok && Array.isArray(res.data)) setCustOptions(res.data);
    }, 250);
    return () => window.clearTimeout(t);
  }, [modalOpen, draft.customer_name]);

  function openCreate() { setEditingId(null); setDraft(emptyDraft()); setModalOpen(true); }
  function openEdit(c: Complaint) {
    setEditingId(c.id);
    setDraft({
      platform: c.platform ?? 'Instagram', channel: c.channel ?? 'dm', customer_name: c.customer_name ?? '', customer_link: c.customer_link ?? '',
      received_at: c.received_at ? c.received_at.slice(0, 16) : '', reason: c.reason ?? 'service', description: c.description ?? '',
      screenshot_url: c.screenshot_url ?? '', status: c.status, assigned_to_text: c.assigned_to_text ?? '',
    });
    setModalOpen(true);
  }

  async function save() {
    if (!draft.customer_name.trim()) { toast.error('Le nom/pseudo du client est requis.'); return; }
    setSaving(true);
    const payload = { ...draft, received_at: draft.received_at || null, customer_link: draft.customer_link.trim() || null, description: draft.description.trim() || null, screenshot_url: draft.screenshot_url.trim() || null, assigned_to_text: draft.assigned_to_text.trim() || null };
    const res = editingId ? await api.put(`social-complaints/${editingId}`, payload) : await api.post('social-complaints', payload);
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(editingId ? 'Réclamation mise à jour.' : 'Réclamation enregistrée.');
    setModalOpen(false);
    await load();
  }

  const openDetail = useCallback(async (c: Complaint) => {
    setDetail(c); setUpdates([]); setNoteDraft(''); setNoteStatus('');
    const res = await api.get<Complaint & { updates?: Update[] }>(`social-complaints/${c.id}`);
    if (res.ok && res.data) { setDetail(res.data); setUpdates(res.data.updates ?? []); }
  }, []);

  async function addNote() {
    if (!detail || !noteDraft.trim()) return;
    setNoteSaving(true);
    const res = await api.post<Update>(`social-complaints/${detail.id}/updates`, { note: noteDraft.trim(), status: noteStatus || undefined });
    setNoteSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    setNoteDraft(''); setNoteStatus('');
    toast.success('Suivi ajouté.');
    await openDetail(detail);
    await load();
  }

  const statCards = useMemo(() => ([
    { l: 'Total', v: stats?.total ?? 0 },
    { l: 'Nouvelles', v: stats?.nouvelle ?? 0 },
    { l: 'En cours', v: stats?.en_cours ?? 0 },
    { l: 'Transmises', v: stats?.transmise ?? 0 },
    { l: 'Résolues', v: stats?.resolue ?? 0 },
    { l: 'Clôturées', v: stats?.cloturee ?? 0 },
  ]), [stats]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réclamations"
        subtitle="Réclamations clients reçues sur les réseaux sociaux (messages & commentaires)."
        right={canCreate ? (
          <button type="button" onClick={openCreate} className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black inline-flex items-center gap-2 hover:bg-primary-700">
            <Plus className="w-4 h-4" /> Nouvelle réclamation
          </button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((k) => (
          <div key={k.l} className="card-muted p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{k.l}</p>
            <p className="mt-1 text-2xl font-black text-zinc-900">{k.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
          <option value="">Tous statuts</option>
          {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
          <option value="">Tous motifs</option>
          {REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher client / description…" className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
      </div>

      {loading ? (
        <p className="text-sm font-bold text-zinc-500">Chargement…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune réclamation" description="Enregistrez les réclamations reçues en message ou en commentaire." />
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <button key={c.id} type="button" onClick={() => void openDetail(c)} className="w-full text-left card p-4 hover:border-primary-300 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black text-zinc-900 truncate">{c.customer_name ?? '—'}
                    <span className="ml-2 text-[11px] font-bold text-zinc-400">{c.platform} · {label(CHANNELS, c.channel)}</span>
                  </p>
                  <p className="text-[12px] text-zinc-500 truncate">{label(REASONS, c.reason)} — {c.description || '—'}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{c.brand?.name ?? ''} · reçue {fmt(c.received_at)}</p>
                </div>
                <StatusChip tone={statusMeta(c.status).tone}>{statusMeta(c.status).l}</StatusChip>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Création / édition */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Modifier la réclamation' : 'Nouvelle réclamation'}
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-black">Fermer</button>
            <button type="button" disabled={saving} onClick={() => void save()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-50">{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <L label="Plateforme"><select value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })} className={inp}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></L>
            <L label="Canal"><select value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })} className={inp}>{CHANNELS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select></L>
          </div>
          <L label="Client (nom ou pseudo) *">
            <div className="relative">
              <input
                value={draft.customer_name}
                onChange={(e) => { setDraft({ ...draft, customer_name: e.target.value }); setShowCust(true); }}
                onFocus={() => setShowCust(true)}
                onBlur={() => window.setTimeout(() => setShowCust(false), 150)}
                placeholder="Choisir un client ou saisir un nom…"
                className={inp}
                autoComplete="off"
              />
              {showCust && custOptions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                  {custOptions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setDraft((d) => ({ ...d, customer_name: c.full_name })); setShowCust(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-zinc-100 last:border-0"
                    >
                      <span className="text-sm font-bold text-zinc-800">{c.full_name}</span>
                      {c.phone && <span className="ml-2 text-xs text-zinc-500">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">Si le client n'existe pas, saisissez simplement son nom/pseudo.</p>
          </L>
          <L label="Lien vers le message / commentaire"><input value={draft.customer_link} onChange={(e) => setDraft({ ...draft, customer_link: e.target.value })} className={inp} placeholder="https://…" /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Date de réception"><input type="datetime-local" value={draft.received_at} onChange={(e) => setDraft({ ...draft, received_at: e.target.value })} className={inp} /></L>
            <L label="Motif"><select value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} className={inp}>{REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select></L>
          </div>
          <L label="Description"><textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inp} /></L>
          <L label="Capture (URL)"><input value={draft.screenshot_url} onChange={(e) => setDraft({ ...draft, screenshot_url: e.target.value })} className={inp} placeholder="https://…" /></L>
          <div className="grid grid-cols-2 gap-3">
            <L label="Statut"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={inp}>{STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></L>
            <L label="Transmise à"><input value={draft.assigned_to_text} onChange={(e) => setDraft({ ...draft, assigned_to_text: e.target.value })} className={inp} placeholder="Call center, logistique…" /></L>
          </div>
        </div>
      </Modal>

      {/* Détail + suivi */}
      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail ? (detail.customer_name ?? 'Réclamation') : ''}
        footer={canUpdate && detail ? (
          <button type="button" onClick={() => { const d = detail; setDetail(null); if (d) openEdit(d); }} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-black">Modifier la fiche</button>
        ) : undefined}
      >
        {detail && (
          <div className="space-y-4">
            <div className="card-muted p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <span className="font-semibold text-zinc-500">Plateforme</span><span className="font-bold text-zinc-900 text-right">{detail.platform} · {label(CHANNELS, detail.channel)}</span>
              <span className="font-semibold text-zinc-500">Motif</span><span className="font-bold text-zinc-900 text-right">{label(REASONS, detail.reason)}</span>
              <span className="font-semibold text-zinc-500">Reçue le</span><span className="font-bold text-zinc-900 text-right">{fmt(detail.received_at)}</span>
              <span className="font-semibold text-zinc-500">Statut</span><span className="text-right"><StatusChip tone={statusMeta(detail.status).tone}>{statusMeta(detail.status).l}</StatusChip></span>
              <span className="font-semibold text-zinc-500">Transmise à</span><span className="font-bold text-zinc-900 text-right">{detail.assigned_to_text || '—'}</span>
            </div>
            {detail.description && <p className="text-sm text-zinc-700 whitespace-pre-wrap">{detail.description}</p>}
            {detail.customer_link && <a href={detail.customer_link} target="_blank" rel="noreferrer" className="text-sm font-bold text-primary-600 hover:underline">Voir le message / commentaire</a>}

            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Suivi</p>
              {updates.length === 0 && <p className="text-sm text-zinc-500">Aucune action enregistrée.</p>}
              {updates.map((u) => (
                <div key={u.id} className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-3 py-2 text-sm">
                  <p className="text-zinc-800">{u.note}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{u.user?.name ?? ''} · {fmt(u.created_at)}{u.status_after ? ` · → ${statusMeta(u.status_after).l}` : ''}</p>
                </div>
              ))}
              {canUpdate && (
                <div className="space-y-2 pt-1">
                  <textarea rows={2} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Action / réponse…" className={inp} />
                  <div className="flex gap-2">
                    <select value={noteStatus} onChange={(e) => setNoteStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                      <option value="">Statut inchangé</option>
                      {STATUSES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                    </select>
                    <button type="button" disabled={noteSaving || !noteDraft.trim()} onClick={() => void addNote()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-50">{noteSaving ? '…' : 'Ajouter au suivi'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const inp = 'w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm';
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-black uppercase text-zinc-700">{label}<div className="mt-1">{children}</div></label>;
}

export default SocialComplaintsScreen;
