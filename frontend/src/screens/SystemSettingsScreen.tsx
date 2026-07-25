import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { RolePermissionsPanel } from '../components/settings/RolePermissionsPanel';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { cn } from '../lib/utils';

const GROUPS = ['general', 'integrations', 'delivery', 'whatsapp', 'meta', 'finance', 'security'] as const;

const GROUP_LABELS: Record<(typeof GROUPS)[number], string> = {
  general: 'Général',
  integrations: 'Intégrations',
  delivery: 'Livraison',
  whatsapp: 'WhatsApp',
  meta: 'Meta & pub',
  finance: 'Finance',
  security: 'Sécurité',
};

function labelForGroup(slug: string): string {
  return GROUP_LABELS[slug as (typeof GROUPS)[number]] ?? slug;
}

type SettingRow = {
  id: number;
  setting_key: string;
  setting_group: string;
  setting_value: string | null;
  value_type?: string | null;
  is_sensitive?: boolean;
  brand_id?: number | null;
};

export function SystemSettingsScreen({
  onNavigateToUsersAdmin,
}: {
  onNavigateToUsersAdmin?: () => void;
}) {
  const { hasPermission, isAdmin } = useAuth();
  const { activeBrandId } = useBrand();
  const toast = useToast();

  const canView = isAdmin || hasPermission('settings.view');
  const canNavigateUsers = isAdmin || hasPermission('users.view');
  const canViewRoles = isAdmin || hasPermission('roles.view');
  const canListPermissions = isAdmin || hasPermission('permissions.view');
  const canEditRoles = isAdmin || hasPermission('roles.update');
  const canUpdate = isAdmin || hasPermission('settings.update');
  const canCreate = isAdmin || hasPermission('settings.create');
  const canDelete = isAdmin || hasPermission('settings.delete');

  const [tab, setTab] = useState<(typeof GROUPS)[number]>('general');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newGroup, setNewGroup] = useState<(typeof GROUPS)[number]>('general');
  const [newSensitive, setNewSensitive] = useState(false);
  const [newValueType, setNewValueType] = useState('string');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const visibleTabs = GROUPS.filter((g) => g !== 'security' || isAdmin);

  const load = useCallback(async () => {
    if (!canView || !activeBrandId) return;
    setLoading(true);
    setError(null);
    const q = buildQuery({
      per_page: 100,
      setting_group: debouncedSearch ? undefined : tab,
      search: debouncedSearch || undefined,
    });
    const res = await api.get<Paginated<SettingRow>>(`settings${q}`);
    if (res.ok && res.data) {
      setRows(res.data.data);
    } else {
      setError(res.message);
      setRows([]);
    }
    setLoading(false);
  }, [canView, activeBrandId, tab, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (r: SettingRow) => {
    if (!canUpdate) return;
    if (r.is_sensitive && !isAdmin) return;
    setEditId(r.id);
    const masked = r.setting_value === '********';
    setEditVal(masked ? '' : (r.setting_value ?? ''));
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditVal('');
  };

  const saveEdit = async (r: SettingRow) => {
    if (r.is_sensitive && editVal === '') {
      setError('Saisissez une nouvelle valeur pour ce secret.');
      return;
    }
    const res = await api.patch<SettingRow>(`settings/${r.id}`, { setting_value: editVal });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success('Paramètre enregistré.');
    cancelEdit();
    await load();
  };

  const removeRow = async (r: SettingRow) => {
    if (!canDelete) return;
    if (!window.confirm(`Supprimer le paramètre « ${r.setting_key} » ?`)) return;
    const res = await api.del(`settings/${r.id}`);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success('Paramètre supprimé.');
    await load();
  };

  const openCreate = () => {
    setNewGroup(tab);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!newKey.trim()) {
      setError('La clé est obligatoire.');
      return;
    }
    if (newSensitive && !isAdmin) {
      setError('Seuls les administrateurs peuvent créer des secrets.');
      return;
    }
    const res = await api.post<SettingRow>('settings', {
      setting_key: newKey.trim(),
      setting_group: newGroup,
      setting_value: newVal || null,
      value_type: newValueType || 'string',
      is_sensitive: newSensitive,
    });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    toast.success('Paramètre créé.');
    setCreateOpen(false);
    setNewKey('');
    setNewVal('');
    setNewSensitive(false);
    setNewValueType('string');
    await load();
  };

  if (!canView) {
    return (
      <div className="card p-8 text-center text-sm font-bold text-zinc-600">
        Permission <code className="text-zinc-900">settings.view</code> requise (ou rôle administrateur).
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration système"
        subtitle="Contrôle des accès (rôles, utilisateurs) et paramètres applicatifs (clés/valeurs : général, intégrations, livraison, etc.)."
      />

      <div className="card p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-zinc-900">Accès utilisateurs</h2>
            <p className="text-xs font-medium text-zinc-500 mt-1 max-w-2xl">
              Ce qui ouvre ou ferme les modules dans l’application, ce sont les <strong className="text-zinc-700">rôles</strong> et les{' '}
              <strong className="text-zinc-700">marques</strong> assignés à chaque utilisateur. Les permissions fines sont définies par rôle dans la matrice ci‑dessous.
            </p>
          </div>
          {onNavigateToUsersAdmin && canNavigateUsers ? (
            <button
              type="button"
              onClick={onNavigateToUsersAdmin}
              className="shrink-0 px-4 py-2.5 rounded-2xl bg-zinc-900 text-white text-sm font-black shadow-md inline-flex items-center gap-2 hover:bg-zinc-800"
            >
              <Users className="w-4 h-4" />
              Utilisateurs &amp; rôles par compte
            </button>
          ) : (
            <p className="text-xs font-bold text-zinc-400 shrink-0">
              Permission <code className="font-mono text-zinc-600">users.view</code> requise pour gérer les comptes.
            </p>
          )}
        </div>
      </div>

      <RolePermissionsPanel canViewRoles={canViewRoles} canListPermissions={canListPermissions} canEditRoles={canEditRoles} />

      <div className="border-t border-zinc-200 pt-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-black text-zinc-900">Paramètres applicatifs</h2>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate ? (
              <button
                type="button"
                onClick={openCreate}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouveau paramètre
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-2xl border text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir la liste
            </button>
          </div>
        </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 shrink-0">Recherche</label>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Clé ou valeur…"
          className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500"
        />
        {debouncedSearch ? <span className="text-xs font-bold text-zinc-500">Tous les groupes</span> : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>
      ) : null}

      <div className="card p-3 flex flex-wrap gap-2">
        {visibleTabs.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              setTab(g);
              setEditId(null);
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide',
              tab === g && !debouncedSearch ? 'bg-primary-50 text-primary-800' : 'hover:bg-zinc-50 text-zinc-600',
            )}
          >
            {GROUP_LABELS[g]}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">
            <tr>
              <th className="px-4 py-3">Clé</th>
              <th className="px-4 py-3">Groupe</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Valeur</th>
              <th className="px-4 py-3 w-24">Sens.</th>
              <th className="px-4 py-3 w-44 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-mono text-xs text-zinc-800">{r.setting_key}</td>
                <td className="px-4 py-3 text-xs font-bold text-zinc-600">{labelForGroup(r.setting_group)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{r.value_type ?? 'string'}</td>
                <td className="px-4 py-3">
                  {editId === r.id ? (
                    <input
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      placeholder={r.is_sensitive ? 'Nouvelle valeur secrète' : ''}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm"
                    />
                  ) : (
                    <span className="font-bold text-zinc-900 break-all">{r.setting_value ?? '—'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">{r.is_sensitive ? 'oui' : '—'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    {canUpdate && editId === r.id ? (
                      <>
                        <button type="button" onClick={() => void saveEdit(r)} className="text-xs font-black text-primary-700 hover:underline">
                          Enregistrer
                        </button>
                        <button type="button" onClick={cancelEdit} className="text-xs font-black text-zinc-500 hover:underline">
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        {canUpdate && !(r.is_sensitive && !isAdmin) ? (
                          <button type="button" onClick={() => startEdit(r)} className="text-xs font-black text-zinc-600 hover:underline">
                            Modifier
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => void removeRow(r)}
                            className="inline-flex items-center gap-1 text-xs font-black text-rose-600 hover:underline"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading ? (
          <div className="p-8 text-center text-sm text-zinc-600 space-y-2 max-w-lg mx-auto">
            <p className="font-bold text-zinc-800">Aucune ligne en base pour cette marque et ce groupe.</p>
            <p>
              C’est normal tant que vous n’avez pas encore enregistré une section dans l’onglet{' '}
              <strong className="text-zinc-900">Centre de paramètres</strong> : les clés sont créées au premier enregistrement.
              Vous pouvez aussi ajouter une entrée manuelle avec « Nouveau paramètre » ou élargir la recherche (tous les groupes).
            </p>
          </div>
        ) : null}
      </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouveau paramètre"
        subtitle="Clé unique pour la portée globale (sans marque)."
        footer={
          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700">
              Annuler
            </button>
            <button type="button" onClick={() => void submitCreate()} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black">
              Créer
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Clé</label>
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 font-mono text-sm"
              placeholder="ex. app.custom_banner"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Groupe</label>
            <select
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value as (typeof GROUPS)[number])}
              className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm"
            >
              {visibleTabs.map((g) => (
                <option key={g} value={g}>
                  {GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Type</label>
            <select value={newValueType} onChange={(e) => setNewValueType(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-sm">
              <option value="string">string</option>
              <option value="bool">bool</option>
              <option value="int">int</option>
              <option value="json">json</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Valeur</label>
            <textarea
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              rows={3}
              className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm font-medium resize-none"
            />
          </div>
          {isAdmin ? (
            <label className="flex items-center gap-2 text-sm font-bold text-zinc-700 cursor-pointer">
              <input type="checkbox" checked={newSensitive} onChange={(e) => setNewSensitive(e.target.checked)} className="rounded border-zinc-300" />
              Secret (masqué dans les listes)
            </label>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
