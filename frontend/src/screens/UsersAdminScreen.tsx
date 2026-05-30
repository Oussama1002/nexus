import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Pencil, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';

type RoleOpt = { id: number; name: string; slug: string };
type BrandOpt = { id: number; name: string };

type UserRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  roles: RoleOpt[];
  brands: BrandOpt[];
};

type EmployeePick = {
  id: number;
  full_name: string;
  phone?: string | null;
  role_title?: string | null;
  department?: string | null;
  all_brands?: boolean;
  brand?: { id: number; name: string } | null;
  brands?: { id: number; name: string }[];
};

const USER_FIELD_LABEL = 'block text-xs font-semibold text-zinc-900';
const USER_FIELD_INPUT =
  'mt-1.5 w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500';

function suggestEmailFromName(fullName: string): string {
  const parts = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '';
  const local = parts.length === 1 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`;
  return `${local.replace(/[^a-z0-9.]/g, '')}@nexus.local`;
}

function suggestRoleIds(roleTitle: string | null | undefined, roles: RoleOpt[]): number[] {
  if (!roleTitle?.trim()) return [];
  const t = roleTitle.toLowerCase();
  const rules: { keys: string[]; slug: string }[] = [
    { keys: ['confirmatrice', 'confirm'], slug: 'confirmatrice' },
    { keys: ['stock', 'magasin', 'entrepôt'], slug: 'stock_manager' },
    { keys: ['community', 'communauté', ' cm'], slug: 'community_manager' },
    { keys: ['influence', 'influ'], slug: 'influence_manager' },
    { keys: ['media', 'buyer', 'achat pub'], slug: 'media_buyer' },
    { keys: ['smm', 'social media'], slug: 'smm' },
    { keys: ['manager', 'chef', 'responsable'], slug: 'manager_operationnel' },
    { keys: ['admin'], slug: 'admin' },
  ];
  for (const rule of rules) {
    if (rule.keys.some((k) => t.includes(k))) {
      const role = roles.find((r) => r.slug === rule.slug);
      if (role) return [role.id];
    }
  }
  return [];
}

function formatValidationErrors(errors: unknown): string {
  if (!errors || typeof errors !== 'object') return '';
  const lines: string[] = [];
  for (const val of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(val)) {
      for (const x of val) {
        if (typeof x === 'string') lines.push(x);
      }
    } else if (typeof val === 'string') {
      lines.push(val);
    }
  }
  return lines.filter(Boolean).join(' ');
}

function apiErrorMessage(message: string, errors: unknown): string {
  const flat = formatValidationErrors(errors);
  if (flat) return flat;
  return message;
}

export function UsersAdminScreen() {
  const { hasPermission } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOpt[]>([]);
  const [brands, setBrands] = useState<BrandOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [newPwd, setNewPwd] = useState('');

  const [employeeCandidates, setEmployeeCandidates] = useState<EmployeePick[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [createDraft, setCreateDraft] = useState({
    employeeId: '' as string,
    name: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
    roleIds: [] as number[],
    brandIds: [] as number[],
  });

  const [editDraft, setEditDraft] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
    roleIds: [] as number[],
    brandIds: [] as number[],
  });

  const canView = hasPermission('users.view');
  const canCreate = hasPermission('users.create');
  const canUpdate = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');

  const loadRefs = useCallback(async () => {
    const [r, b] = await Promise.all([
      api.get<Paginated<RoleOpt>>(`roles${buildQuery({ per_page: 100 })}`),
      api.get<Paginated<BrandOpt & { code?: string }>>(`brands${buildQuery({ per_page: 100 })}`),
    ]);
    if (r.ok && r.data) setRoles(r.data.data);
    if (b.ok && b.data) setBrands(b.data.data.map(({ id, name }) => ({ id, name })));
  }, []);

  const loadUsers = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    const res = await api.get<Paginated<UserRow>>(`users${buildQuery({ per_page: 100 })}`);
    if (res.ok && res.data) {
      setUsers(res.data.data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    void loadRefs();
    void loadUsers();
  }, [canView, loadRefs, loadUsers]);

  const loadEmployeeCandidates = useCallback(async () => {
    if (!hasPermission('hr.view')) {
      setEmployeeCandidates([]);
      return;
    }
    setEmployeesLoading(true);
    const res = await api.get<Paginated<EmployeePick>>(
      `hr${buildQuery({ per_page: 200, without_user: 1, status: 'active' })}`,
    );
    setEmployeesLoading(false);
    if (res.ok && res.data) {
      setEmployeeCandidates(res.data.data);
    } else {
      setEmployeeCandidates([]);
    }
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    void loadEmployeeCandidates();
  }, [createOpen, loadEmployeeCandidates]);

  const applyEmployeeToCreate = (employeeId: string) => {
    setCreateDraft((d) => {
      if (!employeeId) {
        return { ...d, employeeId: '', name: '', email: '', phone: '', roleIds: [], brandIds: [] };
      }
      const emp = employeeCandidates.find((e) => String(e.id) === employeeId);
      if (!emp) return { ...d, employeeId };
      const roleIds = suggestRoleIds(emp.role_title, roles);
      let brandIds: number[] = [];
      if (emp.all_brands) {
        brandIds = brands.map((b) => b.id);
      } else if (emp.brands?.length) {
        brandIds = emp.brands.map((b) => b.id);
      } else if (emp.brand?.id) {
        brandIds = [emp.brand.id];
      }
      return {
        ...d,
        employeeId,
        name: emp.full_name,
        email: d.email.trim() ? d.email : suggestEmailFromName(emp.full_name),
        phone: emp.phone ?? '',
        roleIds: roleIds.length ? roleIds : d.roleIds,
        brandIds: brandIds.length ? brandIds : d.brandIds,
        status: 'active',
      };
    });
  };

  const openCreateUser = () => {
    setCreateDraft({
      employeeId: '',
      name: '',
      email: '',
      phone: '',
      password: '',
      status: 'active',
      roleIds: [],
      brandIds: [],
    });
    setCreateOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setSelected(u);
    setEditDraft({
      name: u.name,
      email: u.email,
      phone: u.phone ?? '',
      password: '',
      status: u.status,
      roleIds: u.roles.map((r) => r.id),
      brandIds: u.brands.map((b) => b.id),
    });
    setEditOpen(true);
  };

  const submitCreate = async () => {
    const name = createDraft.name.trim();
    const email = createDraft.email.trim();
    if (!name || !email) {
      setError('Nom et email sont requis.');
      return;
    }
    if (createDraft.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (createDraft.roleIds.length < 1) {
      setError('Sélectionnez au moins un rôle.');
      return;
    }
    const adminRoleId = roles.find((r) => r.slug === 'admin')?.id;
    const includesAdmin = adminRoleId !== undefined && createDraft.roleIds.includes(adminRoleId);
    if (!includesAdmin && createDraft.brandIds.length < 1) {
      setError('Pour un compte non administrateur, assignez au moins une marque.');
      return;
    }

    const res = await api.post<UserRow>('users', {
      name,
      email,
      phone: createDraft.phone.trim() || undefined,
      password: createDraft.password,
      status: createDraft.status,
      role_ids: createDraft.roleIds,
      brand_ids: createDraft.brandIds,
      employee_id: createDraft.employeeId ? Number(createDraft.employeeId) : undefined,
    });
    if (!res.ok) {
      setError(apiErrorMessage(res.message, res.errors));
      return;
    }
    setCreateOpen(false);
    setCreateDraft({
      employeeId: '',
      name: '',
      email: '',
      phone: '',
      password: '',
      status: 'active',
      roleIds: [],
      brandIds: [],
    });
    await loadUsers();
  };

  const submitEdit = async () => {
    if (!selected) return;
    const body: Record<string, unknown> = {
      name: editDraft.name,
      email: editDraft.email,
      phone: editDraft.phone || undefined,
      status: editDraft.status,
      role_ids: editDraft.roleIds,
      brand_ids: editDraft.brandIds,
    };
    if (editDraft.password.trim()) {
      body.password = editDraft.password;
    }
    const res = await api.patch<UserRow>(`users/${selected.id}`, body);
    if (!res.ok) {
      setError(apiErrorMessage(res.message, res.errors));
      return;
    }
    setEditOpen(false);
    setSelected(null);
    await loadUsers();
  };

  const submitPwd = async () => {
    if (!selected) return;
    if (newPwd.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    const res = await api.post(`users/${selected.id}/reset-password`, { password: newPwd });
    if (!res.ok) {
      setError(apiErrorMessage(res.message, res.errors));
      return;
    }
    setPwdOpen(false);
    setNewPwd('');
    setSelected(null);
  };

  const removeUser = async (u: UserRow) => {
    if (!confirm(`Supprimer ${u.email} ?`)) return;
    const res = await api.del(`users/${u.id}`);
    if (!res.ok) {
      setError(apiErrorMessage(res.message, res.errors));
      return;
    }
    await loadUsers();
  };

  const toggleRole = (draft: typeof createDraft, setDraft: typeof setCreateDraft, id: number) => {
    setDraft((d) => ({
      ...d,
      roleIds: d.roleIds.includes(id) ? d.roleIds.filter((x) => x !== id) : [...d.roleIds, id],
    }));
  };

  const toggleBrand = (draft: typeof createDraft, setDraft: typeof setCreateDraft, id: number) => {
    setDraft((d) => ({
      ...d,
      brandIds: d.brandIds.includes(id) ? d.brandIds.filter((x) => x !== id) : [...d.brandIds, id],
    }));
  };

  const columns = useMemo<Column<UserRow>[]>(
    () => [
      { key: 'name', header: 'Nom', cell: (u) => <span className="font-black text-zinc-900">{u.name}</span> },
      { key: 'email', header: 'Email', cell: (u) => <span className="text-sm text-zinc-700">{u.email}</span> },
      {
        key: 'roles',
        header: 'Rôles',
        cell: (u) => (
          <span className="text-xs text-zinc-600">{u.roles.map((r) => r.slug).join(', ') || '—'}</span>
        ),
      },
      { key: 'status', header: 'Statut', cell: (u) => <span className="text-xs font-black uppercase">{u.status}</span> },
      {
        key: 'actions',
        header: '',
        cell: (u) => (
          <div className="flex gap-1 justify-end">
            {canUpdate && (
              <>
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
                  title="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(u);
                    setPwdOpen(true);
                  }}
                  className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
                  title="Mot de passe"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
              </>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => void removeUser(u)}
                className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [canUpdate, canDelete],
  );

  if (!canView) {
    return (
      <div className="card p-8 text-center text-sm font-bold text-zinc-600">
        Permission <code className="text-zinc-900">users.view</code> requise.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilisateurs"
        subtitle="Gestion des comptes (API `/users`)."
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="px-4 py-2 rounded-2xl border text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={openCreateUser}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Nouvel utilisateur
              </button>
            )}
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      )}

      <DataTable rows={users} columns={columns} emptyTitle="Aucun utilisateur" emptyDescription="—" />

      {canCreate && (
        <Modal
          open={createOpen}
          title="Créer utilisateur"
          subtitle="Importez les informations depuis un employé sans compte, puis complétez l’e-mail et le mot de passe."
          onClose={() => setCreateOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-3 rounded-xl border font-black text-sm">
                Annuler
              </button>
              <button type="button" onClick={() => void submitCreate()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm">
                Créer
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            {hasPermission('hr.view') ? (
              <label className={USER_FIELD_LABEL}>
                Employé source
                <select
                  value={createDraft.employeeId}
                  onChange={(e) => applyEmployeeToCreate(e.target.value)}
                  className={USER_FIELD_INPUT}
                  disabled={employeesLoading}
                >
                  <option value="">— Saisie manuelle —</option>
                  {employeeCandidates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name}
                      {e.role_title ? ` · ${e.role_title}` : ''}
                      {e.brand?.name ? ` · ${e.brand.name}` : ''}
                    </option>
                  ))}
                </select>
                {employeesLoading ? (
                  <p className="mt-1 text-xs text-zinc-500">Chargement des employés…</p>
                ) : employeeCandidates.length === 0 ? (
                  <p className="mt-1 text-xs text-zinc-500">Aucun employé actif sans compte utilisateur.</p>
                ) : null}
              </label>
            ) : null}
            <label className={USER_FIELD_LABEL}>
              Nom
              <input
                value={createDraft.name}
                onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))}
                className={USER_FIELD_INPUT}
              />
            </label>
            <label className={USER_FIELD_LABEL}>
              Email
              <input
                type="email"
                value={createDraft.email}
                onChange={(e) => setCreateDraft((d) => ({ ...d, email: e.target.value }))}
                className={USER_FIELD_INPUT}
                placeholder="ex. prenom.nom@nexus.local"
              />
            </label>
            <label className={USER_FIELD_LABEL}>
              Téléphone
              <input
                value={createDraft.phone}
                onChange={(e) => setCreateDraft((d) => ({ ...d, phone: e.target.value }))}
                className={USER_FIELD_INPUT}
              />
            </label>
            <label className={USER_FIELD_LABEL}>
              Mot de passe
              <input
                type="password"
                value={createDraft.password}
                onChange={(e) => setCreateDraft((d) => ({ ...d, password: e.target.value }))}
                className={USER_FIELD_INPUT}
                placeholder="8 caractères minimum"
              />
            </label>
            <p className="text-xs font-semibold text-zinc-900">Rôles</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRole(createDraft, setCreateDraft, r.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-black border ${
                    createDraft.roleIds.includes(r.id) ? 'bg-primary-50 border-primary-300 text-primary-800' : 'border-zinc-200'
                  }`}
                >
                  {r.slug}
                </button>
              ))}
            </div>
            <p className="text-xs font-semibold text-zinc-900">Marques</p>
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBrand(createDraft, setCreateDraft, b.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-black border ${
                    createDraft.brandIds.includes(b.id) ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'border-zinc-200'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {canUpdate && (
        <Modal
          open={editOpen && !!selected}
          title={selected ? `Modifier — ${selected.email}` : 'Modifier'}
          onClose={() => setEditOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditOpen(false)} className="flex-1 py-3 rounded-xl border font-black text-sm">
                Annuler
              </button>
              <button type="button" onClick={() => void submitEdit()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm">
                Enregistrer
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <input
              value={editDraft.name}
              onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border"
            />
            <input
              value={editDraft.email}
              onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border"
            />
            <input
              placeholder="Nouveau mot de passe (optionnel)"
              type="password"
              value={editDraft.password}
              onChange={(e) => setEditDraft((d) => ({ ...d, password: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border"
            />
            <p className="text-[10px] font-black uppercase text-zinc-400">Rôles</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    setEditDraft((d) => ({
                      ...d,
                      roleIds: d.roleIds.includes(r.id) ? d.roleIds.filter((x) => x !== r.id) : [...d.roleIds, r.id],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-black border ${
                    editDraft.roleIds.includes(r.id) ? 'bg-primary-50 border-primary-300 text-primary-800' : 'border-zinc-200'
                  }`}
                >
                  {r.slug}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-black uppercase text-zinc-400">Marques</p>
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() =>
                    setEditDraft((d) => ({
                      ...d,
                      brandIds: d.brandIds.includes(b.id) ? d.brandIds.filter((x) => x !== b.id) : [...d.brandIds, b.id],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-black border ${
                    editDraft.brandIds.includes(b.id) ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'border-zinc-200'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {canUpdate && (
        <Modal
          open={pwdOpen && !!selected}
          title={selected ? `Mot de passe — ${selected.email}` : 'Mot de passe'}
          onClose={() => setPwdOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setPwdOpen(false)} className="flex-1 py-3 rounded-xl border font-black text-sm">
                Annuler
              </button>
              <button type="button" onClick={() => void submitPwd()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm">
                Mettre à jour
              </button>
            </div>
          }
        >
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border"
          />
        </Modal>
      )}
    </div>
  );
}
