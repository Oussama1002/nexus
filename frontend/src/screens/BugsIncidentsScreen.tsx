import React, { useEffect, useState } from 'react';
import { Bug, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type BugIncident = {
  id: number;
  title: string;
  severity: string;
  module: string;
  reporter: string;
  assignee: string | null;
  status: string;
  created_at: string;
  source?: 'user' | 'runtime';
  occurrences?: number;
  last_seen_at?: string | null;
};

type BugDetail = {
  id: number; title: string; description: string | null; trace: string | null;
  context: Record<string, unknown> | null; severity: string; module: string;
  source: string; fingerprint: string | null; occurrences: number; last_seen_at: string | null;
  status: string; resolution: string | null; resolved_at: string | null;
  reporter: string; assignee: string | null; created_at: string | null; updated_at: string | null;
};

const MODULE_LABELS: Record<string, string> = {
  crm: 'CRM', orders: 'Commandes', delivery: 'Livraison', finance: 'Finance', hr: 'RH', academy: 'Academy', other: 'Autre',
};

function fmtDT(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

const SEVERITY_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'critical', label: 'Critique' },
  { value: 'major', label: 'Majeur' },
  { value: 'minor', label: 'Mineur' },
  { value: 'cosmetic', label: 'Cosmétique' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' },
];

const MODULE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'crm', label: 'CRM' },
  { value: 'orders', label: 'Commandes' },
  { value: 'delivery', label: 'Livraison' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'RH' },
  { value: 'academy', label: 'Academy' },
  { value: 'other', label: 'Autre' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-50 text-red-700',
  major: 'bg-orange-50 text-orange-700',
  minor: 'bg-yellow-50 text-yellow-700',
  cosmetic: 'bg-zinc-100 text-zinc-600',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critique',
  major: 'Majeur',
  minor: 'Mineur',
  cosmetic: 'Cosmétique',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-accent-50 text-accent-700',
  in_progress: 'bg-yellow-50 text-yellow-700',
  resolved: 'bg-green-50 text-green-700',
  closed: 'bg-zinc-100 text-zinc-600',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

export function BugsIncidentsScreen() {
  const { activeBrandId } = useBrand();
  const toastCtx = useToast();
  // Pre-existing bug guard: some parts of this file call toast('kind', 'msg').
  // Translate that shape onto the real ToastContextValue API.
  const toast = (kind: 'success' | 'error' | 'info', message: string) => {
    if (kind === 'success') toastCtx.success(message);
    else if (kind === 'error') toastCtx.error(message);
    else toastCtx.showToast('info', message);
  };
  const [rows, setRows] = useState<BugIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BugDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'minor', module: 'crm', moduleOther: '' });

  const submitCreate = async () => {
    if (!form.title.trim()) { toast('error', 'Titre requis.'); return; }
    // When "Autre" is picked, the free-text value replaces the module.
    // Sent as-is to the backend; the enum was widened server-side.
    const moduleValue = form.module === 'other'
      ? (form.moduleOther.trim() || 'other')
      : form.module;
    if (form.module === 'other' && !form.moduleOther.trim()) {
      toast('error', "Précisez le type d'incident.");
      return;
    }
    setSaving(true);
    try {
      // Bug reports are not brand-scoped — do not send X-Brand-Id even if
      // the current view is brand-scoped (e.g. reporting from Media Buying).
      const res = await api.post('bugs-incidents', {
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
        module: moduleValue,
      }, { brandId: false });
      if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
      toast('success', 'Bug signalé.');
      setShowCreate(false);
      setForm({ title: '', description: '', severity: 'minor', module: 'crm', moduleOther: '' });
      setReloadTick((t) => t + 1);
    } finally { setSaving(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<BugIncident>>(
          'bugs-incidents' + buildQuery({ per_page: 25, page, search: search || undefined, severity: severityFilter || undefined, status: statusFilter || undefined, module: moduleFilter || undefined })
        );
        if (cancelled) return;
        if (res.ok) {
          setRows(res.data.data);
          setTotal(res.data.total);
          setLastPage(res.data.last_page);
        } else {
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [page, search, severityFilter, statusFilter, moduleFilter, activeBrandId, reloadTick]);

  useEffect(() => {
    if (detailId === null) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      const res = await api.get<BugDetail>(`bugs-incidents/${detailId}`);
      if (cancelled) return;
      setDetailLoading(false);
      if (res.ok && res.data) setDetail(res.data);
    })();
    return () => { cancelled = true; };
  }, [detailId]);

  const openCount = rows.filter(r => r.status === 'open').length;
  const criticalCount = rows.filter(r => r.severity === 'critical').length;
  const resolvedCount = rows.filter(r => r.status === 'resolved').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Bugs & incidents" subtitle="Suivi des anomalies et incidents techniques">
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Signaler un bug
        </button>
      </PageHeader>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Signaler un bug ou incident</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Titre *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Sévérité
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  {SEVERITY_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Type d'incident
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })}>
                  {MODULE_OPTIONS.filter(o => o.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              {form.module === 'other' && (
                <label className="col-span-2 text-sm font-bold text-zinc-700">Préciser le type *
                  <input
                    autoFocus
                    className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                    value={form.moduleOther}
                    onChange={(e) => setForm({ ...form, moduleOther: e.target.value })}
                    placeholder="Décrire brièvement le type d'incident (ex : intégration Stripe, cron horaire, …)"
                  />
                </label>
              )}
              <label className="col-span-2 text-sm font-bold text-zinc-700">Description
                <textarea rows={5} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ce qui s'est passé, étapes de reproduction, comportement attendu…" />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={submitCreate} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">{saving ? 'Envoi…' : 'Signaler'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Ouverts</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{openCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Critiques</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{criticalCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Résolus ce mois</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{resolvedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Temps moyen résolution</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">—</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
            placeholder="Rechercher…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={severityFilter}
          onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
        >
          {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={moduleFilter}
          onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
        >
          {MODULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState title="Aucun bug" description="Aucun bug ou incident trouvé pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">ID</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Titre</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Sévérité</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Module</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Signalé par</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Assigné à</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} onClick={() => setDetailId(row.id)} className="border-b border-zinc-50 hover:bg-zinc-50/50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium">#{row.id}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {row.source === 'runtime' && (
                        <span title="Détecté automatiquement par le CRM" className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase bg-accent-50 text-accent-700">
                          Auto
                        </span>
                      )}
                      <span className="truncate">{row.title}</span>
                      {row.occurrences && row.occurrences > 1 && (
                        <span title={row.last_seen_at ? `Dernière occurrence : ${new Date(row.last_seen_at).toLocaleString('fr-FR')}` : ''} className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800">
                          ×{row.occurrences}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_COLORS[row.severity] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {SEVERITY_LABELS[row.severity] ?? row.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.module}</td>
                  <td className="px-4 py-3 text-sm">{row.reporter}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.assignee ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(row.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">Page {page} sur {lastPage} — {total} résultat(s)</p>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary p-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-secondary p-2" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <Modal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detail ? `#${detail.id} · ${detail.title}` : 'Détail du bug'}
        subtitle={detail ? `${MODULE_LABELS[detail.module] ?? detail.module} · ${detail.source === 'runtime' ? 'Détecté automatiquement' : 'Signalé par un utilisateur'}` : ''}
      >
        {detailLoading && <p className="text-sm font-bold text-zinc-500">Chargement…</p>}
        {!detailLoading && detail && (
          <div className="space-y-4">
            {/* Résumé */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${SEVERITY_COLORS[detail.severity] ?? 'bg-zinc-100 text-zinc-600'}`}>{SEVERITY_LABELS[detail.severity] ?? detail.severity}</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${STATUS_COLORS[detail.status] ?? 'bg-zinc-100 text-zinc-600'}`}>{STATUS_LABELS[detail.status] ?? detail.status}</span>
              {detail.occurrences > 1 && <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold bg-amber-50 text-amber-800">×{detail.occurrences} occurrences</span>}
            </div>

            {/* Infos clés */}
            <div className="card-muted p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <span className="font-semibold text-zinc-500">Module</span><span className="font-bold text-zinc-900 text-right">{MODULE_LABELS[detail.module] ?? detail.module}</span>
              <span className="font-semibold text-zinc-500">Signalé par</span><span className="font-bold text-zinc-900 text-right">{detail.reporter}</span>
              <span className="font-semibold text-zinc-500">Assigné à</span><span className="font-bold text-zinc-900 text-right">{detail.assignee ?? '—'}</span>
              <span className="font-semibold text-zinc-500">Créé le</span><span className="font-bold text-zinc-900 text-right">{fmtDT(detail.created_at)}</span>
              <span className="font-semibold text-zinc-500">Dernière occurrence</span><span className="font-bold text-zinc-900 text-right">{fmtDT(detail.last_seen_at)}</span>
              {detail.resolved_at && (<><span className="font-semibold text-zinc-500">Résolu le</span><span className="font-bold text-emerald-700 text-right">{fmtDT(detail.resolved_at)}</span></>)}
            </div>

            {/* Description */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-1">Description & étapes</p>
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{detail.description?.trim() || 'Aucune description fournie.'}</p>
            </div>

            {/* Résolution */}
            {detail.resolution && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-1">Résolution</p>
                <p className="text-sm text-emerald-950 whitespace-pre-wrap">{detail.resolution}</p>
              </div>
            )}

            {/* Contexte technique */}
            {detail.context && Object.keys(detail.context).length > 0 && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-1">Contexte technique</p>
                <div className="card-muted p-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                  {Object.entries(detail.context).map(([k, v]) => (
                    <React.Fragment key={k}>
                      <span className="font-semibold text-zinc-500">{k}</span>
                      <span className="font-mono text-zinc-800 break-all text-right">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Trace technique */}
            {detail.trace && (
              <details className="rounded-xl border border-zinc-200">
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">Trace technique</summary>
                <pre className="px-3 py-2 text-[11px] text-zinc-700 whitespace-pre-wrap break-all max-h-80 overflow-y-auto bg-zinc-50">{detail.trace}</pre>
              </details>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
