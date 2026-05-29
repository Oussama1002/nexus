import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
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

type RoleType = 'content_creator' | 'video_editor' | 'copywriter' | 'publisher' | 'reviewer' | 'other';
type ProjectStatus = 'draft' | 'in_progress' | 'blocked' | 'review' | 'published' | 'done';

type UserOption = { id: number; name: string; email: string };
type Member = {
  id: number;
  user_id: number;
  project_role: RoleType;
  is_lead: boolean;
  user?: { id: number; name: string; email: string } | null;
};
type ProjectRow = {
  id: number;
  title: string;
  objective: string | null;
  status: ProjectStatus;
  due_date: string | null;
  asset_url: string | null;
  notes: string | null;
  members: Member[];
};

type DraftMember = { user_id: string; project_role: RoleType; is_lead: boolean };
type Draft = {
  title: string;
  objective: string;
  status: ProjectStatus;
  due_date: string;
  asset_url: string;
  notes: string;
  members: DraftMember[];
};

const ROLE_OPTIONS: { value: RoleType; label: string }[] = [
  { value: 'content_creator', label: 'Tournage contenu' },
  { value: 'video_editor', label: 'Monteur' },
  { value: 'copywriter', label: 'Copywriter' },
  { value: 'publisher', label: 'Publication' },
  { value: 'reviewer', label: 'Relecture/validation' },
  { value: 'other', label: 'Autre' },
];

function emptyDraft(): Draft {
  return {
    title: '',
    objective: '',
    status: 'draft',
    due_date: '',
    asset_url: '',
    notes: '',
    members: [],
  };
}

function toPayload(draft: Draft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    objective: draft.objective.trim() || null,
    status: draft.status,
    due_date: draft.due_date || null,
    asset_url: draft.asset_url.trim() || null,
    notes: draft.notes.trim() || null,
    members: draft.members
      .filter((m) => m.user_id)
      .map((m) => ({
        user_id: Number(m.user_id),
        project_role: m.project_role,
        is_lead: m.is_lead,
      })),
  };
}

function statusTone(status: ProjectStatus): 'neutral' | 'warning' | 'danger' | 'info' | 'success' {
  if (status === 'done') return 'success';
  if (status === 'published') return 'info';
  if (status === 'review') return 'warning';
  if (status === 'blocked') return 'danger';
  return 'neutral';
}

export function CollabProjectsScreen() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('collab_projects.create');
  const canUpdate = hasPermission('collab_projects.update');
  const canDelete = hasPermission('collab_projects.delete');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ per_page: '200' });
    if (q.trim()) qs.set('search', q.trim());
    if (status) qs.set('status', status);
    const res = await api.get<LaravelPaginator<ProjectRow>>(`collab-projects?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setRows([]);
      return;
    }
    setRows(isPaginator<ProjectRow>(res.data) ? res.data.data : []);
  }, [q, status, toast]);

  const loadUsers = useCallback(async () => {
    const res = await api.get<LaravelPaginator<UserOption>>('users?per_page=200');
    if (res.ok && isPaginator<UserOption>(res.data)) {
      setUsers(res.data.data);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const kpis = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((r) => ['in_progress', 'review'].includes(r.status)).length,
      blocked: rows.filter((r) => r.status === 'blocked').length,
      published: rows.filter((r) => r.status === 'published').length,
    };
  }, [rows]);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  }

  function openEdit(row: ProjectRow) {
    setEditingId(row.id);
    setDraft({
      title: row.title,
      objective: row.objective ?? '',
      status: row.status,
      due_date: row.due_date ?? '',
      asset_url: row.asset_url ?? '',
      notes: row.notes ?? '',
      members: (row.members ?? []).map((m) => ({
        user_id: String(m.user_id),
        project_role: m.project_role,
        is_lead: m.is_lead,
      })),
    });
    setModalOpen(true);
  }

  async function save() {
    if (!draft.title.trim()) {
      toast.error('Titre projet requis.');
      return;
    }
    const body = toPayload(draft);
    const res = editingId
      ? await api.put(`collab-projects/${editingId}`, body)
      : await api.post('collab-projects', body);
    if (!res.ok) {
      const e = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(e as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success(editingId ? 'Projet collaboratif mis à jour.' : 'Projet collaboratif créé.');
    setModalOpen(false);
    await load();
  }

  async function remove(row: ProjectRow) {
    if (!window.confirm(`Supprimer le projet "${row.title}" ?`)) return;
    const res = await api.del(`collab-projects/${row.id}`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Projet supprimé.');
    await load();
  }

  function addMemberLine() {
    setDraft((d) => ({
      ...d,
      members: [...d.members, { user_id: '', project_role: 'content_creator', is_lead: false }],
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projets collaboratifs"
        subtitle="Liez tournage, montage, copywriting et publication dans un même projet."
        right={
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
            </button>
            {canCreate ? (
              <button type="button" onClick={openCreate} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nouveau projet
              </button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Total</p><p className="text-2xl font-black">{kpis.total}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Actifs</p><p className="text-2xl font-black">{kpis.active}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Bloqués</p><p className="text-2xl font-black">{kpis.blocked}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Publié</p><p className="text-2xl font-black">{kpis.published}</p></div>
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        right={
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
            <option value="">Tous statuts</option>
            <option value="draft">draft</option>
            <option value="in_progress">in_progress</option>
            <option value="blocked">blocked</option>
            <option value="review">review</option>
            <option value="published">published</option>
            <option value="done">done</option>
          </select>
        }
      />

      {rows.length === 0 && !loading ? (
        <EmptyState title="Aucun projet collaboratif" description="Créez un projet et assignez tous les intervenants du flux contenu." />
      ) : (
        <DataTable<ProjectRow>
          rows={rows}
          columns={[
            { key: 't', header: 'Projet', cell: (r) => <button type="button" className="font-black text-primary-600 hover:underline" onClick={() => openEdit(r)}>{r.title}</button> },
            { key: 'st', header: 'Statut', cell: (r) => <StatusChip tone={statusTone(r.status)}>{r.status}</StatusChip> },
            { key: 'due', header: 'Echéance', cell: (r) => <span>{r.due_date ?? '—'}</span> },
            {
              key: 'members',
              header: 'Intervenants',
              cell: (r) => (
                <div className="flex flex-wrap gap-1">
                  {(r.members ?? []).slice(0, 3).map((m) => (
                    <StatusChip key={m.id} tone={m.is_lead ? 'success' : 'neutral'}>
                      {m.user?.name ?? `#${m.user_id}`} · {m.project_role}
                    </StatusChip>
                  ))}
                  {(r.members ?? []).length > 3 ? <span className="text-xs text-zinc-500 font-bold">+{(r.members ?? []).length - 3}</span> : null}
                </div>
              ),
            },
            {
              key: 'act',
              header: '',
              cell: (r) => (
                <div className="flex items-center gap-3">
                  {canUpdate ? (
                    <button type="button" onClick={() => openEdit(r)} className="text-sm font-black text-primary-600 hover:underline">
                      Modifier
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
        title={editingId ? 'Modifier projet collaboratif' : 'Nouveau projet collaboratif'}
        subtitle="Reliez les rôles clés (tournage, montage, copywriting, publication) sur une seule fiche."
        panelClassName="max-w-4xl max-h-[92vh] flex flex-col"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
            <button type="button" onClick={() => void save()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">{editingId ? 'Mettre à jour' : 'Créer'}</button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[calc(92vh-12rem)] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-black uppercase text-zinc-500">Titre
              <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">Statut
              <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as ProjectStatus }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold">
                <option value="draft">draft</option>
                <option value="in_progress">in_progress</option>
                <option value="blocked">blocked</option>
                <option value="review">review</option>
                <option value="published">published</option>
                <option value="done">done</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">Echéance
              <input type="date" value={draft.due_date} onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">Lien assets
              <input value={draft.asset_url} onChange={(e) => setDraft((d) => ({ ...d, asset_url: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
            </label>
          </div>
          <label className="text-xs font-black uppercase text-zinc-500 block">Objectif
            <textarea value={draft.objective} onChange={(e) => setDraft((d) => ({ ...d, objective: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
          </label>
          <label className="text-xs font-black uppercase text-zinc-500 block">Notes
            <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} rows={3} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
          </label>

          <div className="card-muted p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-zinc-900">Intervenants du projet</p>
              <button type="button" onClick={addMemberLine} className="text-xs font-black text-primary-700 hover:underline inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Ajouter rôle
              </button>
            </div>
            {draft.members.length === 0 ? (
              <p className="text-xs text-zinc-500">Aucun intervenant ajouté.</p>
            ) : (
              <div className="space-y-2">
                {draft.members.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <select
                      value={m.user_id}
                      onChange={(e) => setDraft((d) => ({ ...d, members: d.members.map((x, i) => i === idx ? { ...x, user_id: e.target.value } : x) }))}
                      className="md:col-span-5 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
                    >
                      <option value="">— Utilisateur —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} · {u.email}</option>
                      ))}
                    </select>
                    <select
                      value={m.project_role}
                      onChange={(e) => setDraft((d) => ({ ...d, members: d.members.map((x, i) => i === idx ? { ...x, project_role: e.target.value as RoleType } : x) }))}
                      className="md:col-span-4 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <label className="md:col-span-2 inline-flex items-center gap-2 text-xs font-bold text-zinc-700">
                      <input
                        type="checkbox"
                        checked={m.is_lead}
                        onChange={(e) => setDraft((d) => ({ ...d, members: d.members.map((x, i) => i === idx ? { ...x, is_lead: e.target.checked } : x) }))}
                      />
                      Lead
                    </label>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, members: d.members.filter((_, i) => i !== idx) }))}
                      className="md:col-span-1 px-2 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black hover:bg-rose-50"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
