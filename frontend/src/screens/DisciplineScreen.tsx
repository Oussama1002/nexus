import React, { useEffect, useState } from 'react';
import { Plus, XCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type DiscRow = {
  id: number;
  employee?: { id: number; full_name: string; department: string | null };
  incident_type: string;
  incident_date: string;
  incident_description: string;
  sanction_type: string | null;
  sanction_description: string | null;
  status: string;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  decided_at: string | null;
  notified_at: string | null;
  acknowledged_at: string | null;
};

type EmpOpt = { id: number; full_name: string };

const INCIDENT_TYPES = [
  { value: 'retard_repete', label: 'Retards répétés' },
  { value: 'absence_injustifiee', label: 'Absence injustifiée' },
  { value: 'faute_professionnelle', label: 'Faute professionnelle' },
  { value: 'comportement', label: 'Comportement' },
  { value: 'autre', label: 'Autre' },
];

const SANCTIONS = [
  { value: 'avertissement', label: 'Avertissement' },
  { value: 'blame', label: 'Blâme' },
  { value: 'mise_a_pied', label: 'Mise à pied' },
  { value: 'licenciement', label: 'Licenciement' },
];

const STATUS_FLOW = ['signale', 'instruction', 'entretien', 'decision', 'notification', 'accuse'];

const STATUS_LABEL: Record<string, string> = {
  signale: 'Signalé', instruction: 'Instruction', entretien: 'Entretien',
  decision: 'Décision', notification: 'Notification', accuse: 'Accusé',
};

const STATUS_COLOR: Record<string, string> = {
  signale: 'bg-zinc-100 text-zinc-700',
  instruction: 'bg-blue-50 text-blue-700',
  entretien: 'bg-violet-50 text-violet-700',
  decision: 'bg-amber-50 text-amber-700',
  notification: 'bg-orange-50 text-orange-700',
  accuse: 'bg-emerald-50 text-emerald-700',
};

export function DisciplineScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<DiscRow[]>([]);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ employee_id: '', incident_type: 'faute_professionnelle', incident_date: '', incident_description: '' });

  const [cancelling, setCancelling] = useState<{ id: number } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await api.get<Paginated<DiscRow>>('hr/discipline' + buildQuery({ per_page: 25, page }));
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
    if (!form.employee_id || !form.incident_date || !form.incident_description.trim()) {
      toast.error('Champs requis manquants.'); return;
    }
    const res = await api.post('hr/discipline', {
      employee_id: Number(form.employee_id),
      incident_type: form.incident_type,
      incident_date: form.incident_date,
      incident_description: form.incident_description,
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Incident signalé.'); setShowCreate(false);
    setForm({ employee_id: '', incident_type: 'faute_professionnelle', incident_date: '', incident_description: '' });
    load();
  };

  const nextStatus = (current: string) => {
    const i = STATUS_FLOW.indexOf(current);
    return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
  };

  const advance = async (r: DiscRow) => {
    const next = nextStatus(r.status);
    if (!next) return;
    const payload: any = { status: next };
    if (next === 'decision') {
      const sanction = prompt(`Type de sanction (${SANCTIONS.map((s) => s.value).join(', ')}) ?`, 'avertissement');
      if (!sanction) return;
      payload.sanction_type = sanction;
      const desc = prompt('Description de la sanction ?', '');
      if (desc) payload.sanction_description = desc;
    }
    const res = await api.post(`hr/discipline/${r.id}/transition`, payload);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(`Passé à: ${STATUS_LABEL[next]}`); load();
  };

  const doCancel = async () => {
    if (!cancelling || !cancelReason.trim()) { toast.error('Motif requis.'); return; }
    const res = await api.post(`hr/discipline/${cancelling.id}/cancel`, { cancellation_reason: cancelReason });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Dossier annulé.'); setCancelling(null); setCancelReason(''); load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discipline"
        subtitle="Suivi des incidents et sanctions"
        right={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Signaler
          </button>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun dossier" description="Les dossiers disciplinaires apparaîtront ici." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Sanction</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-zinc-50 hover:bg-zinc-50/50 ${r.is_cancelled ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs uppercase text-zinc-600">{r.incident_type}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{new Date(r.incident_date).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-xs">{r.sanction_type ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[r.status] ?? 'bg-zinc-100'}`}>
                        {r.is_cancelled ? 'ANNULÉ' : STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!r.is_cancelled && (
                        <div className="inline-flex gap-1">
                          {nextStatus(r.status) && (
                            <button onClick={() => advance(r)} className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-black">
                              → {STATUS_LABEL[nextStatus(r.status)!]}
                            </button>
                          )}
                          <button onClick={() => { setCancelling({ id: r.id }); setCancelReason(''); }} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50" title="Annuler">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Signaler un incident</h2>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm font-bold text-zinc-700">Employé *
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                  <option value="">— sélectionner —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Type d'incident
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })}>
                  {INCIDENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Date *
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.incident_date} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Description *
                <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={4} value={form.incident_description} onChange={(e) => setForm({ ...form, incident_description: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Signaler</button>
            </div>
          </div>
        </div>
      )}

      {cancelling && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Annuler le dossier</h2>
            <p className="text-sm text-zinc-500">L'annulation est motivée et définitive.</p>
            <label className="block text-sm font-bold text-zinc-700">Motif *
              <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={4} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCancelling(null)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Retour</button>
              <button onClick={doCancel} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-black">Annuler le dossier</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
