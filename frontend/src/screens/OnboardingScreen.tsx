import React, { useEffect, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type OnbItem = {
  id: number;
  employee_id: number;
  employee?: { id: number; full_name: string; department: string | null };
  item_key: string;
  label: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by?: { id: number; name: string } | null;
};

type EmpOpt = { id: number; full_name: string; onboarding_status?: string };

export function OnboardingScreen() {
  const toast = useToast();
  const [items, setItems] = useState<OnbItem[]>([]);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [empFilter, setEmpFilter] = useState('');
  const [showInit, setShowInit] = useState(false);
  const [initEmpId, setInitEmpId] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await api.get<OnbItem[]>('hr/onboarding/items' + buildQuery({ employee_id: empFilter || undefined }));
    setLoading(false);
    if (!res.ok) { toast.error(res.message); setItems([]); return; }
    setItems(res.data);
  };
  useEffect(() => { load(); }, [empFilter]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<EmpOpt>>('hr' + buildQuery({ per_page: 100 }));
      if (res.ok) setEmployees(res.data.data.map((e: any) => ({ id: e.id, full_name: e.full_name, onboarding_status: e.onboarding_status })));
    })();
  }, []);

  const initChecklist = async () => {
    if (!initEmpId) { toast.error('Employé requis.'); return; }
    const res = await api.post('hr/onboarding/init', { employee_id: Number(initEmpId) });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Checklist initialisée.');
    setShowInit(false); setInitEmpId('');
    setEmpFilter(String(initEmpId));
    load();
  };

  const toggle = async (id: number) => {
    const res = await api.post(`hr/onboarding/items/${id}/toggle`, {});
    if (!res.ok) { toast.error(res.message); return; }
    load();
  };

  const grouped = items.reduce<Record<string, OnbItem[]>>((acc, it) => {
    const key = it.employee?.full_name ?? `Employé #${it.employee_id}`;
    (acc[key] = acc[key] ?? []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intégration"
        subtitle="Checklist d'onboarding par employé"
        right={
          <button onClick={() => setShowInit(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Initialiser
          </button>
        }
      />

      <div className="flex gap-3">
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
          <option value="">Tous les employés</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState title="Aucune checklist" description="Initialisez la checklist d'un employé pour commencer." />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([name, list]) => {
            const done = list.filter((i) => i.is_completed).length;
            return (
              <div key={name} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-black text-zinc-900">{name}</h3>
                  <span className="text-sm font-bold text-zinc-500">{done}/{list.length} complétés</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-100 rounded-full mb-4">
                  <div className="h-1.5 bg-emerald-500 rounded-full transition-all" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} />
                </div>
                <ul className="space-y-2">
                  {list.map((it) => (
                    <li key={it.id} className="flex items-center gap-3">
                      <button onClick={() => toggle(it.id)} className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${it.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-300 hover:border-zinc-400'}`}>
                        {it.is_completed && <Check className="w-4 h-4 text-white" />}
                      </button>
                      <span className={`text-sm font-medium flex-1 ${it.is_completed ? 'text-zinc-500 line-through' : 'text-zinc-800'}`}>{it.label}</span>
                      {it.is_completed && it.completed_at && (
                        <span className="text-xs text-zinc-400">{new Date(it.completed_at).toLocaleDateString('fr-FR')} · {it.completed_by?.name ?? ''}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {showInit && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Initialiser la checklist</h2>
            <p className="text-sm text-zinc-500">Une checklist par défaut avec 8 items sera créée.</p>
            <label className="block text-sm font-bold text-zinc-700">Employé
              <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={initEmpId} onChange={(e) => setInitEmpId(e.target.value)}>
                <option value="">— sélectionner —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowInit(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={initChecklist} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
