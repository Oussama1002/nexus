import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type EvalRow = {
  id: number;
  campaign_id: number | null;
  campaign?: { id: number; title: string; year: number };
  employee?: { id: number; full_name: string; department: string | null };
  evaluator?: { id: number; name: string } | null;
  overall_rating: number | null;
  recommendation: string | null;
  status: string;
  interview_at: string | null;
  signed_by_employee_at: string | null;
  signed_by_manager_at: string | null;
  finalized_at: string | null;
};

type CampRow = { id: number; title: string; year: number; period: string; status: string; evaluations_count: number };
type EmpOpt = { id: number; full_name: string };

const STATUSES: Record<string, { label: string; cls: string }> = {
  en_preparation: { label: 'En préparation', cls: 'bg-zinc-100 text-zinc-600' },
  planifiee: { label: 'Planifiée', cls: 'bg-blue-50 text-blue-700' },
  en_cours: { label: 'En cours', cls: 'bg-amber-50 text-amber-700' },
  a_signer: { label: 'À signer', cls: 'bg-violet-50 text-violet-700' },
  finalise: { label: 'Finalisée', cls: 'bg-emerald-50 text-emerald-700' },
};

export function EvaluationsScreen() {
  const toast = useToast();
  const [tab, setTab] = useState<'campaigns' | 'evaluations'>('campaigns');
  const [campaigns, setCampaigns] = useState<CampRow[]>([]);
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCampaign, setShowCampaign] = useState(false);
  const [cForm, setCForm] = useState({ title: '', year: String(new Date().getFullYear()), period: 'annuelle', start_date: '', end_date: '' });

  const [showEval, setShowEval] = useState(false);
  const [eForm, setEForm] = useState({ campaign_id: '', employee_id: '', interview_at: '' });

  const load = async () => {
    setLoading(true);
    const [c, e] = await Promise.all([
      api.get<Paginated<CampRow>>('hr/evaluation-campaigns' + buildQuery({ per_page: 100 })),
      api.get<Paginated<EvalRow>>('hr/evaluations' + buildQuery({ per_page: 100 })),
    ]);
    setLoading(false);
    if (c.ok) setCampaigns(c.data.data);
    if (e.ok) setEvals(e.data.data);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<EmpOpt>>('hr' + buildQuery({ per_page: 100 }));
      if (res.ok) setEmployees(res.data.data.map((e: any) => ({ id: e.id, full_name: e.full_name })));
    })();
  }, []);

  const saveCampaign = async () => {
    if (!cForm.title.trim()) { toast.error('Titre requis.'); return; }
    const res = await api.post('hr/evaluation-campaigns', {
      title: cForm.title, year: Number(cForm.year), period: cForm.period,
      start_date: cForm.start_date || undefined, end_date: cForm.end_date || undefined,
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Campagne créée.'); setShowCampaign(false);
    setCForm({ title: '', year: String(new Date().getFullYear()), period: 'annuelle', start_date: '', end_date: '' });
    load();
  };

  const launchCampaign = async (id: number) => {
    const res = await api.post(`hr/evaluation-campaigns/${id}/launch`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Campagne lancée.'); load();
  };

  const saveEval = async () => {
    if (!eForm.employee_id) { toast.error('Employé requis.'); return; }
    const res = await api.post('hr/evaluations', {
      campaign_id: eForm.campaign_id ? Number(eForm.campaign_id) : undefined,
      employee_id: Number(eForm.employee_id),
      interview_at: eForm.interview_at || undefined,
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Évaluation créée.'); setShowEval(false);
    setEForm({ campaign_id: '', employee_id: '', interview_at: '' });
    load();
  };

  const finalize = async (id: number) => {
    if (!confirm('Finaliser cette évaluation ? Elle deviendra immuable.')) return;
    const res = await api.post(`hr/evaluations/${id}/finalize`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Évaluation finalisée.'); load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Évaluations"
        subtitle="Campagnes et évaluations individuelles"
        right={
          <button
            onClick={() => (tab === 'campaigns' ? setShowCampaign(true) : setShowEval(true))}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> {tab === 'campaigns' ? 'Nouvelle campagne' : 'Nouvelle évaluation'}
          </button>
        }
      />

      <div className="flex gap-2 border-b border-zinc-200">
        {(['campaigns', 'evaluations'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-black border-b-2 ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
          >
            {t === 'campaigns' ? 'Campagnes' : 'Évaluations'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : tab === 'campaigns' ? (
        campaigns.length === 0 ? (
          <EmptyState title="Aucune campagne" description="Créez votre première campagne d'évaluation." />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Année</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Période</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Évaluations</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{c.title}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{c.year}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{c.period}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{c.evaluations_count}</td>
                    <td className="px-4 py-3 text-xs uppercase font-bold text-zinc-600">{c.status}</td>
                    <td className="px-4 py-3 text-right">
                      {c.status === 'brouillon' && (
                        <button onClick={() => launchCampaign(c.id)} className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-black">Lancer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : evals.length === 0 ? (
        <EmptyState title="Aucune évaluation" description="Créez une évaluation pour commencer." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Campagne</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Note</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Recommandation</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Signatures</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {evals.map((r) => {
                const s = STATUSES[r.status] ?? { label: r.status, cls: 'bg-zinc-100 text-zinc-600' };
                return (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.campaign?.title ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.overall_rating ? `${r.overall_rating}/5` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{r.recommendation ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {r.signed_by_employee_at ? '✓ Employé' : '· Employé'}<br />
                      {r.signed_by_manager_at ? '✓ Manager' : '· Manager'}
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>{s.label}</span></td>
                    <td className="px-4 py-3 text-right">
                      {r.status !== 'finalise' && (
                        <button onClick={() => finalize(r.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-700 text-xs font-black hover:bg-emerald-50">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Finaliser
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCampaign && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle campagne</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Titre *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={cForm.title} onChange={(e) => setCForm({ ...cForm, title: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Année *
                <input type="number" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={cForm.year} onChange={(e) => setCForm({ ...cForm, year: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Période
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={cForm.period} onChange={(e) => setCForm({ ...cForm, period: e.target.value })}>
                  <option value="annuelle">Annuelle</option><option value="semestrielle">Semestrielle</option><option value="trimestrielle">Trimestrielle</option>
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Date début
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={cForm.start_date} onChange={(e) => setCForm({ ...cForm, start_date: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Date fin
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={cForm.end_date} onChange={(e) => setCForm({ ...cForm, end_date: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCampaign(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={saveCampaign} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
            </div>
          </div>
        </div>
      )}

      {showEval && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle évaluation</h2>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm font-bold text-zinc-700">Campagne
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={eForm.campaign_id} onChange={(e) => setEForm({ ...eForm, campaign_id: e.target.value })}>
                  <option value="">— aucune —</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.year})</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Employé *
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={eForm.employee_id} onChange={(e) => setEForm({ ...eForm, employee_id: e.target.value })}>
                  <option value="">— sélectionner —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Entretien prévu
                <input type="datetime-local" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={eForm.interview_at} onChange={(e) => setEForm({ ...eForm, interview_at: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowEval(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={saveEval} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
