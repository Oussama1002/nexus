import React, { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import * as api from '../../lib/api';

export type EmployeeDetail = {
  id: number;
  employee_code?: string | null;
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

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  terminated: 'Terminé',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 space-y-3">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-700">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,38%)_1fr] gap-x-3 gap-y-0.5 text-sm border-b border-zinc-100/90 pb-2 last:border-0">
      <span className="text-zinc-500 font-bold">{label}</span>
      <span className="text-zinc-900 font-medium break-words">{value ?? '—'}</span>
    </div>
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  } catch {
    return iso;
  }
}

function brandLabel(emp: EmployeeDetail): string {
  if (emp.all_brands) return 'Toutes les marques';
  if (emp.brands?.length) return emp.brands.map((b) => b.name).join(', ');
  return emp.brand?.name ?? '—';
}

type Props = {
  employeeId: number | null;
  open: boolean;
  onClose: () => void;
  onEdit: (employee: EmployeeDetail) => void;
  onDeleted: () => void;
  canUpdate: boolean;
  canDelete: boolean;
};

export function EmployeeFicheDrawer({
  employeeId,
  open,
  onClose,
  onEdit,
  onDeleted,
  canUpdate,
  canDelete,
}: Props) {
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !employeeId) {
      setEmp(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await api.get<EmployeeDetail>(`hr/${employeeId}`);
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.data) setEmp(res.data);
      else setEmp(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, employeeId]);

  const handleDelete = async () => {
    if (!emp || !canDelete) return;
    if (!window.confirm(`Supprimer l'employé « ${emp.full_name} » ? Cette action est irréversible.`)) return;
    setDeleting(true);
    const res = await api.del(`hr/${emp.id}`);
    setDeleting(false);
    if (!res.ok) {
      window.alert(res.message);
      return;
    }
    onDeleted();
    onClose();
  };

  return (
    <Drawer
      open={open && employeeId !== null}
      onClose={onClose}
      widthClassName="w-[min(100vw,560px)]"
      title={emp ? emp.full_name : 'Fiche employé'}
      subtitle={emp?.employee_code ? `Matricule ${emp.employee_code}` : undefined}
      footer={
        emp && (canUpdate || canDelete) ? (
          <div className="flex flex-wrap gap-2">
            {canUpdate ? (
              <button
                type="button"
                onClick={() => onEdit(emp)}
                className="flex-1 min-w-[8rem] py-3 rounded-xl bg-primary-600 text-white text-sm font-black inline-flex items-center justify-center gap-2"
              >
                <Pencil className="w-4 h-4" /> Modifier
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="flex-1 min-w-[8rem] py-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-black inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {loading && <p className="text-sm font-bold text-zinc-500">Chargement…</p>}
      {!loading && !emp && <p className="text-sm text-zinc-600">Impossible de charger la fiche employé.</p>}
      {emp && (
        <div className="space-y-4">
          <Section title="Identité">
            <Row label="Nom complet" value={emp.full_name} />
            <Row label="Matricule" value={emp.employee_code} />
            <Row label="Téléphone" value={emp.phone} />
            <Row label="Statut" value={STATUS_LABELS[emp.status] ?? emp.status} />
          </Section>

          <Section title="Poste & organisation">
            <Row label="Fonction" value={emp.role_title} />
            <Row label="Département" value={emp.department} />
            <Row label="Marque(s)" value={brandLabel(emp)} />
            <Row label="Date d'entrée" value={fmtDate(emp.joined_at)} />
          </Section>

          <Section title="Compte & rémunération">
            <Row
              label="Utilisateur lié"
              value={emp.user ? `${emp.user.name} (${emp.user.email})` : 'Aucun compte'}
            />
            <Row label="Salaire" value={emp.salary_hidden ? 'Masqué' : emp.salary != null ? String(emp.salary) : '—'} />
          </Section>
        </div>
      )}
    </Drawer>
  );
}
