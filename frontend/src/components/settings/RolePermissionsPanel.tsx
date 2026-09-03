import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Save, Home } from 'lucide-react';
import * as api from '../../lib/api';
import { buildQuery } from '../../lib/pagination';
import type { Paginated } from '../../lib/pagination';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { permissionDisplayLabelFr, permissionModuleTitleFr } from '../../lib/permissionLabelsFr';
import { NAV_CATALOG } from '../../lib/sidebarNavCatalog';

type PermissionRow = { id: number; slug: string; name: string; module: string | null };
type RoleOpt = { id: number; name: string; slug: string; landing_view?: string | null };
type RoleDetail = RoleOpt & { permissions?: PermissionRow[] };

/** Views eligible to be a landing screen — anything the sidebar can reach. */
const LANDING_VIEW_OPTIONS = NAV_CATALOG
  .filter((e) => !!e.view)
  .map((e) => ({ view: e.view as string, label: e.label }));

function groupByModule(perms: PermissionRow[]): Record<string, PermissionRow[]> {
  const out: Record<string, PermissionRow[]> = {};
  for (const p of perms) {
    const m = p.module ?? 'autre';
    if (!out[m]) out[m] = [];
    out[m].push(p);
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.slug.localeCompare(b.slug));
  }
  return out;
}

export function RolePermissionsPanel({
  canViewRoles,
  canListPermissions,
  canEditRoles,
}: {
  canViewRoles: boolean;
  canListPermissions: boolean;
  canEditRoles: boolean;
}) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  /** Slugs de modules API + liste technique réservée aux administrateurs (vue « développeur »). */
  const showTechnicalMatrix = isAdmin;

  const [roles, setRoles] = useState<RoleOpt[]>([]);
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [roleId, setRoleId] = useState<number | ''>('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRole = useMemo(() => roles.find((r) => r.id === roleId) ?? null, [roles, roleId]);
  const isAdminRole = selectedRole?.slug === 'admin';

  const loadRoles = useCallback(async () => {
    if (!canViewRoles) return;
    const res = await api.get<Paginated<RoleOpt>>(`roles${buildQuery({ per_page: 100 })}`);
    if (res.ok && res.data) {
      setRoles(res.data.data);
    }
  }, [canViewRoles]);

  const loadPermissionsCatalog = useCallback(async () => {
    if (!showTechnicalMatrix) {
      setPerms([]);
      return;
    }
    if (!canListPermissions && !isAdmin) return;
    const res = await api.get<Paginated<PermissionRow>>(`permissions${buildQuery({ per_page: 500 })}`);
    if (res.ok && res.data) {
      setPerms(res.data.data);
    }
  }, [canListPermissions, isAdmin, showTechnicalMatrix]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void loadPermissionsCatalog();
  }, [loadPermissionsCatalog]);

  const loadRoleDetail = useCallback(async (id: number) => {
    setLoading(true);
    const res = await api.get<RoleDetail>(`roles/${id}`);
    setLoading(false);
    if (!res.ok || !res.data) return;
    const ids = (res.data.permissions ?? []).map((p) => p.id);
    setSelected(new Set(ids));
    // Keep the roles list's landing_view in sync so the select reflects the server.
    setRoles((prev) => prev.map((r) => r.id === id ? { ...r, landing_view: res.data!.landing_view ?? null } : r));
  }, []);

  const saveLandingView = useCallback(async (id: number, value: string | null) => {
    const res = await api.patch<RoleOpt>(`roles/${id}/landing-view`, { landing_view: value });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success("Écran d'accueil enregistré.");
    setRoles((prev) => prev.map((r) => r.id === id ? { ...r, landing_view: value } : r));
  }, [toast]);

  useEffect(() => {
    if (!canViewRoles || roles.length === 0) return;
    setRoleId((prev) => {
      if (prev !== '' && roles.some((r) => r.id === prev)) return prev;
      return (roles.find((r) => r.slug !== 'admin') ?? roles[0]).id;
    });
  }, [canViewRoles, roles]);

  useEffect(() => {
    if (!canViewRoles || roleId === '' || !showTechnicalMatrix) return;
    void loadRoleDetail(Number(roleId));
  }, [canViewRoles, roleId, loadRoleDetail, showTechnicalMatrix]);

  const grouped = useMemo(() => groupByModule(perms), [perms]);

  const toggle = (id: number) => {
    if (!canEditRoles || isAdminRole) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModule = (moduleKey: string) => {
    if (!canEditRoles || isAdminRole) return;
    const ids = grouped[moduleKey]?.map((p) => p.id) ?? [];
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!canEditRoles || isAdminRole || roleId === '') return;
    setSaving(true);
    const res = await api.patch<RoleDetail>(`roles/${roleId}`, {
      permission_ids: Array.from(selected),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Permissions du rôle enregistrées.');
    await loadRoles();
    await loadRoleDetail(Number(roleId));
  };

  if (!canViewRoles) {
    return null;
  }

  if (!canListPermissions && !isAdmin) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-700">
        Vous n’avez pas accès à la consultation des rôles et permissions. Pour toute demande, contactez un administrateur système.
      </div>
    );
  }

  if (!showTechnicalMatrix) {
    return (
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-base font-black text-zinc-900">Rôles et accès</h2>
          <p className="text-sm font-medium text-zinc-600 mt-2 leading-relaxed">
            La vue détaillée des permissions (identifiants techniques API, modules et cases à cocher) est réservée aux{' '}
            <strong className="text-zinc-800">administrateurs système</strong>. Elle sert à la configuration avancée et au débogage ; les utilisateurs
            métier n’ont pas besoin de ces libellés.
          </p>
          <p className="text-xs font-medium text-zinc-500 mt-3">
            Pour modifier les droits d’un compte ou les marques assignées, utilisez la section utilisateurs si vous y avez accès, ou contactez un
            administrateur.
          </p>
        </div>
        {roles.length > 0 ? (
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Rôles définis dans l’application</p>
            <ul className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <li
                  key={r.id}
                  className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-sm font-bold text-zinc-800"
                >
                  {r.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-zinc-900">Rôles et permissions API</h2>
          <p className="text-xs font-medium text-zinc-500 mt-1 max-w-2xl">
            <span className="font-bold text-amber-800">Vue administrateur.</span> Cochez les accès accordés à chaque rôle ; les libellés sont en
            français (les identifiants techniques API ne sont pas affichés).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              void loadRoles();
              void loadPermissionsCatalog();
              if (roleId !== '') void loadRoleDetail(Number(roleId));
            }}
            className="px-3 py-2 rounded-xl border text-xs font-black inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Recharger
          </button>
          {canEditRoles ? (
            <button
              type="button"
              disabled={isAdminRole || roleId === '' || saving}
              onClick={() => void save()}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-xs font-black shadow-md shadow-primary-100 hover:bg-primary-700 disabled:opacity-40 inline-flex items-center gap-2"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? '…' : 'Enregistrer le rôle'}
            </button>
          ) : null}
        </div>
      </div>

      {isAdminRole ? (
        <p className="text-xs font-bold text-zinc-600 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2">
          Le rôle administrateur conserve implicitement tous les droits ; la liste n’est pas modifiable ici.
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 shrink-0">Rôle</label>
        <select
          value={roleId === '' ? '' : String(roleId)}
          onChange={(e) => {
            const v = e.target.value;
            setRoleId(v ? Number(v) : '');
          }}
          className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-black text-zinc-900"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {/* Spec Phase 1 §7.3 — landing view per role */}
      {selectedRole && canEditRoles && !isAdminRole && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center rounded-xl border border-zinc-100 bg-blue-50/40 px-4 py-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-blue-800 shrink-0 inline-flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5" /> Écran d'accueil
          </label>
          <select
            value={selectedRole.landing_view ?? ''}
            onChange={(e) => void saveLandingView(selectedRole.id, e.target.value || null)}
            className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-900 bg-white"
          >
            <option value="">— Tableau de bord (par défaut) —</option>
            {LANDING_VIEW_OPTIONS.map((o) => (
              <option key={o.view} value={o.view}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? <p className="text-sm font-bold text-zinc-500">Chargement des permissions du rôle…</p> : null}

      <div className="space-y-4 max-h-[min(520px,55vh)] overflow-y-auto pr-1">
        {Object.keys(grouped)
          .sort((a, b) => a.localeCompare(b))
          .map((moduleKey) => {
            const list = grouped[moduleKey];
            const ids = list.map((p) => p.id);
            const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
            const someOn = ids.some((id) => selected.has(id));
            return (
              <div key={moduleKey} className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-[11px] font-black uppercase tracking-widest text-zinc-600">{permissionModuleTitleFr(moduleKey)}</p>
                  {canEditRoles && !isAdminRole ? (
                    <button
                      type="button"
                      onClick={() => toggleModule(moduleKey)}
                      className="text-[10px] font-black text-primary-700 hover:underline"
                    >
                      {allOn ? 'Tout désélectionner' : someOn ? 'Tout le module' : 'Tout sélectionner'}
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {list.map((p) => (
                    <label
                      key={p.id}
                      className={cn(
                        'flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer hover:bg-white/80',
                        (!canEditRoles || isAdminRole) && 'opacity-70 cursor-default',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-zinc-300"
                        checked={selected.has(p.id)}
                        disabled={!canEditRoles || isAdminRole}
                        onChange={() => toggle(p.id)}
                      />
                      <span className="text-sm font-bold text-zinc-800 leading-snug">
                        {permissionDisplayLabelFr(p.slug, p.module, p.name)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {perms.length === 0 && !loading ? (
        <p className="text-sm font-bold text-zinc-500">Aucune permission chargée depuis l’API.</p>
      ) : null}
    </div>
  );
}
