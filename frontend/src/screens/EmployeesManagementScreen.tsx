import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Plus, RefreshCw, UserPlus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { StatusChip } from '../components/ui/StatusChip';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { cn } from '../lib/utils';
import { organizationRoleLabel, type OrganizationRoleOption } from '../lib/organizationRoles';

type EmployeeRow = {
  id: number;
  full_name: string;
  role_title?: string | null;
  department?: string | null;
  phone?: string | null;
  salary?: number | string | null;
  salary_hidden?: boolean;
  joined_at?: string | null;
  status: string;
  all_brands?: boolean;
  user?: { id: number; name: string; email: string } | null;
  brand?: { id: number; name: string } | null;
  brands?: { id: number; name: string }[];
};

const STATUS_OPTS = ['active', 'inactive', 'terminated'] as const;

const EMPLOYEE_FIELD_LABEL = 'block text-xs font-semibold text-zinc-900';
const EMPLOYEE_FIELD_INPUT =
  'mt-1.5 w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500';

function LookupComboField({
  label,
  hint,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  const listId = useId();
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const matches = options.filter((opt) => (q === '' ? true : opt.toLowerCase().includes(q)));
    return matches.slice(0, 12);
  }, [options, value]);

  const showSuggestions = suggestionsOpen && !disabled && filteredOptions.length > 0;

  return (
    <label className={cn(EMPLOYEE_FIELD_LABEL, 'relative')}>
      {label}
      {hint ? <span className="ml-1 text-[10px] font-normal text-zinc-500">{hint}</span> : null}
      <input
        list={listId}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setSuggestionsOpen(true)}
        onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
        className={EMPLOYEE_FIELD_INPUT}
        placeholder="Saisir ou choisir dans la liste…"
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      {showSuggestions ? (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {filteredOptions.map((opt) => (
            <li key={opt} role="option">
              <button
                type="button"
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-zinc-800 hover:bg-primary-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setSuggestionsOpen(false);
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
const LESSON_CATEGORIES = ['sales', 'product', 'process', 'faq', 'general'] as const;
const ATTENDANCE_STATUS = ['present', 'late', 'absent'] as const;

type AcademyLesson = {
  id: number;
  title: string;
  category: (typeof LESSON_CATEGORIES)[number] | string;
  content: string;
  media_url: string | null;
  created_by?: { id: number; name: string } | null;
};

type AttendanceRow = {
  id: number;
  attendance_date: string;
  status: (typeof ATTENDANCE_STATUS)[number];
  was_late: boolean;
  minutes_late: number;
  clock_in_at: string | null;
  justification_status: 'pending' | 'justified' | 'unjustified';
  justification_reason: string | null;
  justification_attachment_url: string | null;
  employee?: { id: number; full_name: string } | null;
};

type PayrollRow = {
  employee_id: number;
  full_name: string;
  base_salary: number;
  present_days: number;
  late_days: number;
  absent_days: number;
  unjustified_absences: number;
  absence_deduction: number;
  estimated_net_salary: number;
};

export function EmployeesManagementScreen() {
  const { hasPermission } = useAuth();
  const { brands, activeBrandId } = useBrand();
  const toast = useToast();
  const [tab, setTab] = useState<'employees' | 'academy' | 'attendance' | 'payroll'>('employees');

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [academyOpen, setAcademyOpen] = useState(false);
  const [draft, setDraft] = useState({
    full_name: '',
    role_title: '',
    department: '',
    phone: '',
    salary: '' as string,
    joined_at: new Date().toISOString().slice(0, 10),
    status: 'active' as (typeof STATUS_OPTS)[number],
    user_id: '' as string,
    all_brands: false,
    brand_ids: [] as number[],
  });
  const [academyRows, setAcademyRows] = useState<AcademyLesson[]>([]);
  const [academySearch, setAcademySearch] = useState('');
  const [academyDraft, setAcademyDraft] = useState({
    title: '',
    category: 'sales' as (typeof LESSON_CATEGORIES)[number],
    content: '',
    media_url: '',
  });
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);

  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [markOpen, setMarkOpen] = useState(false);
  const [justifyOpen, setJustifyOpen] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<number | null>(null);
  const [markDraft, setMarkDraft] = useState({
    employee_id: '',
    attendance_date: new Date().toISOString().slice(0, 10),
    status: 'present' as (typeof ATTENDANCE_STATUS)[number],
    minutes_late: '0',
    justification_status: 'pending' as 'pending' | 'justified' | 'unjustified',
    justification_reason: '',
    justification_attachment_url: '',
  });
  const [justifyDraft, setJustifyDraft] = useState({
    justification_reason: '',
    justification_attachment_url: '',
    justification_status: 'pending' as 'pending' | 'justified' | 'unjustified',
  });

  const [payrollMonth, setPayrollMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [organizationRoles, setOrganizationRoles] = useState<OrganizationRoleOption[]>([]);

  const canView = hasPermission('hr.view');
  const canCreate = hasPermission('hr.create');
  const canUpdate = hasPermission('hr.update');
  const canViewSalary = hasPermission('hr.view_salary');

  const load = useCallback(async () => {
    if (!canView) return;
    setError(null);
    setLoading(true);
    const res = await api.get<Paginated<EmployeeRow>>(
      `hr${buildQuery({ per_page: 100, search: q.trim() || undefined, status: statusFilter || undefined })}`,
    );
    if (res.ok && res.data) {
      setRows(res.data.data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [canView, q, statusFilter]);

  useEffect(() => {
    if (tab === 'employees' || tab === 'attendance') void load();
  }, [load, tab]);

  const loadAcademy = useCallback(async () => {
    const res = await api.get<Paginated<AcademyLesson>>(
      `academy/lessons${buildQuery({ per_page: 200, search: academySearch.trim() || undefined })}`,
    );
    if (res.ok && res.data) setAcademyRows(res.data.data);
    else if (!res.ok) toast.error(res.message);
  }, [academySearch, toast]);

  useEffect(() => {
    if (tab === 'academy') void loadAcademy();
  }, [tab, loadAcademy]);

  const loadAttendance = useCallback(async () => {
    if (!canView) return;
    const res = await api.get<Paginated<AttendanceRow>>(
      `hr/attendance${buildQuery({ per_page: 200, date: attendanceDate })}`,
    );
    if (res.ok && res.data) setAttendanceRows(res.data.data);
    else if (!res.ok) toast.error(res.message);
  }, [attendanceDate, canView, toast]);

  useEffect(() => {
    if (tab === 'attendance') void loadAttendance();
  }, [tab, loadAttendance]);

  const loadPayroll = useCallback(async () => {
    if (!canView) return;
    setPayrollLoading(true);
    const res = await api.get<{ employees: PayrollRow[] }>(
      `hr/payroll-summary${buildQuery({ month: payrollMonth })}`,
    );
    setPayrollLoading(false);
    if (res.ok && res.data) setPayrollRows(res.data.employees ?? []);
    else if (!res.ok) toast.error(res.message);
  }, [canView, payrollMonth, toast]);

  useEffect(() => {
    if (tab === 'payroll') void loadPayroll();
  }, [tab, loadPayroll]);

  const loadHrLookups = useCallback(async () => {
    const [deptRes, roleRes] = await Promise.all([
      api.get<{ values: string[] }>('hr/lookups/department'),
      api.get<{ roles: OrganizationRoleOption[] }>('hr/lookups/role_title'),
    ]);
    if (deptRes.ok && deptRes.data) setDepartmentOptions(deptRes.data.values ?? []);
    if (roleRes.ok && roleRes.data) setOrganizationRoles(roleRes.data.roles ?? []);
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    void loadHrLookups();
  }, [createOpen, loadHrLookups]);

  const openCreateEmployee = () => {
    setDraft({
      full_name: '',
      role_title: '',
      department: '',
      phone: '',
      salary: '',
      joined_at: new Date().toISOString().slice(0, 10),
      status: 'active',
      user_id: '',
      all_brands: false,
      brand_ids: activeBrandId
        ? [Number(activeBrandId)]
        : brands[0]
          ? [Number(brands[0].id)]
          : [],
    });
    setCreateOpen(true);
  };

  const columns = useMemo<Column<EmployeeRow>[]>(
    () => [
      { key: 'name', header: 'Nom', cell: (e) => <span className="font-black text-zinc-900">{e.full_name}</span> },
      {
        key: 'brand',
        header: 'Marque',
        cell: (e) => (
          <span className="text-sm text-zinc-600">
            {e.all_brands
              ? 'Toutes les marques'
              : e.brands?.length
                ? e.brands.map((b) => b.name).join(', ')
                : e.brand?.name ?? '—'}
          </span>
        ),
      },
      {
        key: 'role',
        header: 'Fonction',
        cell: (e) => (
          <span className="text-sm text-zinc-700">{organizationRoleLabel(e.role_title)}</span>
        ),
      },
      { key: 'dept', header: 'Département', cell: (e) => <span className="text-sm text-zinc-600">{e.department || '—'}</span> },
      {
        key: 'salary',
        header: 'Salaire',
        cell: (e) => (
          <span className="text-sm font-bold text-zinc-800">
            {e.salary_hidden ? '—' : e.salary != null ? String(e.salary) : '—'}
          </span>
        ),
      },
      { key: 'status', header: 'Statut', cell: (e) => <span className="text-xs font-black uppercase text-zinc-600">{e.status}</span> },
      {
        key: 'user',
        header: 'Utilisateur',
        cell: (e) => <span className="text-xs text-zinc-600">{e.user?.email ?? '—'}</span>,
      },
    ],
    [],
  );

  const submitCreate = async () => {
    if (!canCreate) return;
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
      joined_at: draft.joined_at || undefined,
      status: 'active',
      salary: draft.salary === '' ? undefined : Number(draft.salary),
      all_brands: draft.all_brands,
      brand_ids: draft.all_brands ? undefined : draft.brand_ids,
    };
    const res = await api.post<EmployeeRow>('hr', body);
    if (!res.ok) {
      setError(res.message);
      toast.error(res.message);
      return;
    }
    setCreateOpen(false);
    setDraft({
      full_name: '',
      role_title: '',
      department: '',
      phone: '',
      salary: '',
      joined_at: new Date().toISOString().slice(0, 10),
      status: 'active',
      user_id: '',
      all_brands: false,
      brand_ids: [],
    });
    toast.success('Employe cree.');
    await load();
  };

  const submitAcademy = async () => {
    if (!academyDraft.title.trim() || !academyDraft.content.trim()) {
      toast.error('Titre et contenu requis.');
      return;
    }
    const body = {
      title: academyDraft.title.trim(),
      category: academyDraft.category,
      content: academyDraft.content.trim(),
      media_url: academyDraft.media_url.trim() || null,
    };
    const res = editingLessonId
      ? await api.put(`academy/lessons/${editingLessonId}`, body)
      : await api.post('academy/lessons', body);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(editingLessonId ? 'Contenu formation mis a jour.' : 'Contenu formation cree.');
    setAcademyOpen(false);
    setEditingLessonId(null);
    setAcademyDraft({ title: '', category: 'sales', content: '', media_url: '' });
    await loadAcademy();
  };

  const submitManagerMark = async () => {
    if (!markDraft.employee_id) {
      toast.error('Choisissez un employe.');
      return;
    }
    const res = await api.post('hr/attendance/manager-mark', {
      employee_id: Number(markDraft.employee_id),
      attendance_date: markDraft.attendance_date,
      status: markDraft.status,
      minutes_late: markDraft.status === 'late' ? Number(markDraft.minutes_late || 0) : 0,
      justification_status: markDraft.justification_status,
      justification_reason: markDraft.justification_reason || null,
      justification_attachment_url: markDraft.justification_attachment_url || null,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    setMarkOpen(false);
    await loadAttendance();
  };

  const submitJustification = async () => {
    if (!selectedAttendanceId) return;
    if (!justifyDraft.justification_reason.trim()) {
      toast.error('La raison de justification est obligatoire.');
      return;
    }
    const res = await api.patch(`hr/attendance/${selectedAttendanceId}/justify`, {
      justification_reason: justifyDraft.justification_reason.trim(),
      justification_attachment_url: justifyDraft.justification_attachment_url.trim() || null,
      justification_status: canUpdate ? justifyDraft.justification_status : undefined,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Justification enregistree.');
    setJustifyOpen(false);
    setSelectedAttendanceId(null);
    await loadAttendance();
  };

  const clockInNow = async () => {
    const res = await api.post('hr/attendance/clock-in', {});
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    await loadAttendance();
  };

  if (!canView) {
    return (
      <div className="card p-8 text-center text-sm font-bold text-zinc-600">
        Permission <code className="text-zinc-900">hr.view</code> requise.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="RH — Operations"
        subtitle="Employes, academy, presences/absences/retards, et base paie mensuelle."
        right={
          <div className="flex gap-2">
            <button type="button" onClick={() => void clockInNow()} className="px-4 py-2 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-black">
              Pointer maintenant
            </button>
            {tab === 'employees' ? (
              <button
                type="button"
                onClick={() => void load()}
                className="px-4 py-2 rounded-2xl border border-zinc-200 text-sm font-black inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
              </button>
            ) : null}
            {canCreate && tab === 'employees' && (
              <button
                type="button"
                onClick={openCreateEmployee}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Ajouter
              </button>
            )}
            {canUpdate && tab === 'academy' ? (
              <button
                type="button"
                onClick={() => {
                  setEditingLessonId(null);
                  setAcademyDraft({ title: '', category: 'sales', content: '', media_url: '' });
                  setAcademyOpen(true);
                }}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouveau contenu
              </button>
            ) : null}
            {canUpdate && tab === 'attendance' ? (
              <button
                type="button"
                onClick={() => setMarkOpen(true)}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black"
              >
                Marquer presence/absence
              </button>
            ) : null}
          </div>
        }
      />

      <div className="card p-3 flex flex-wrap items-center gap-2">
        {[
          { id: 'employees', label: 'Employes' },
          { id: 'academy', label: 'Brandna academy' },
          { id: 'attendance', label: 'Presences / absences / retards' },
          { id: 'payroll', label: 'Synthese paie mensuelle' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-black transition-colors',
              tab === t.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-zinc-50 text-zinc-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      )}

      {tab === 'employees' && (
        <>
          <FilterBar
            query={q}
            onQueryChange={setQ}
            left={
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-bold"
              >
                <option value="">Tous statuts</option>
                {STATUS_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            }
          />
          <DataTable rows={rows} columns={columns} emptyTitle="Aucun employé" emptyDescription="Créez un employé ou modifiez les filtres." />
        </>
      )}

      {tab === 'academy' && (
        <>
          <FilterBar query={academySearch} onQueryChange={setAcademySearch} right={<button type="button" className="text-sm font-black" onClick={() => void loadAcademy()}>Actualiser</button>} />
          <DataTable<AcademyLesson>
            rows={academyRows}
            columns={[
              { key: 'title', header: 'Titre', cell: (r) => <span className="font-black text-zinc-900">{r.title}</span> },
              { key: 'cat', header: 'Categorie', cell: (r) => <StatusChip tone="info">{r.category}</StatusChip> },
              { key: 'content', header: 'Contenu', cell: (r) => <span className="text-sm">{r.content.slice(0, 120)}{r.content.length > 120 ? '…' : ''}</span> },
              { key: 'author', header: 'Auteur', cell: (r) => <span className="text-xs text-zinc-600">{r.created_by?.name ?? '—'}</span> },
              {
                key: 'act',
                header: '',
                cell: (r) => canUpdate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLessonId(r.id);
                      setAcademyDraft({ title: r.title, category: (r.category as (typeof LESSON_CATEGORIES)[number]) ?? 'general', content: r.content, media_url: r.media_url ?? '' });
                      setAcademyOpen(true);
                    }}
                    className="text-sm font-black text-primary-600 hover:underline"
                  >
                    Modifier
                  </button>
                ) : <span />
              },
            ]}
            emptyTitle="Aucun contenu"
            emptyDescription="Ajoutez des contenus de formation pre-enregistres."
          />
        </>
      )}

      {tab === 'attendance' && (
        <>
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <label className="text-[10px] font-black uppercase text-zinc-400">
              Date
              <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="mt-1 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" />
            </label>
            <button type="button" onClick={() => void loadAttendance()} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">
              Rafraichir
            </button>
          </div>
          <DataTable<AttendanceRow>
            rows={attendanceRows}
            columns={[
              { key: 'emp', header: 'Employe', cell: (r) => <span className="font-black">{r.employee?.full_name ?? '—'}</span> },
              { key: 'd', header: 'Date', cell: (r) => <span>{r.attendance_date}</span> },
              { key: 's', header: 'Statut', cell: (r) => <StatusChip tone={r.status === 'absent' ? 'danger' : r.status === 'late' ? 'warning' : 'success'}>{r.status}</StatusChip> },
              { key: 'ci', header: 'Pointage', cell: (r) => <span className="text-sm">{r.clock_in_at ? new Date(r.clock_in_at).toLocaleTimeString() : '—'}</span> },
              { key: 'late', header: 'Retard (min)', cell: (r) => <span>{r.minutes_late || 0}</span> },
              { key: 'js', header: 'Justification', cell: (r) => <StatusChip tone={r.justification_status === 'justified' ? 'success' : r.justification_status === 'unjustified' ? 'danger' : 'warning'}>{r.justification_status}</StatusChip> },
              {
                key: 'act',
                header: '',
                cell: (r) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAttendanceId(r.id);
                      setJustifyDraft({
                        justification_reason: r.justification_reason ?? '',
                        justification_attachment_url: r.justification_attachment_url ?? '',
                        justification_status: r.justification_status,
                      });
                      setJustifyOpen(true);
                    }}
                    className="text-sm font-black text-primary-600 hover:underline"
                  >
                    Justifier
                  </button>
                ),
              },
            ]}
            emptyTitle="Aucun pointage"
            emptyDescription="Le manager peut marquer presences/absences/retards quotidiennement."
          />
        </>
      )}

      {tab === 'payroll' && (
        <>
          <div className="card p-4 flex items-end gap-3">
            <label className="text-[10px] font-black uppercase text-zinc-400">
              Mois
              <input type="month" value={payrollMonth} onChange={(e) => setPayrollMonth(e.target.value)} className="mt-1 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold" />
            </label>
            <button type="button" onClick={() => void loadPayroll()} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">
              Calculer
            </button>
          </div>
          <DataTable<PayrollRow>
            rows={payrollRows}
            columns={[
              { key: 'n', header: 'Employe', cell: (r) => <span className="font-black">{r.full_name}</span> },
              { key: 'base', header: 'Salaire base', cell: (r) => <span>{canViewSalary ? r.base_salary.toFixed(2) : '—'}</span> },
              { key: 'p', header: 'Presents', cell: (r) => <span>{r.present_days}</span> },
              { key: 'l', header: 'Retards', cell: (r) => <span>{r.late_days}</span> },
              { key: 'a', header: 'Absences', cell: (r) => <span>{r.absent_days}</span> },
              { key: 'u', header: 'Absences non justifiees', cell: (r) => <span>{r.unjustified_absences}</span> },
              { key: 'd', header: 'Deduction', cell: (r) => <span>{canViewSalary ? r.absence_deduction.toFixed(2) : '—'}</span> },
              { key: 'net', header: 'Net estime', cell: (r) => <span className="font-black">{canViewSalary ? r.estimated_net_salary.toFixed(2) : '—'}</span> },
            ]}
            emptyTitle={payrollLoading ? 'Calcul en cours…' : 'Aucune donnee paie'}
            emptyDescription="Les absences/justifications alimentent automatiquement ce calcul mensuel."
          />
        </>
      )}

      {canCreate && (
        <Modal
          open={createOpen}
          title="Nouvel employé"
          subtitle="Renseignez les informations de l'employé et les marques concernées."
          onClose={() => setCreateOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-3 rounded-xl border font-black text-sm">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void submitCreate()}
                className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm"
              >
                Créer
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className={`${EMPLOYEE_FIELD_LABEL} md:col-span-2`}>
              Nom complet
              <input
                value={draft.full_name}
                onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
                className={EMPLOYEE_FIELD_INPUT}
              />
            </label>
            <div className={`${EMPLOYEE_FIELD_LABEL} md:col-span-2`}>
              <span>Marque</span>
              <label className="mt-2 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.all_brands}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      all_brands: e.target.checked,
                      brand_ids: e.target.checked ? [] : d.brand_ids,
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
                              setDraft((d) => ({
                                ...d,
                                brand_ids: checked
                                  ? d.brand_ids.filter((x) => x !== id)
                                  : [...d.brand_ids, id],
                              }))
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
            <label className={EMPLOYEE_FIELD_LABEL}>
              Fonction
              <span className="ml-1 text-[10px] font-normal text-zinc-500">même liste que les utilisateurs</span>
              <select
                value={draft.role_title}
                onChange={(e) => setDraft((d) => ({ ...d, role_title: e.target.value }))}
                className={EMPLOYEE_FIELD_INPUT}
              >
                <option value="">— Choisir une fonction —</option>
                {organizationRoles.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <LookupComboField
              label="Département"
              value={draft.department}
              onChange={(v) => setDraft((d) => ({ ...d, department: v }))}
              options={departmentOptions}
            />
            <label className={EMPLOYEE_FIELD_LABEL}>
              Téléphone
              <input
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                className={EMPLOYEE_FIELD_INPUT}
              />
            </label>
            {canViewSalary ? (
              <label className={EMPLOYEE_FIELD_LABEL}>
                Salaire
                <input
                  type="number"
                  min={0}
                  value={draft.salary}
                  onChange={(e) => setDraft((d) => ({ ...d, salary: e.target.value }))}
                  className={EMPLOYEE_FIELD_INPUT}
                />
              </label>
            ) : null}
            <label className={EMPLOYEE_FIELD_LABEL}>
              Date d&apos;entrée
              <input
                type="date"
                value={draft.joined_at}
                onChange={(e) => setDraft((d) => ({ ...d, joined_at: e.target.value }))}
                className={EMPLOYEE_FIELD_INPUT}
              />
            </label>
          </div>
          {!canUpdate && (
            <p className="mt-4 text-xs text-zinc-500">La modification ultérieure nécessite `hr.update`.</p>
          )}
        </Modal>
      )}

      {canUpdate && (
        <Modal
          open={academyOpen}
          title={editingLessonId ? 'Modifier contenu academy' : 'Nouveau contenu academy'}
          subtitle="Contenus pre-enregistres de formation (Brandna academy)."
          onClose={() => setAcademyOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setAcademyOpen(false)} className="flex-1 py-3 rounded-xl border font-black text-sm">
                Annuler
              </button>
              <button type="button" onClick={() => void submitAcademy()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm">
                Enregistrer
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Titre
              <input value={academyDraft.title} onChange={(e) => setAcademyDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Categorie
              <select value={academyDraft.category} onChange={(e) => setAcademyDraft((d) => ({ ...d, category: e.target.value as (typeof LESSON_CATEGORIES)[number] }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold">
                {LESSON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Contenu
              <textarea value={academyDraft.content} onChange={(e) => setAcademyDraft((d) => ({ ...d, content: e.target.value }))} rows={6} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              URL media (optionnel)
              <input value={academyDraft.media_url} onChange={(e) => setAcademyDraft((d) => ({ ...d, media_url: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
            </label>
          </div>
        </Modal>
      )}

      {canUpdate && (
        <Modal
          open={markOpen}
          title="Marquage quotidien"
          subtitle="Le manager enregistre presence, absence ou retard."
          onClose={() => setMarkOpen(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setMarkOpen(false)} className="flex-1 py-3 rounded-xl border font-black text-sm">
                Annuler
              </button>
              <button type="button" onClick={() => void submitManagerMark()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm">
                Enregistrer
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Employe
              <select value={markDraft.employee_id} onChange={(e) => setMarkDraft((d) => ({ ...d, employee_id: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold">
                <option value="">— Choisir —</option>
                {rows.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name}</option>
                ))}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Date
              <input type="date" value={markDraft.attendance_date} onChange={(e) => setMarkDraft((d) => ({ ...d, attendance_date: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Statut
              <select value={markDraft.status} onChange={(e) => setMarkDraft((d) => ({ ...d, status: e.target.value as (typeof ATTENDANCE_STATUS)[number] }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold">
                {ATTENDANCE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Minutes retard
              <input type="number" min={0} value={markDraft.minutes_late} onChange={(e) => setMarkDraft((d) => ({ ...d, minutes_late: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Statut justification
              <select value={markDraft.justification_status} onChange={(e) => setMarkDraft((d) => ({ ...d, justification_status: e.target.value as 'pending' | 'justified' | 'unjustified' }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold">
                <option value="pending">pending</option>
                <option value="justified">justified</option>
                <option value="unjustified">unjustified</option>
              </select>
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              URL justificatif
              <input value={markDraft.justification_attachment_url} onChange={(e) => setMarkDraft((d) => ({ ...d, justification_attachment_url: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-[10px] font-black uppercase text-zinc-400 block md:col-span-2">
              Raison
              <textarea value={markDraft.justification_reason} onChange={(e) => setMarkDraft((d) => ({ ...d, justification_reason: e.target.value }))} rows={3} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
            </label>
          </div>
        </Modal>
      )}

      <Modal
        open={justifyOpen}
        title="Justification absence/retard"
        subtitle="Raison + justificatif, puis validation manager."
        onClose={() => setJustifyOpen(false)}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setJustifyOpen(false)} className="flex-1 py-3 rounded-xl border font-black text-sm">
              Annuler
            </button>
            <button type="button" onClick={() => void submitJustification()} className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm">
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase text-zinc-400 block">
            Raison
            <textarea value={justifyDraft.justification_reason} onChange={(e) => setJustifyDraft((d) => ({ ...d, justification_reason: e.target.value }))} rows={4} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
          </label>
          <label className="text-[10px] font-black uppercase text-zinc-400 block">
            URL justificatif
            <input value={justifyDraft.justification_attachment_url} onChange={(e) => setJustifyDraft((d) => ({ ...d, justification_attachment_url: e.target.value }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200" />
          </label>
          {canUpdate && (
            <label className="text-[10px] font-black uppercase text-zinc-400 block">
              Decision manager
              <select value={justifyDraft.justification_status} onChange={(e) => setJustifyDraft((d) => ({ ...d, justification_status: e.target.value as 'pending' | 'justified' | 'unjustified' }))} className="mt-1 w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold">
                <option value="pending">pending</option>
                <option value="justified">justified</option>
                <option value="unjustified">unjustified</option>
              </select>
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
