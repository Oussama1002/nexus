import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type CandidateRow = {
  id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  cv_url: string | null;
  source: string | null;
  status: string;
  interview_rating: number | null;
  interview_at: string | null;
  job_opening?: { id: number; title: string; department: string | null } | null;
};

type JobOpt = { id: number; title: string };

const STATUSES = [
  { value: 'recue', label: 'Reçue', cls: 'bg-zinc-100 text-zinc-700' },
  { value: 'a_examiner', label: 'À examiner', cls: 'bg-blue-50 text-blue-700' },
  { value: 'preselectionne', label: 'Présélectionné', cls: 'bg-cyan-50 text-cyan-700' },
  { value: 'contacte', label: 'Contacté', cls: 'bg-indigo-50 text-indigo-700' },
  { value: 'entretien', label: 'Entretien', cls: 'bg-violet-50 text-violet-700' },
  { value: 'accepte', label: 'Accepté', cls: 'bg-emerald-50 text-emerald-700' },
  { value: 'refuse', label: 'Refusé', cls: 'bg-red-50 text-red-700' },
  { value: 'vivier', label: 'Vivier', cls: 'bg-amber-50 text-amber-700' },
  { value: 'archive', label: 'Archivé', cls: 'bg-zinc-100 text-zinc-500' },
];

const S = (v: string) => STATUSES.find((s) => s.value === v) ?? { value: v, label: v, cls: 'bg-zinc-100 text-zinc-600' };

export function ApplicationsScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', city: '', job_opening_id: '', cv_url: '', source: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const [refusing, setRefusing] = useState<{ id: number } | null>(null);
  const [refuseReason, setRefuseReason] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await api.get<Paginated<CandidateRow>>(
      'hr/candidates' + buildQuery({ per_page: 25, page, status: statusFilter || undefined, search: search || undefined }),
    );
    setLoading(false);
    if (!res.ok) { toast.error(res.message); return; }
    setRows(res.data.data);
    setLastPage(res.data.last_page);
  };
  useEffect(() => { load(); }, [page, statusFilter, search]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<JobOpt>>('hr/job-openings' + buildQuery({ per_page: 100 }));
      if (res.ok) setJobs(res.data.data.map((j: any) => ({ id: j.id, title: j.title })));
    })();
  }, []);

  const save = async () => {
    if (!form.full_name.trim()) { toast.error('Nom requis.'); return; }
    setSaving(true);
    const res = await api.post('hr/candidates', {
      full_name: form.full_name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      city: form.city || undefined,
      job_opening_id: form.job_opening_id ? Number(form.job_opening_id) : undefined,
      cv_url: form.cv_url || undefined,
      source: form.source || undefined,
      notes: form.notes || undefined,
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Candidature ajoutée.');
    setShowCreate(false);
    setForm({ full_name: '', email: '', phone: '', city: '', job_opening_id: '', cv_url: '', source: '', notes: '' });
    load();
  };

  const transition = async (id: number, status: string, extra: any = {}) => {
    const res = await api.post(`hr/candidates/${id}/transition`, { status, ...extra });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Statut mis à jour.');
    load();
  };

  const doRefuse = async () => {
    if (!refusing || !refuseReason.trim()) { toast.error('Motif requis.'); return; }
    await transition(refusing.id, 'refuse', { refusal_reason: refuseReason });
    setRefusing(null); setRefuseReason('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidatures"
        subtitle="Pipeline de recrutement"
        right={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle candidature
          </button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <input className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs" placeholder="Rechercher…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune candidature" description="Les candidatures apparaîtront ici." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Candidat</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Poste</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Contact</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Source</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">CV</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = S(r.status);
                  return (
                    <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.full_name}</td>
                      <td className="px-4 py-3 text-sm text-zinc-700">{r.job_opening?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{r.email ?? '—'}<br />{r.phone ?? ''}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500">{r.source ?? '—'}</td>
                      <td className="px-4 py-3 text-sm">{r.cv_url ? <a href={r.cv_url} target="_blank" rel="noreferrer" className="text-primary-600 font-bold">Ouvrir</a> : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <select
                          className="text-xs font-bold border border-zinc-200 rounded-lg px-2 py-1"
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            if (v === 'refuse') { setRefusing({ id: r.id }); setRefuseReason(''); return; }
                            transition(r.id, v);
                          }}
                        >
                          <option value="">Action…</option>
                          {STATUSES.filter((s) => s.value !== r.status).map((s) => <option key={s.value} value={s.value}>→ {s.label}</option>)}
                        </select>
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle candidature</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Nom complet *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Email
                <input type="email" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Téléphone
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Ville
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Source
                <input placeholder="LinkedIn, référence…" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Poste ciblé
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.job_opening_id} onChange={(e) => setForm({ ...form, job_opening_id: e.target.value })}>
                  <option value="">— aucun —</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">CV (URL)
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.cv_url} onChange={(e) => setForm({ ...form, cv_url: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Notes
                <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">{saving ? 'Envoi…' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}

      {refusing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Refuser la candidature</h2>
            <label className="block text-sm font-bold text-zinc-700">Motif du refus
              <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={4} value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRefusing(null)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={doRefuse} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-black">Refuser</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
