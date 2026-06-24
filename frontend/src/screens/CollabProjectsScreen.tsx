import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';
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

/* ── types ── */

type RoleType = 'content_creator' | 'video_editor' | 'copywriter' | 'publisher' | 'reviewer' | 'other';
type ProjectStatus = 'draft' | 'in_progress' | 'blocked' | 'review' | 'published' | 'done';
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type View = 'list' | 'board';

type UserOption = { id: number; name: string; email: string };
type Member = { id: number; user_id: number; project_role: RoleType; is_lead: boolean; user?: { id: number; name: string; email: string } | null };
type ProjectRow = { id: number; title: string; objective: string | null; status: ProjectStatus; due_date: string | null; asset_url: string | null; notes: string | null; members: Member[] };
type DraftMember = { user_id: string; project_role: RoleType; is_lead: boolean };
type Draft = { title: string; objective: string; status: ProjectStatus; due_date: string; asset_url: string; notes: string; members: DraftMember[] };

type KanbanTask = { id: number; column_id: number; title: string; description: string | null; priority: Priority; due_date: string | null; sort_order: number; assigned_to: number | null; assignee_name: string | null };
type KanbanColumn = { id: number; title: string; color: string; sort_order: number; tasks: KanbanTask[] };

/* ── constants ── */

const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', in_progress: 'En cours', blocked: 'Bloqué', review: 'En révision', published: 'Publié', done: 'Terminé' };
const ROLE_LABELS: Record<string, string> = { content_creator: 'Tournage contenu', video_editor: 'Monteur', copywriter: 'Copywriter', publisher: 'Publication', reviewer: 'Relecture/validation', other: 'Autre' };
const ROLE_OPTIONS: { value: RoleType; label: string }[] = [
  { value: 'content_creator', label: 'Tournage contenu' }, { value: 'video_editor', label: 'Monteur' },
  { value: 'copywriter', label: 'Copywriter' }, { value: 'publisher', label: 'Publication' },
  { value: 'reviewer', label: 'Relecture/validation' }, { value: 'other', label: 'Autre' },
];
const PRIORITY_LABELS: Record<string, string> = { low: 'Basse', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente' };
const PRIORITY_COLORS: Record<string, string> = { low: 'bg-zinc-100 text-zinc-600', medium: 'bg-blue-100 text-blue-700', high: 'bg-amber-100 text-amber-700', urgent: 'bg-rose-100 text-rose-700' };
const DEFAULT_COLUMNS = [
  { title: 'À faire', color: '#6366f1' },
  { title: 'En cours', color: '#f59e0b' },
  { title: 'En révision', color: '#8b5cf6' },
  { title: 'Terminé', color: '#22c55e' },
];

/* ── helpers ── */

function emptyDraft(): Draft { return { title: '', objective: '', status: 'draft', due_date: '', asset_url: '', notes: '', members: [] }; }
function toPayload(draft: Draft): Record<string, unknown> {
  return {
    title: draft.title.trim(), objective: draft.objective.trim() || null, status: draft.status,
    due_date: draft.due_date || null, asset_url: draft.asset_url.trim() || null, notes: draft.notes.trim() || null,
    members: draft.members.filter((m) => m.user_id).map((m) => ({ user_id: Number(m.user_id), project_role: m.project_role, is_lead: m.is_lead })),
  };
}
function statusTone(status: ProjectStatus): 'neutral' | 'warning' | 'danger' | 'info' | 'success' {
  if (status === 'done') return 'success'; if (status === 'published') return 'info'; if (status === 'review') return 'warning'; if (status === 'blocked') return 'danger'; return 'neutral';
}
function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ══════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════ */

export function CollabProjectsScreen() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('collab_projects.create');
  const canUpdate = hasPermission('collab_projects.update');
  const canDelete = hasPermission('collab_projects.delete');

  const [view, setView] = useState<View>('list');
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null);

  function openBoard(project: ProjectRow) {
    setSelectedProject(project);
    setView('board');
  }

  return view === 'board' && selectedProject ? (
    <KanbanBoard project={selectedProject} canUpdate={canUpdate} canDelete={canDelete} toast={toast} onBack={() => setView('list')} />
  ) : (
    <ProjectList canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} toast={toast} onOpenBoard={openBoard} />
  );
}

/* ══════════════════════════════════════════════════════
   Project List (existing view)
   ══════════════════════════════════════════════════════ */

function ProjectList({ canCreate, canUpdate, canDelete, toast, onOpenBoard }: {
  canCreate: boolean; canUpdate: boolean; canDelete: boolean;
  toast: ReturnType<typeof useToast>; onOpenBoard: (p: ProjectRow) => void;
}) {
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
    if (!res.ok) { toast.error(res.message); setRows([]); return; }
    setRows(isPaginator<ProjectRow>(res.data) ? res.data.data : []);
  }, [q, status, toast]);

  const loadUsers = useCallback(async () => {
    const res = await api.get<LaravelPaginator<UserOption>>('users?per_page=200');
    if (res.ok && isPaginator<UserOption>(res.data)) setUsers(res.data.data);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const kpis = useMemo(() => ({
    total: rows.length,
    active: rows.filter((r) => ['in_progress', 'review'].includes(r.status)).length,
    blocked: rows.filter((r) => r.status === 'blocked').length,
    published: rows.filter((r) => r.status === 'published').length,
  }), [rows]);

  function openCreate() { setEditingId(null); setDraft(emptyDraft()); setModalOpen(true); }
  function openEdit(row: ProjectRow) {
    setEditingId(row.id);
    setDraft({ title: row.title, objective: row.objective ?? '', status: row.status, due_date: row.due_date ?? '', asset_url: row.asset_url ?? '', notes: row.notes ?? '',
      members: (row.members ?? []).map((m) => ({ user_id: String(m.user_id), project_role: m.project_role, is_lead: m.is_lead })),
    });
    setModalOpen(true);
  }

  async function save() {
    if (!draft.title.trim()) { toast.error('Titre projet requis.'); return; }
    const body = toPayload(draft);
    const res = editingId ? await api.put(`collab-projects/${editingId}`, body) : await api.post('collab-projects', body);
    if (!res.ok) { const fe = flattenFieldErrors((res as any).errors ?? {}); toast.error(fe.length ? fe.join(' ') : res.message); return; }
    toast.success(editingId ? 'Projet mis à jour.' : 'Projet créé.');
    setModalOpen(false);
    await load();
  }

  async function remove(row: ProjectRow) {
    if (!window.confirm(`Supprimer « ${row.title} » ?`)) return;
    const res = await api.del(`collab-projects/${row.id}`);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Projet supprimé.');
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Projets collaboratifs" subtitle="Liez tournage, montage, copywriting et publication dans un même projet." right={
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          {canCreate && <button type="button" onClick={openCreate} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Nouveau projet</button>}
        </div>
      } />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Total</p><p className="text-2xl font-black">{kpis.total}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Actifs</p><p className="text-2xl font-black">{kpis.active}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Bloqués</p><p className="text-2xl font-black">{kpis.blocked}</p></div>
        <div className="card p-4"><p className="text-[10px] uppercase font-black text-zinc-400">Publiés</p><p className="text-2xl font-black">{kpis.published}</p></div>
      </div>

      <FilterBar query={q} onQueryChange={setQ} right={
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
          <option value="">Tous statuts</option>
          <option value="draft">Brouillon</option><option value="in_progress">En cours</option><option value="blocked">Bloqué</option>
          <option value="review">En révision</option><option value="published">Publié</option><option value="done">Terminé</option>
        </select>
      } />

      {rows.length === 0 && !loading ? (
        <EmptyState title="Aucun projet collaboratif" description="Créez un projet et assignez tous les intervenants du flux contenu." />
      ) : (
        <DataTable<ProjectRow> rows={rows} columns={[
          { key: 't', header: 'Projet', cell: (r) => (
            <button type="button" className="text-left group" onClick={() => onOpenBoard(r)}>
              <span className="font-black text-primary-600 group-hover:underline">{r.title}</span>
              <ChevronRight className="w-3.5 h-3.5 inline ml-1 text-zinc-400 group-hover:text-primary-600" />
            </button>
          )},
          { key: 'st', header: 'Statut', cell: (r) => <StatusChip tone={statusTone(r.status)}>{STATUS_LABELS[r.status] ?? r.status}</StatusChip> },
          { key: 'due', header: 'Échéance', cell: (r) => <span>{fmtDate(r.due_date)}</span> },
          { key: 'members', header: 'Intervenants', cell: (r) => (
            <div className="flex flex-wrap gap-1">
              {(r.members ?? []).slice(0, 3).map((m) => (
                <StatusChip key={m.id} tone={m.is_lead ? 'success' : 'neutral'}>{m.user?.name ?? `#${m.user_id}`} · {ROLE_LABELS[m.project_role] ?? m.project_role}</StatusChip>
              ))}
              {(r.members ?? []).length > 3 && <span className="text-xs text-zinc-500 font-bold">+{(r.members ?? []).length - 3}</span>}
            </div>
          )},
          { key: 'act', header: '', cell: (r) => (
            <div className="flex items-center gap-3">
              {canUpdate && <button type="button" onClick={() => openEdit(r)} className="text-sm font-black text-primary-600 hover:underline"><Pencil className="w-3.5 h-3.5 inline mr-1" />Modifier</button>}
              {canDelete && <button type="button" onClick={() => void remove(r)} className="text-sm font-black text-rose-700 hover:underline inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Suppr.</button>}
            </div>
          )},
        ]} />
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Modifier projet collaboratif' : 'Nouveau projet collaboratif'}
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
                <option value="draft">Brouillon</option><option value="in_progress">En cours</option><option value="blocked">Bloqué</option>
                <option value="review">En révision</option><option value="published">Publié</option><option value="done">Terminé</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">Échéance
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
              <button type="button" onClick={() => setDraft((d) => ({ ...d, members: [...d.members, { user_id: '', project_role: 'content_creator', is_lead: false }] }))} className="text-xs font-black text-primary-700 hover:underline inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Ajouter rôle
              </button>
            </div>
            {draft.members.length === 0 ? <p className="text-xs text-zinc-500">Aucun intervenant ajouté.</p> : (
              <div className="space-y-2">
                {draft.members.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <select value={m.user_id} onChange={(e) => setDraft((d) => ({ ...d, members: d.members.map((x, i) => i === idx ? { ...x, user_id: e.target.value } : x) }))}
                      className="md:col-span-5 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                      <option value="">— Utilisateur —</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <select value={m.project_role} onChange={(e) => setDraft((d) => ({ ...d, members: d.members.map((x, i) => i === idx ? { ...x, project_role: e.target.value as RoleType } : x) }))}
                      className="md:col-span-4 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <label className="md:col-span-2 inline-flex items-center gap-2 text-xs font-bold text-zinc-700">
                      <input type="checkbox" checked={m.is_lead} onChange={(e) => setDraft((d) => ({ ...d, members: d.members.map((x, i) => i === idx ? { ...x, is_lead: e.target.checked } : x) }))} />Lead
                    </label>
                    <button type="button" onClick={() => setDraft((d) => ({ ...d, members: d.members.filter((_, i) => i !== idx) }))}
                      className="md:col-span-1 px-2 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black hover:bg-rose-50">X</button>
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

/* ══════════════════════════════════════════════════════
   Kanban Board
   ══════════════════════════════════════════════════════ */

function KanbanBoard({ project, canUpdate, canDelete, toast, onBack }: {
  project: ProjectRow; canUpdate: boolean; canDelete: boolean;
  toast: ReturnType<typeof useToast>; onBack: () => void;
}) {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);

  // Task modal
  const [taskModal, setTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [taskDraft, setTaskDraft] = useState({ column_id: 0, title: '', description: '', priority: 'medium' as Priority, due_date: '', assigned_to: '' });

  // Column modal
  const [colModal, setColModal] = useState(false);
  const [editingCol, setEditingCol] = useState<KanbanColumn | null>(null);
  const [colDraft, setColDraft] = useState({ title: '', color: '#6366f1' });

  // Drag state
  const dragTask = useRef<{ taskId: number; fromColId: number } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ project: unknown; columns: KanbanColumn[] }>(`collab-projects/${project.id}/board`);
    setLoading(false);
    if (!res.ok) { toast.error(res.message); return; }
    const data = res.data as any;
    const cols = data?.columns ?? data?.data?.columns ?? [];
    if (cols.length === 0) {
      // Auto-create default columns
      for (const def of DEFAULT_COLUMNS) {
        await api.post(`collab-projects/${project.id}/columns`, { title: def.title, color: def.color });
      }
      const retry = await api.get<any>(`collab-projects/${project.id}/board`);
      if (retry.ok) {
        const rd = retry.data as any;
        setColumns(rd?.columns ?? rd?.data?.columns ?? []);
      }
      return;
    }
    setColumns(cols);
  }, [project.id, toast]);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  /* ── Column CRUD ── */

  async function saveColumn() {
    if (!colDraft.title.trim()) { toast.error('Titre requis.'); return; }
    const res = editingCol
      ? await api.put(`collab-projects/${project.id}/columns/${editingCol.id}`, { title: colDraft.title, color: colDraft.color })
      : await api.post(`collab-projects/${project.id}/columns`, { title: colDraft.title, color: colDraft.color });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(editingCol ? 'Colonne mise à jour.' : 'Colonne créée.');
    setColModal(false);
    await loadBoard();
  }

  async function deleteColumn(col: KanbanColumn) {
    if (!window.confirm(`Supprimer la colonne « ${col.title} » et toutes ses tâches ?`)) return;
    const res = await api.del(`collab-projects/${project.id}/columns/${col.id}`);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Colonne supprimée.');
    await loadBoard();
  }

  /* ── Task CRUD ── */

  function openCreateTask(columnId: number) {
    setEditingTask(null);
    setTaskDraft({ column_id: columnId, title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' });
    setTaskModal(true);
  }

  function openEditTask(task: KanbanTask) {
    setEditingTask(task);
    setTaskDraft({
      column_id: task.column_id, title: task.title, description: task.description ?? '',
      priority: task.priority, due_date: task.due_date ?? '', assigned_to: task.assigned_to ? String(task.assigned_to) : '',
    });
    setTaskModal(true);
  }

  async function saveTask() {
    if (!taskDraft.title.trim()) { toast.error('Titre requis.'); return; }
    const payload: Record<string, unknown> = {
      column_id: taskDraft.column_id, title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || null, priority: taskDraft.priority,
      due_date: taskDraft.due_date || null, assigned_to: taskDraft.assigned_to ? Number(taskDraft.assigned_to) : null,
    };
    const res = editingTask
      ? await api.put(`collab-projects/${project.id}/tasks/${editingTask.id}`, payload)
      : await api.post(`collab-projects/${project.id}/tasks`, payload);
    if (!res.ok) { const fe = flattenFieldErrors((res as any).errors ?? {}); toast.error(fe.length ? fe.join(' ') : res.message); return; }
    toast.success(editingTask ? 'Tâche mise à jour.' : 'Tâche créée.');
    setTaskModal(false);
    await loadBoard();
  }

  async function deleteTask(task: KanbanTask) {
    if (!window.confirm(`Supprimer « ${task.title} » ?`)) return;
    const res = await api.del(`collab-projects/${project.id}/tasks/${task.id}`);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Tâche supprimée.');
    await loadBoard();
  }

  /* ── Drag & Drop ── */

  function onDragStart(e: React.DragEvent, task: KanbanTask) {
    dragTask.current = { taskId: task.id, fromColId: task.column_id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(task.id));
  }

  function onDragOverColumn(e: React.DragEvent, colId: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colId);
  }

  function onDragLeaveColumn() {
    setDragOverCol(null);
  }

  async function onDropColumn(e: React.DragEvent, targetColId: number) {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragTask.current) return;
    const { taskId, fromColId } = dragTask.current;
    dragTask.current = null;
    if (fromColId === targetColId) return;

    // Optimistic update
    setColumns((prev) => prev.map((col) => {
      if (col.id === fromColId) return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
      if (col.id === targetColId) {
        const task = prev.find((c) => c.id === fromColId)?.tasks.find((t) => t.id === taskId);
        if (!task) return col;
        return { ...col, tasks: [...col.tasks, { ...task, column_id: targetColId, sort_order: col.tasks.length }] };
      }
      return col;
    }));

    const targetCol = columns.find((c) => c.id === targetColId);
    const newOrder = targetCol ? targetCol.tasks.length : 0;
    const res = await api.post(`collab-projects/${project.id}/tasks/${taskId}/move`, { column_id: targetColId, sort_order: newOrder });
    if (!res.ok) { toast.error(res.message); await loadBoard(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-black text-zinc-600 hover:text-zinc-900">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div>
            <h2 className="text-xl font-black text-zinc-900">{project.title}</h2>
            <p className="text-xs text-zinc-500">
              <StatusChip tone={statusTone(project.status)}>{STATUS_LABELS[project.status]}</StatusChip>
              {project.due_date && <span className="ml-2">Échéance: {fmtDate(project.due_date)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void loadBoard()} className="px-3 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          {canUpdate && (
            <button type="button" onClick={() => { setEditingCol(null); setColDraft({ title: '', color: '#6366f1' }); setColModal(true); }}
              className="px-3 py-2 rounded-2xl bg-zinc-800 text-white text-sm font-black inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Colonne
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-zinc-400 text-sm font-bold">Chargement du tableau…</div>
      ) : columns.length === 0 ? (
        <EmptyState title="Aucune colonne" description="Créez des colonnes pour organiser les tâches du projet." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
          {columns.map((col) => (
            <div
              key={col.id}
              className={`flex-shrink-0 w-72 rounded-2xl bg-zinc-50 border-2 transition-colors ${dragOverCol === col.id ? 'border-primary-400 bg-primary-50' : 'border-zinc-100'}`}
              onDragOver={(e) => onDragOverColumn(e, col.id)}
              onDragLeave={onDragLeaveColumn}
              onDrop={(e) => void onDropColumn(e, col.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-sm font-black text-zinc-800">{col.title}</span>
                  <span className="text-xs font-bold text-zinc-400 bg-zinc-200 rounded-full px-2 py-0.5">{col.tasks.length}</span>
                </div>
                {canUpdate && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => openCreateTask(col.id)} className="p-1 rounded-lg hover:bg-zinc-200 text-zinc-500" title="Ajouter une tâche">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => { setEditingCol(col); setColDraft({ title: col.title, color: col.color }); setColModal(true); }}
                      className="p-1 rounded-lg hover:bg-zinc-200 text-zinc-500" title="Modifier la colonne">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => void deleteColumn(col)} className="p-1 rounded-lg hover:bg-rose-100 text-zinc-500 hover:text-rose-600" title="Supprimer la colonne">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="p-2 space-y-2 min-h-[60px]">
                {col.tasks.map((task) => (
                  <div
                    key={task.id}
                    draggable={canUpdate}
                    onDragStart={(e) => onDragStart(e, task)}
                    className="card p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-zinc-900 flex-1">{task.title}</p>
                      {canUpdate && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button type="button" onClick={() => openEditTask(task)} className="p-1 rounded hover:bg-zinc-100"><Pencil className="w-3 h-3 text-zinc-500" /></button>
                          <button type="button" onClick={() => void deleteTask(task)} className="p-1 rounded hover:bg-rose-50"><Trash2 className="w-3 h-3 text-rose-500" /></button>
                        </div>
                      )}
                    </div>
                    {task.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{task.description}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                      {task.due_date && (
                        <span className="text-[10px] font-bold text-zinc-500 inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{fmtDate(task.due_date)}
                        </span>
                      )}
                      {task.assignee_name && (
                        <span className="text-[10px] font-bold text-zinc-500 inline-flex items-center gap-1">
                          <User className="w-3 h-3" />{task.assignee_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {canUpdate && col.tasks.length === 0 && (
                  <button type="button" onClick={() => openCreateTask(col.id)}
                    className="w-full py-4 border-2 border-dashed border-zinc-200 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-600 hover:border-zinc-300 transition-colors">
                    + Ajouter une tâche
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Column Modal */}
      <Modal open={colModal} onClose={() => setColModal(false)} title={editingCol ? 'Modifier la colonne' : 'Nouvelle colonne'} footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setColModal(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
          <button type="button" onClick={() => void saveColumn()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Enregistrer</button>
        </div>
      }>
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase text-zinc-500">Titre
            <input value={colDraft.title} onChange={(e) => setColDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="Ex: À faire, En cours…" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Couleur
            <div className="mt-1 flex items-center gap-3">
              <input type="color" value={colDraft.color} onChange={(e) => setColDraft((d) => ({ ...d, color: e.target.value }))} className="w-10 h-10 rounded-xl border border-zinc-200 cursor-pointer" />
              <span className="text-sm font-bold text-zinc-600">{colDraft.color}</span>
            </div>
          </label>
        </div>
      </Modal>

      {/* Task Modal */}
      <Modal open={taskModal} onClose={() => setTaskModal(false)} title={editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
        panelClassName="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTaskModal(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
            <button type="button" onClick={() => void saveTask()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">{editingTask ? 'Mettre à jour' : 'Créer'}</button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase text-zinc-500">Titre <span className="text-rose-600">*</span>
            <input value={taskDraft.title} onChange={(e) => setTaskDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="Titre de la tâche" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Description
            <textarea value={taskDraft.description} onChange={(e) => setTaskDraft((d) => ({ ...d, description: e.target.value }))} rows={3} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">Colonne
              <select value={taskDraft.column_id} onChange={(e) => setTaskDraft((d) => ({ ...d, column_id: Number(e.target.value) }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                {columns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Priorité
              <select value={taskDraft.priority} onChange={(e) => setTaskDraft((d) => ({ ...d, priority: e.target.value as Priority }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                <option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option><option value="urgent">Urgente</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">Échéance
              <input type="date" value={taskDraft.due_date} onChange={(e) => setTaskDraft((d) => ({ ...d, due_date: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Assigné à
              <select value={taskDraft.assigned_to} onChange={(e) => setTaskDraft((d) => ({ ...d, assigned_to: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                <option value="">— Non assigné —</option>
                {project.members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user?.name ?? `Utilisateur #${m.user_id}`} · {ROLE_LABELS[m.project_role] ?? m.project_role}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
