import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type TrainingRow = {
  id: number;
  employee?: { id: number; full_name: string; department: string | null };
  title: string;
  training_type: string;
  provider: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_hours: number | null;
  status: string;
  result: string | null;
  attestation_url: string | null;
};

type EmpOpt = { id: number; full_name: string };

const TYPES = [
  { value: 'interne', label: 'Interne' },
  { value: 'externe', label: 'Externe' },
  { value: 'en_ligne', label: 'En ligne' },
  { value: 'certification', label: 'Certification' },
];

const STATUSES: Record<string, { label: string; cls: string }> = {
  planifiee: { label: 'Planifiée', cls: 'bg-blue-50 text-blue-700' },
  en_cours: { label: 'En cours', cls: 'bg-amber-50 text-amber-700' },
  terminee: { label: 'Terminée', cls: 'bg-emerald-50 text-emerald-700' },
  annulee: { label: 'Annulée', cls: 'bg-zinc-100 text-zinc-500' },
};

export function TrainingScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<TrainingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    employee_id: '', title: '', training_type: 'interne', provider: '',
    start_date: '', end_date: '', duration_hours: '', description: '',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get<Paginated<TrainingRow>>('hr/trainings' + buildQuery({ per_page: 25, page }));
    setLoading(false);
    if (!res.ok) { toast.error(res.message); return; }
    setRows(res.data.data); setLastPage(res.data.last_page);
  };
  useEffect(() => { load(); }, [page]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<EmpOpt>>('hr' + buildQuery({ per_page: 100 }));
      if (res.ok) setEmployees(res.data.data.map((e: any) => ({ id: e.id, full_name: e.full_name })));
    })();
  }, []);

  const save = async () => {
    if (!form.employee_id || !form.title.trim()) { toast.error('Employé et titre requis.'); return; }
    setSaving(true);
    const res = await api.post('hr/trainings', {
      employee_id: Number(form.employee_id),
      title: form.title,
      training_type: form.training_type,
      provider: form.provider || undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      duration_hours: form.duration_hours ? Number(form.duration_hours) : undefined,
      description: form.description || undefined,
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Formation ajoutée.');
    setShowCreate(false);
    setForm({ employee_id: '', title: '', training_type: 'interne', provider: '', start_date: '', end_date: '', duration_hours: '', description: '' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formations"
        subtitle="Suivi des formations et compétences"
        right={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle formation
          </button>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune formation" description="Ajoutez une formation pour commencer." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Prestataire</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Dates</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Durée</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Attestation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = STATUSES[r.status] ?? { label: r.status, cls: 'bg-zinc-100 text-zinc-600' };
                  return (
                    <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.employee?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800">{r.title}</td>
                      <td className="px-4 py-3 text-xs uppercase text-zinc-600">{r.training_type}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{r.provider ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {r.start_date ? new Date(r.start_date).toLocaleDateString('fr-FR') : '—'}
                        {r.end_date ? ` → ${new Date(r.end_date).toLocaleDateString('fr-FR')}` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{r.duration_hours ? `${r.duration_hours}h` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">{r.attestation_url ? <a href={r.attestation_url} target="_blank" rel="noreferrer" className="text-primary-600 font-bold">Voir</a> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Page {page} sur {lastPage}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold disabled:opacity-40">Précédent</button>
              <button disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold disabled:opacity-40">Suivant</button>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle formation</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Employé *
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                  <option value="">— sélectionner —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Titre *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Type
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.training_type} onChange={(e) => setForm({ ...form, training_type: e.target.value })}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Prestataire
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Date début
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Date fin
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Durée (heures)
                <input type="number" min="1" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Description
                <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">{saving ? 'Envoi…' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
