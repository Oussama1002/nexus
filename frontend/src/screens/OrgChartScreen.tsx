import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type EmpNode = {
  id: number;
  full_name: string;
  role_title: string | null;
  department: string | null;
  manager_employee_id: number | null;
};

export function OrgChartScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<EmpNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<EmpNode>>('hr' + buildQuery({ per_page: 200, status: 'active' }));
      setLoading(false);
      if (!res.ok) { toast.error(res.message); return; }
      setRows(res.data.data);
    })();
  }, [toast]);

  const byDepartment = useMemo(() => {
    const grouped: Record<string, EmpNode[]> = {};
    for (const e of rows) {
      const key = e.department || 'Sans département';
      (grouped[key] = grouped[key] ?? []).push(e);
    }
    return grouped;
  }, [rows]);

  const managerMap = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((e) => map.set(e.id, e.full_name));
    return map;
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Organigramme" subtitle="Répartition des équipes par département" />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun employé actif" description="Ajoutez des employés pour construire l'organigramme." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(byDepartment).map(([dept, list]) => (
            <div key={dept} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-black text-zinc-900">{dept}</h3>
                <span className="text-xs font-bold text-zinc-500">{list.length}</span>
              </div>
              <ul className="space-y-2">
                {list.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-zinc-50">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-black flex items-center justify-center text-xs shrink-0">
                      {e.full_name.split(' ').map((s) => s[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-zinc-900 truncate">{e.full_name}</p>
                      <p className="text-xs text-zinc-500 truncate">{e.role_title ?? '—'}</p>
                      {e.manager_employee_id && managerMap.has(e.manager_employee_id) && (
                        <p className="text-[10px] text-zinc-400 mt-0.5">↳ {managerMap.get(e.manager_employee_id)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
