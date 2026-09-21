import React, { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { SectionCard } from './SettingsUi';
import { useToast } from '../../../context/ToastContext';
import * as api from '../../../lib/api';

type Row = { role_title: string; department: string };

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500';

/** Centre de paramètres → RH : quelle fonction appartient à quel département. */
export function HrRoleDepartmentsPanel({ canUpdate }: { canUpdate: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [mapRes, roleRes, deptRes] = await Promise.all([
        api.get<Row[]>('hr/role-departments', { brandId: false }),
        api.get<{ values: string[] }>('hr/lookups/role_title'),
        api.get<{ values: string[] }>('hr/lookups/department'),
      ]);
      setLoading(false);
      if (!mapRes.ok) {
        toast.error(mapRes.message);
        return;
      }
      setRows(mapRes.data ?? []);
      if (roleRes.ok) setRoleOptions(roleRes.data?.values ?? []);
      if (deptRes.ok) setDepartmentOptions(deptRes.data?.values ?? []);
    })();
  }, [toast]);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save() {
    const items = rows.filter((r) => r.role_title.trim() || r.department.trim());
    if (items.some((r) => !r.role_title.trim() || !r.department.trim())) {
      toast.error('Chaque ligne doit avoir une fonction et un département.');
      return;
    }
    setSaving(true);
    const res = await api.put<Row[]>('hr/role-departments', { items }, { brandId: false });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setRows(res.data ?? items);
    toast.success(res.message);
  }

  return (
    <SectionCard
      title="Fonctions et départements"
      description="Associez chaque fonction à son département. Dans le formulaire « Nouvel employé », choisir une fonction remplit le département, et choisir un département limite la liste des fonctions."
      actions={
        canUpdate ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        ) : undefined
      }
    >
      <datalist id="hr-role-options">
        {roleOptions.map((v) => <option key={v} value={v} />)}
      </datalist>
      <datalist id="hr-department-options">
        {departmentOptions.map((v) => <option key={v} value={v} />)}
      </datalist>

      {loading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="text-sm text-zinc-500">Aucune correspondance. Ajoutez-en une ci-dessous (ex. Développeur → IT).</p>
          )}
          {rows.length > 0 && (
            <div className="grid grid-cols-[1fr_1fr_2.5rem] gap-3 text-xs font-bold text-zinc-700">
              <span>Fonction</span>
              <span>Département</span>
              <span />
            </div>
          )}
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_2.5rem] gap-3 items-center">
              <input
                list="hr-role-options"
                value={r.role_title}
                onChange={(e) => update(i, { role_title: e.target.value })}
                disabled={!canUpdate}
                placeholder="ex. Développeur"
                className={inputCls}
              />
              <input
                list="hr-department-options"
                value={r.department}
                onChange={(e) => update(i, { department: e.target.value })}
                disabled={!canUpdate}
                placeholder="ex. IT"
                className={inputCls}
              />
              {canUpdate ? (
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              ) : <span />}
            </div>
          ))}
          {canUpdate && (
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { role_title: '', department: '' }])}
              className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Ajouter une correspondance
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}
