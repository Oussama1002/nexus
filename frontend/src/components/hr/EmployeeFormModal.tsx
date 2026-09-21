import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useBrand } from '../../context/BrandContext';
import { useToast } from '../../context/ToastContext';
import * as api from '../../lib/api';
import { cn } from '../../lib/utils';

const STATUS_OPTS = ['active', 'inactive', 'terminated'] as const;
type EmployeeStatus = (typeof STATUS_OPTS)[number];

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  terminated: 'Terminé',
};

const WORK_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

const FIELD_LABEL = 'block text-xs font-semibold text-zinc-900';
const FIELD_INPUT =
  'mt-1.5 w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500';

/** Fields read from an employee row or fiche to prefill the edit form. */
export type EmployeeFormSource = {
  id: number;
  full_name: string;
  role_title?: string | null;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
  salary?: number | string | null;
  salary_hidden?: boolean;
  joined_at?: string | null;
  status: string;
  all_brands?: boolean;
  user?: { id: number; name: string; email: string } | null;
  brand?: { id: number; name: string } | null;
  brands?: { id: number; name: string }[];
};

type Draft = ReturnType<typeof emptyDraft>;

function emptyDraft(brandIds: number[] = []) {
  return {
    full_name: '',
    role_title: '',
    department: '',
    phone: '',
    email: '',
    salary: '' as string,
    joined_at: new Date().toISOString().slice(0, 10),
    status: 'active' as EmployeeStatus,
    all_brands: false,
    brand_ids: brandIds,
    work_start_time: '',
    work_end_time: '',
    lunch_start_time: '',
    lunch_end_time: '',
    work_days: [] as string[],
  };
}

function employeeToDraft(e: EmployeeFormSource): Draft {
  const x = e as EmployeeFormSource & Record<string, unknown>;
  const time = (v: unknown) => (v ? String(v).slice(0, 5) : '');
  return {
    full_name: e.full_name,
    role_title: e.role_title ?? '',
    department: e.department ?? '',
    phone: e.phone ?? '',
    email: e.email ?? e.user?.email ?? '',
    salary: e.salary_hidden ? '' : e.salary != null ? String(e.salary) : '',
    joined_at: e.joined_at ? String(e.joined_at).slice(0, 10) : new Date().toISOString().slice(0, 10),
    status: (STATUS_OPTS.includes(e.status as EmployeeStatus) ? e.status : 'active') as EmployeeStatus,
    all_brands: e.all_brands ?? false,
    brand_ids: e.brands?.map((b) => b.id) ?? (e.brand?.id ? [e.brand.id] : []),
    work_start_time: time(x.work_start_time),
    work_end_time: time(x.work_end_time),
    lunch_start_time: time(x.lunch_start_time),
    lunch_end_time: time(x.lunch_end_time),
    work_days: Array.isArray(x.work_days) ? (x.work_days as string[]) : [],
  };
}

function LookupComboField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    return options.filter((opt) => (q === '' ? true : opt.toLowerCase().includes(q))).slice(0, 12);
  }, [options, value]);

  return (
    <label className={cn(FIELD_LABEL, 'relative')}>
      {label}
      <input
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className={FIELD_INPUT}
        placeholder="Saisir ou choisir dans la liste…"
      />
      {open && filtered.length > 0 ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((opt) => (
            <li key={opt} role="option">
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-800 hover:bg-primary-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}

/** Nouvel employé / Modifier employé — shared by Tableau de bord RH and Fiches employés. */
export function EmployeeFormModal({
  open,
  employee,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = création. */
  employee: EmployeeFormSource | null;
  onClose: () => void;
  onSaved: (employeeId: number) => void;
}) {
  const { hasPermission } = useAuth();
  const { brands, activeBrandId } = useBrand();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [saving, setSaving] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [roleTitleOptions, setRoleTitleOptions] = useState<string[]>([]);
  // Centre de paramètres → RH : fonction → département.
  const [roleDepartments, setRoleDepartments] = useState<{ role_title: string; department: string }[]>([]);

  const isEdit = employee !== null;
  const allowed = isEdit ? hasPermission('hr.update') : hasPermission('hr.create');
  const canViewSalary = hasPermission('hr.view_salary');

  useEffect(() => {
    if (!open) return;
    if (employee) {
      setDraft(employeeToDraft(employee));
    } else {
      const activeId = activeBrandId && activeBrandId !== 'all' ? Number(activeBrandId) : null;
      setDraft(emptyDraft(activeId ? [activeId] : brands[0] ? [Number(brands[0].id)] : []));
    }
    void (async () => {
      const [deptRes, roleRes, mapRes] = await Promise.all([
        api.get<{ values: string[] }>('hr/lookups/department'),
        api.get<{ values: string[] }>('hr/lookups/role_title'),
        api.get<{ role_title: string; department: string }[]>('hr/role-departments', { brandId: false }),
      ]);
      if (deptRes.ok && deptRes.data) setDepartmentOptions(deptRes.data.values ?? []);
      if (roleRes.ok && roleRes.data) setRoleTitleOptions(roleRes.data.values ?? []);
      if (mapRes.ok) setRoleDepartments(mapRes.data ?? []);
    })();
  }, [open, employee]); // eslint-disable-line react-hooks/exhaustive-deps

  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  // Choosing a department narrows the fonction list to the ones mapped to it.
  const roleOptionsForDepartment = useMemo(() => {
    if (!draft.department.trim()) return roleTitleOptions;
    const mapped = roleDepartments.filter((m) => same(m.department, draft.department)).map((m) => m.role_title);
    return mapped.length ? mapped : roleTitleOptions;
  }, [draft.department, roleDepartments, roleTitleOptions]);

  const onRoleChange = (v: string) => {
    const match = roleDepartments.find((m) => same(m.role_title, v));
    setDraft((d) => ({ ...d, role_title: v, department: match ? match.department : d.department }));
  };

  const submit = async () => {
    if (!allowed || saving) return;
    if (!draft.full_name.trim()) {
      toast.error('Le nom complet est obligatoire.');
      return;
    }
    if (!draft.all_brands && draft.brand_ids.length === 0) {
      toast.error('Sélectionnez au moins une marque ou « Toutes les marques ».');
      return;
    }
    const body: Record<string, unknown> = {
      full_name: draft.full_name.trim(),
      role_title: draft.role_title.trim() || undefined,
      department: draft.department.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      email: draft.email.trim() || null,
      joined_at: draft.joined_at || undefined,
      status: isEdit ? draft.status : 'active',
      salary: draft.salary === '' ? undefined : Number(draft.salary),
      work_start_time: draft.work_start_time || undefined,
      work_end_time: draft.work_end_time || undefined,
      lunch_start_time: draft.lunch_start_time || undefined,
      lunch_end_time: draft.lunch_end_time || undefined,
      work_days: draft.work_days.length ? draft.work_days : undefined,
      work_days_per_week: draft.work_days.length || undefined,
      all_brands: draft.all_brands,
      brand_ids: draft.all_brands ? undefined : draft.brand_ids,
    };
    setSaving(true);
    const res = isEdit
      ? await api.put<{ id: number }>(`hr/${employee!.id}`, body)
      : await api.post<{ id: number }>('hr', body);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(isEdit ? 'Employé mis à jour.' : 'Employé créé.');
    onSaved(isEdit ? employee!.id : Number(res.data?.id));
  };

  if (!open || !allowed) return null;

  return (
    <Modal
      open={open}
      panelClassName="max-w-2xl"
      title={isEdit ? 'Modifier employé' : 'Nouvel employé'}
      subtitle={isEdit ? 'Mettez à jour les informations de la fiche employé.' : "Renseignez les informations de l'employé et les marques concernées."}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border font-black text-sm">
            Annuler
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className={`${FIELD_LABEL} md:col-span-2`}>
          Nom complet
          <input
            value={draft.full_name}
            onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
            className={FIELD_INPUT}
          />
        </label>
        <div className={`${FIELD_LABEL} md:col-span-2`}>
          <span>Marque</span>
          <label className="mt-2 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.all_brands}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  all_brands: e.target.checked,
                  brand_ids: e.target.checked ? [] : brands.map((b) => Number(b.id)),
                }))
              }
              className="rounded border-zinc-300"
            />
            <span className="text-sm font-medium text-zinc-800">Toutes les marques</span>
          </label>
          {!draft.all_brands && (
            <div className="mt-3 flex flex-wrap gap-3">
              {brands.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucune marque disponible</p>
              ) : (
                brands.map((b) => {
                  const id = Number(b.id);
                  const checked = draft.brand_ids.includes(id);
                  return (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 cursor-pointer hover:border-primary-400"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft((d) => {
                            const next = checked ? d.brand_ids.filter((x) => x !== id) : [...d.brand_ids, id];
                            // Every brand ticked = "Toutes les marques".
                            return brands.length > 0 && brands.every((br) => next.includes(Number(br.id)))
                              ? { ...d, all_brands: true, brand_ids: [] }
                              : { ...d, brand_ids: next };
                          })
                        }
                        className="rounded border-zinc-300"
                      />
                      <span className="text-sm font-medium text-zinc-800">{b.name}</span>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>
        <LookupComboField
          label="Fonction"
          value={draft.role_title}
          onChange={onRoleChange}
          options={roleOptionsForDepartment}
        />
        <LookupComboField
          label="Département"
          value={draft.department}
          onChange={(v) => setDraft((d) => ({ ...d, department: v }))}
          options={departmentOptions}
        />
        <label className={FIELD_LABEL}>
          Téléphone
          <input
            value={draft.phone}
            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            className={FIELD_INPUT}
          />
        </label>
        <label className={FIELD_LABEL}>
          E-mail
          <input
            type="email"
            name="employee-email"
            autoComplete="nope"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            className={FIELD_INPUT}
            placeholder="prenom.nom@exemple.com"
          />
        </label>
        {canViewSalary ? (
          <label className={FIELD_LABEL}>
            Salaire
            <input
              type="number"
              min={0}
              value={draft.salary}
              onChange={(e) => setDraft((d) => ({ ...d, salary: e.target.value }))}
              className={FIELD_INPUT}
            />
          </label>
        ) : null}
        <label className={FIELD_LABEL}>
          Date d&apos;entrée
          <input
            type="date"
            value={draft.joined_at}
            onChange={(e) => setDraft((d) => ({ ...d, joined_at: e.target.value }))}
            className={FIELD_INPUT}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={FIELD_LABEL}>
            Heure début
            <input
              type="time"
              value={draft.work_start_time}
              onChange={(e) => setDraft((d) => ({ ...d, work_start_time: e.target.value }))}
              className={FIELD_INPUT + ' min-w-0'}
            />
          </label>
          <label className={FIELD_LABEL}>
            Heure fin
            <input
              type="time"
              value={draft.work_end_time}
              onChange={(e) => setDraft((d) => ({ ...d, work_end_time: e.target.value }))}
              className={FIELD_INPUT + ' min-w-0'}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={FIELD_LABEL}>
            Pause déjeuner début
            <input
              type="time"
              value={draft.lunch_start_time}
              onChange={(e) => setDraft((d) => ({ ...d, lunch_start_time: e.target.value }))}
              className={FIELD_INPUT + ' min-w-0'}
            />
          </label>
          <label className={FIELD_LABEL}>
            Pause déjeuner fin
            <input
              type="time"
              value={draft.lunch_end_time}
              onChange={(e) => setDraft((d) => ({ ...d, lunch_end_time: e.target.value }))}
              className={FIELD_INPUT + ' min-w-0'}
            />
          </label>
        </div>
        <fieldset>
          <legend className="text-xs font-semibold text-zinc-900 mb-2">Jours de travail</legend>
          <div className="flex flex-wrap gap-2">
            {WORK_DAYS.map((day) => {
              const checked = draft.work_days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      work_days: checked ? d.work_days.filter((x) => x !== day) : [...d.work_days, day],
                    }))
                  }
                  className={`px-3 py-2 rounded-xl border text-xs font-bold capitalize transition-colors ${
                    checked ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-zinc-600 border-zinc-300 hover:border-primary-400'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </fieldset>
        {isEdit ? (
          <label className={FIELD_LABEL}>
            Statut
            <select
              value={draft.status}
              onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as EmployeeStatus }))}
              className={FIELD_INPUT}
            >
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
