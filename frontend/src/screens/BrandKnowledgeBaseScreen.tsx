import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { DataTable } from '../components/ui/DataTable';
import { FilterBar } from '../components/ui/FilterBar';
import { StatusChip } from '../components/ui/StatusChip';
import * as api from '../lib/api';
import { flattenFieldErrors } from '../lib/formErrors';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';

type KnowledgeCategory = 'sales_script' | 'customer_feedback' | 'product_photo' | 'general';

type BrandKnowledgeItem = {
  id: number;
  category: KnowledgeCategory;
  title: string;
  content: string;
  media_url: string | null;
  product_name: string | null;
  tags: string[] | null;
  is_active: boolean;
  sort_order: number;
  created_by?: { id: number; name: string } | null;
  updated_by?: { id: number; name: string } | null;
  updated_at: string;
};

type Draft = {
  category: KnowledgeCategory;
  title: string;
  content: string;
  media_url: string;
  product_name: string;
  tags: string;
  is_active: boolean;
  sort_order: string;
};

const CATEGORIES: { value: KnowledgeCategory; label: string }[] = [
  { value: 'sales_script', label: 'Scripts de vente' },
  { value: 'customer_feedback', label: 'Retours clients frequents' },
  { value: 'product_photo', label: 'Photos et assets produit' },
  { value: 'general', label: 'Informations generales' },
];

function categoryLabel(v: string): string {
  return CATEGORIES.find((c) => c.value === v)?.label ?? v;
}

function emptyDraft(): Draft {
  return {
    category: 'sales_script',
    title: '',
    content: '',
    media_url: '',
    product_name: '',
    tags: '',
    is_active: true,
    sort_order: '0',
  };
}

function toPayload(draft: Draft): Record<string, unknown> {
  const tags = draft.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    category: draft.category,
    title: draft.title.trim(),
    content: draft.content.trim(),
    media_url: draft.media_url.trim() || null,
    product_name: draft.product_name.trim() || null,
    tags,
    is_active: draft.is_active,
    sort_order: Number.isFinite(Number(draft.sort_order)) ? Number(draft.sort_order) : 0,
  };
}

function fromItem(item: BrandKnowledgeItem): Draft {
  return {
    category: item.category,
    title: item.title,
    content: item.content,
    media_url: item.media_url ?? '',
    product_name: item.product_name ?? '',
    tags: (item.tags ?? []).join(', '),
    is_active: item.is_active,
    sort_order: String(item.sort_order ?? 0),
  };
}

export function BrandKnowledgeBaseScreen() {
  const { activeBrandId } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canManage = hasPermission(['knowledge_base.create', 'knowledge_base.update', 'knowledge_base.delete']);
  const canDelete = hasPermission('knowledge_base.delete');

  const [rows, setRows] = useState<BrandKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<'' | KnowledgeCategory>('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const load = useCallback(async () => {
    if (!activeBrandId) {
      setRows([]);
      return;
    }
    setLoading(true);
    const qs = new URLSearchParams({ per_page: '200' });
    if (q.trim()) qs.set('search', q.trim());
    if (category) qs.set('category', category);
    const res = await api.get<LaravelPaginator<BrandKnowledgeItem>>(`knowledge-base?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setRows([]);
      return;
    }
    setRows(isPaginator<BrandKnowledgeItem>(res.data) ? res.data.data : []);
  }, [activeBrandId, category, q, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const byCategory: Record<KnowledgeCategory, number> = {
      sales_script: 0,
      customer_feedback: 0,
      product_photo: 0,
      general: 0,
    };
    for (const row of rows) {
      if (row.category in byCategory) byCategory[row.category] += 1;
    }
    return byCategory;
  }, [rows]);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setModalOpen(true);
  }

  function openEdit(item: BrandKnowledgeItem) {
    setEditingId(item.id);
    setDraft(fromItem(item));
    setModalOpen(true);
  }

  async function saveItem() {
    if (!draft.title.trim() || !draft.content.trim()) {
      toast.error('Titre et contenu sont obligatoires.');
      return;
    }
    const payload = toPayload(draft);
    const res = editingId
      ? await api.put<BrandKnowledgeItem>(`knowledge-base/${editingId}`, payload)
      : await api.post<BrandKnowledgeItem>('knowledge-base', payload);
    if (!res.ok) {
      const rawErr = 'errors' in res ? res.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      toast.error(fe.length ? fe.join(' ') : res.message);
      return;
    }
    toast.success(editingId ? 'Fiche mise a jour.' : 'Fiche ajoutee.');
    setModalOpen(false);
    void load();
  }

  async function deleteItem(item: BrandKnowledgeItem) {
    if (!window.confirm(`Supprimer la fiche "${item.title}" ?`)) return;
    const res = await api.del(`knowledge-base/${item.id}`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Fiche supprimee.');
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de donnees marque"
        subtitle="Espace centralise par marque: scripts de vente, retours clients et visuels produits."
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Actualiser
            </button>
            {canManage ? (
              <button
                type="button"
                onClick={openCreate}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouvelle fiche
              </button>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CATEGORIES.map((c) => (
          <div key={c.value} className="card p-4">
            <p className="text-[10px] font-black uppercase text-zinc-400">{c.label}</p>
            <p className="text-2xl font-black">{counts[c.value]}</p>
          </div>
        ))}
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        right={
          <select
            value={category}
            onChange={(e) => setCategory((e.target.value as KnowledgeCategory) || '')}
            className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
          >
            <option value="">Toutes categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        }
      />

      {rows.length === 0 && !loading ? (
        <EmptyState title="Aucune fiche" description="Ajoutez scripts, reponses types et assets pour eviter les allers-retours avec le manager." />
      ) : (
        <DataTable<BrandKnowledgeItem>
          rows={rows}
          columns={[
            { key: 'cat', header: 'Categorie', cell: (r) => <StatusChip tone="info">{categoryLabel(r.category)}</StatusChip> },
            { key: 'title', header: 'Titre', cell: (r) => <span className="font-black text-zinc-900">{r.title}</span> },
            {
              key: 'content',
              header: 'Contenu',
              cell: (r) => <span className="text-sm text-zinc-700">{r.content.slice(0, 120)}{r.content.length > 120 ? '…' : ''}</span>,
            },
            { key: 'product', header: 'Produit', cell: (r) => <span className="text-sm">{r.product_name ?? '—'}</span> },
            {
              key: 'state',
              header: 'Statut',
              cell: (r) => <StatusChip tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'Active' : 'Inactive'}</StatusChip>,
            },
            {
              key: 'actions',
              header: '',
              cell: (r) => (
                <div className="flex items-center gap-3">
                  {canManage ? (
                    <button type="button" className="text-sm font-black text-primary-600 hover:underline" onClick={() => openEdit(r)}>
                      Modifier
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button type="button" className="text-sm font-black text-rose-700 hover:underline inline-flex items-center gap-1" onClick={() => void deleteItem(r)}>
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
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
        title={editingId ? 'Modifier fiche marque' : 'Nouvelle fiche marque'}
        subtitle="Accessible a tous les collaborateurs de la marque."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">
              Annuler
            </button>
            <button type="button" onClick={() => void saveItem()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase text-zinc-500">
            Categorie
            <select
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as KnowledgeCategory }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-black uppercase text-zinc-500">
            Titre
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
              placeholder="Ex: Script objection prix"
            />
          </label>

          <label className="block text-xs font-black uppercase text-zinc-500">
            Contenu
            <textarea
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              rows={6}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-medium"
              placeholder="Script, reponse type, infos internes..."
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">
              Produit
              <input
                value={draft.product_name}
                onChange={(e) => setDraft((d) => ({ ...d, product_name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
                placeholder="Optionnel"
              />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">
              URL media
              <input
                value={draft.media_url}
                onChange={(e) => setDraft((d) => ({ ...d, media_url: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
                placeholder="https://..."
              />
            </label>
          </div>

          <label className="block text-xs font-black uppercase text-zinc-500">
            Tags (separes par virgule)
            <input
              value={draft.tags}
              onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              placeholder="upsell, livraison, objection"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">
              Ordre
              <input
                type="number"
                min={0}
                value={draft.sort_order}
                onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              />
            </label>
            <label className="flex items-end gap-2 text-sm font-bold text-zinc-700 pb-1">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              Active
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
