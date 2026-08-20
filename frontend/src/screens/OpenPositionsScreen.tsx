import React, { useEffect, useState } from 'react';
import { Plus, Send, Lock } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type JobRow = {
  id: number;
  title: string;
  department: string | null;
  contract_type: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  positions_count: number;
  candidates_count?: number;
  published_at: string | null;
  closed_at: string | null;
  created_by?: { id: number; name: string };
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ouvert: { label: 'Ouvert', cls: 'bg-blue-50 text-blue-700' },
  publie: { label: 'Publié', cls: 'bg-emerald-50 text-emerald-700' },
  ferme: { label: 'Fermé', cls: 'bg-zinc-100 text-zinc-600' },
};

export function OpenPositionsScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '', department: '', description: '', requirements: '',
    contract_type: 'cdi', location: '', salary_min: '', salary_max: '', positions_count: '1',
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get<Paginated<JobRow>>('hr/job-openings' + buildQuery({ per_page: 25, page }));
    setLoading(false);
    if (!res.ok) { toast.error(res.message); return; }
    setRows(res.data.data);
    setLastPage(res.data.last_page);
  };
  useEffect(() => { load(); }, [page]); // eslint-disable-line

  const save = async () => {
    if (!form.title.trim()) { toast.error('Titre requis.'); return; }
    setSaving(true);
    const res = await api.post('hr/job-openings', {
      title: form.title,
      department: form.department || undefined,
      description: form.description || undefined,
      requirements: form.requirements || undefined,
      contract_type: form.contract_type,
      location: form.location || undefined,
      salary_min: form.salary_min ? Number(form.salary_min) : undefined,
      salary_max: form.salary_max ? Number(form.salary_max) : undefined,
      positions_count: Number(form.positions_count || 1),
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Poste créé.');
    setShowCreate(false);
    setForm({ title: '', department: '', description: '', requirements: '', contract_type: 'cdi', location: '', salary_min: '', salary_max: '', positions_count: '1' });
    load();
  };

  const publish = async (id: number) => {
    const res = await api.post(`hr/job-openings/${id}/publish`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Poste publié.');
    load();
  };

  const closeJob = async (id: number) => {
    if (!confirm('Fermer ce poste ?')) return;
    const res = await api.post(`hr/job-openings/${id}/close`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Poste fermé.');
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Postes ouverts"
        subtitle="Gestion des offres de recrutement"
        right={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau poste
          </button>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun poste" description="Créez votre premier poste ouvert." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Département</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Contrat</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Postes</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Candidats</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const badge = STATUS_BADGE[r.status] ?? { label: r.status, cls: 'bg-zinc-100 text-zinc-600' };
                  return (
                    <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.title}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{r.department ?? '—'}</td>
                      <td className="px-4 py-3 text-sm uppercase text-zinc-600">{r.contract_type}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{r.positions_count}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{r.candidates_count ?? 0}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="inline-flex gap-1">
                          {r.status === 'ouvert' && (
                            <button onClick={() => publish(r.id)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Publier"><Send className="w-4 h-4" /></button>
                          )}
                          {r.status !== 'ferme' && (
                            <button onClick={() => closeJob(r.id)} className="p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100" title="Fermer"><Lock className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouveau poste ouvert</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Titre *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Département
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Type de contrat
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.contract_type} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>
                  <option value="cdi">CDI</option><option value="cdd">CDD</option><option value="stage">Stage</option><option value="freelance">Freelance</option>
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Lieu
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Nb postes
                <input type="number" min="1" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.positions_count} onChange={(e) => setForm({ ...form, positions_count: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Salaire min
                <input type="number" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Salaire max
                <input type="number" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Description
                <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Prérequis
                <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
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
