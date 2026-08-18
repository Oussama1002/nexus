import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type Employee = {
  id: number;
  name: string;
  position: string;
  department: string;
  is_manager?: boolean;
  avatar_url?: string | null;
};

type DepartmentGroup = {
  name: string;
  manager: Employee | null;
  members: Employee[];
};

export function OrgChartScreen() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api.get<Paginated<Employee>>(
        'employees' + buildQuery({ per_page: 100 }),
      );
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.message);
        setEmployees([]);
        return;
      }
      setEmployees(res.data.data);
    })();
    return () => { cancelled = true; };
  }, [toast]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return employees;
    return employees.filter(
      (e) => e.name.toLowerCase().includes(s) || e.position.toLowerCase().includes(s) || e.department.toLowerCase().includes(s),
    );
  }, [employees, search]);

  const departments = useMemo(() => {
    const map = new Map<string, DepartmentGroup>();
    for (const emp of filtered) {
      const dept = emp.department || 'Non assigné';
      if (!map.has(dept)) {
        map.set(dept, { name: dept, manager: null, members: [] });
      }
      const group = map.get(dept)!;
      if (emp.is_manager) {
        group.manager = emp;
      } else {
        group.members.push(emp);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [filtered]);

  function initials(name: string) {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organigramme"
        subtitle="Structure hiérarchique de l'organisation"
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
          placeholder="Rechercher par nom…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : departments.length === 0 ? (
        <EmptyState title="Aucun employé trouvé" description="L'organigramme apparaîtra une fois les employés ajoutés." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div key={dept.name} className="card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-black text-zinc-900 uppercase tracking-wide">{dept.name}</h3>
              </div>

              {dept.manager && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 border border-primary-100">
                  <div className="w-10 h-10 rounded-full bg-primary-200 text-primary-800 flex items-center justify-center text-xs font-black flex-shrink-0">
                    {initials(dept.manager.name)}
                  </div>
                  <div>
                    <p className="text-sm font-black text-zinc-900">{dept.manager.name}</p>
                    <p className="text-xs font-medium text-primary-700">{dept.manager.position} — Responsable</p>
                  </div>
                </div>
              )}

              {dept.members.length > 0 && (
                <div className="space-y-1.5">
                  {dept.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                        {initials(m.name)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-800">{m.name}</p>
                        <p className="text-xs font-medium text-zinc-500">{m.position}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!dept.manager && dept.members.length === 0 && (
                <p className="text-xs font-medium text-zinc-400 italic">Aucun membre</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
