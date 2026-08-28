import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, GitBranch, Flag, DoorOpen, FilePlus2, ShieldAlert,
  BookOpen, FlaskConical, TrendingUp, ScrollText, Users, CalendarClock,
  FileBarChart2, ClipboardCheck, XCircle, Plus, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type Space =
  | 'dashboard' | 'roadmap' | 'chantiers' | 'gates' | 'derogations'
  | 'deliverables' | 'economics' | 'decisions' | 'tests'
  | 'compliance' | 'alerts' | 'meetings' | 'reports' | 'assignments';

type R = Record<string, any>;

const SPACES: { key: Space; label: string; Icon: any }[] = [
  { key: 'dashboard',    label: 'Tableau de bord',      Icon: LayoutGrid },
  { key: 'roadmap',      label: 'Feuille de route',     Icon: GitBranch },
  { key: 'chantiers',    label: 'Chantiers',            Icon: Flag },
  { key: 'gates',        label: 'Portes G0–G8',         Icon: DoorOpen },
  { key: 'derogations',  label: 'Dérogations',          Icon: ShieldAlert },
  { key: 'deliverables', label: 'Livrables',            Icon: FilePlus2 },
  { key: 'economics',    label: 'Modèle économique',    Icon: TrendingUp },
  { key: 'decisions',    label: 'Décisions',            Icon: ScrollText },
  { key: 'tests',        label: 'Tests',                Icon: FlaskConical },
  { key: 'compliance',   label: 'Conformité produit',   Icon: ClipboardCheck },
  { key: 'alerts',       label: 'Alertes',              Icon: AlertTriangle },
  { key: 'meetings',     label: 'Réunions client',      Icon: CalendarClock },
  { key: 'reports',      label: 'Rapports client',      Icon: FileBarChart2 },
  { key: 'assignments',  label: 'Rattachements',        Icon: Users },
];

const ROADMAP_STATUS: Record<string, { label: string; cls: string }> = {
  non_demarree: { label: 'Non démarrée', cls: 'bg-zinc-100 text-zinc-700' },
  en_cours: { label: 'En cours', cls: 'bg-blue-50 text-blue-700' },
  suspendue: { label: 'Suspendue', cls: 'bg-orange-50 text-orange-700' },
  terminee: { label: 'Terminée', cls: 'bg-emerald-50 text-emerald-700' },
  abandonnee: { label: 'Abandonnée', cls: 'bg-red-50 text-red-700' },
};

const GATE_STATUS: Record<string, { label: string; cls: string }> = {
  non_atteinte: { label: 'Non atteinte', cls: 'bg-zinc-100 text-zinc-700' },
  criteres_en_cours: { label: 'Critères en cours', cls: 'bg-blue-50 text-blue-700' },
  demandee: { label: 'Demandée', cls: 'bg-amber-50 text-amber-700' },
  franchie: { label: 'Franchie', cls: 'bg-emerald-50 text-emerald-700' },
  refusee: { label: 'Refusée', cls: 'bg-red-50 text-red-700' },
  franchie_par_derogation: { label: 'Franchie / dérogation', cls: 'bg-violet-50 text-violet-700' },
};

const DEROG_STATUS: Record<string, { label: string; cls: string }> = {
  demandee: { label: 'Demandée', cls: 'bg-amber-50 text-amber-700' },
  accordee: { label: 'Accordée', cls: 'bg-emerald-50 text-emerald-700' },
  refusee: { label: 'Refusée', cls: 'bg-red-50 text-red-700' },
  expiree: { label: 'Expirée', cls: 'bg-zinc-100 text-zinc-600' },
  levee: { label: 'Levée', cls: 'bg-blue-50 text-blue-700' },
};

const DELIV_STATUS: Record<string, { label: string; cls: string }> = {
  a_produire: { label: 'À produire', cls: 'bg-zinc-100 text-zinc-700' },
  en_production: { label: 'En production', cls: 'bg-blue-50 text-blue-700' },
  depose: { label: 'Déposé', cls: 'bg-cyan-50 text-cyan-700' },
  en_controle: { label: 'En contrôle', cls: 'bg-amber-50 text-amber-700' },
  valide: { label: 'Validé', cls: 'bg-emerald-50 text-emerald-700' },
  a_corriger: { label: 'À corriger', cls: 'bg-orange-50 text-orange-700' },
  refuse: { label: 'Refusé', cls: 'bg-red-50 text-red-700' },
  obsolete: { label: 'Obsolète', cls: 'bg-zinc-100 text-zinc-500' },
};

const ALERT_SEVERITY: Record<string, { label: string; cls: string }> = {
  low: { label: 'Faible', cls: 'bg-zinc-100 text-zinc-700' },
  medium: { label: 'Moyenne', cls: 'bg-amber-50 text-amber-700' },
  high: { label: 'Élevée', cls: 'bg-orange-50 text-orange-700' },
  critical: { label: 'Critique', cls: 'bg-red-50 text-red-700' },
};

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{label}</span>;
}

function Modal({ open, onClose, title, children, maxW = 'max-w-lg' }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl shadow-2xl ${maxW} w-full max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-black text-zinc-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100"><XCircle className="w-5 h-5 text-zinc-500" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function fmtDate(v?: string | null) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('fr-FR'); } catch { return v; }
}

export function AmWorkspaceScreen() {
  const [space, setSpace] = useState<Space>('dashboard');
  const toast = useToast();

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Pilotage de marque"
        subtitle="Feuille de route, portes de qualification, dérogations, décisions & rapports."
      />

      <div className="flex flex-wrap gap-2 border-b border-zinc-200">
        {SPACES.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setSpace(key)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-t-lg transition ${
              space === key
                ? 'bg-white border-x border-t border-zinc-200 text-zinc-900 -mb-px'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {space === 'dashboard' && <DashboardTab toast={toast} />}
      {space === 'roadmap' && <RoadmapTab toast={toast} />}
      {space === 'chantiers' && <ChantiersTab toast={toast} />}
      {space === 'gates' && <GatesTab toast={toast} />}
      {space === 'derogations' && <DerogationsTab toast={toast} />}
      {space === 'deliverables' && <DeliverablesTab toast={toast} />}
      {space === 'economics' && <EconomicsTab toast={toast} />}
      {space === 'decisions' && <DecisionsTab toast={toast} />}
      {space === 'tests' && <TestsTab toast={toast} />}
      {space === 'compliance' && <ComplianceTab toast={toast} />}
      {space === 'alerts' && <AlertsTab toast={toast} />}
      {space === 'meetings' && <MeetingsTab toast={toast} />}
      {space === 'reports' && <ReportsTab toast={toast} />}
      {space === 'assignments' && <AssignmentsTab toast={toast} />}
    </div>
  );
}

// ══════════════ DASHBOARD ══════════════
function DashboardTab({ toast }: { toast: any }) {
  const [data, setData] = useState<R | null>(null);
  const [health, setHealth] = useState<R | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ops, h] = await Promise.all([
        api.get<R>('am/dashboards/manager-ops'),
        api.get<R>('am/dashboards/health-score').catch(() => ({ ok: false })),
      ]);
      if (ops.ok) setData(ops.data);
      if (h.ok) setHealth(h.data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-sm text-zinc-500">Chargement…</div>;
  if (!data) return <EmptyState title="Aucune donnée" message="Le tableau de bord n'a pas pu être chargé." />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Kpi label="Portes en attente" value={data.gates_pending?.length ?? 0} tone="amber" />
      <Kpi label="Dérogations à décider" value={data.derogations_to_decide?.length ?? 0} tone="orange" />
      <Kpi label="Livrables en retard" value={data.deliverables_late ?? 0} tone="red" />
      {health && (
        <div className="md:col-span-3 bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-black text-zinc-900">Score de santé de marque</h3>
            <span className="text-3xl font-black text-emerald-600">{health.composite}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(health.components || {}).map(([k, v]: [string, any]) => (
              <div key={k} className="rounded-xl bg-zinc-50 p-3">
                <div className="text-xs uppercase text-zinc-500 font-semibold">{k}</div>
                <div className="text-xl font-black text-zinc-900">{Number(v).toFixed(1)}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-zinc-500 mt-3">Fenêtre LTV : {health.ltv_window_days} jours.</div>
        </div>
      )}
      <div className="md:col-span-3 bg-white rounded-2xl border border-zinc-200 p-6">
        <h3 className="text-base font-black text-zinc-900 mb-3">Alertes ouvertes</h3>
        {data.alerts_open?.length ? (
          <div className="space-y-2">
            {data.alerts_open.map((a: R) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{a.label}</div>
                  <div className="text-xs text-zinc-500">{a.rule_code} • {fmtDate(a.opened_at)}</div>
                </div>
                <Badge {...(ALERT_SEVERITY[a.severity] ?? { label: a.severity, cls: 'bg-zinc-100' })} />
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-zinc-500">Aucune alerte ouverte.</div>}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: any; tone: string }) {
  const toneMap: Record<string, string> = {
    amber: 'from-amber-50 to-amber-100 text-amber-800',
    orange: 'from-orange-50 to-orange-100 text-orange-800',
    red: 'from-red-50 to-red-100 text-red-800',
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${toneMap[tone] ?? ''} p-5`}>
      <div className="text-xs uppercase font-bold opacity-80">{label}</div>
      <div className="text-4xl font-black">{value}</div>
    </div>
  );
}

// ══════════════ ROADMAP ══════════════
function RoadmapTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<R[]>([]);
  const [form, setForm] = useState({ template_id: '', account_manager_user_id: '' });

  const load = async () => {
    const res = await api.get<Paginated<R>>('am/roadmaps' + buildQuery({ per_page: 50 }));
    if (res.ok) setRows(res.data.data);
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const res = await api.post<R>('am/roadmaps', {
      template_id: Number(form.template_id),
      account_manager_user_id: form.account_manager_user_id ? Number(form.account_manager_user_id) : null,
    });
    if (res.ok) { toast.success('Feuille de route ouverte.'); setOpen(false); load(); }
    else toast.error(res.message);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800">
          <Plus className="w-4 h-4" /> Ouvrir une feuille de route
        </button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Aucune feuille de route" message="Ouvrez une feuille de route pour démarrer le pilotage." />
      ) : (
        <div className="grid gap-3">
          {rows.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-zinc-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-black text-zinc-900">Feuille de route #{r.id}</div>
                  <div className="text-xs text-zinc-500">Étape : {r.brand_lifecycle_stage} • Porte : {r.current_gate_code ?? 'G0'}</div>
                </div>
                <Badge {...(ROADMAP_STATUS[r.status] ?? { label: r.status, cls: 'bg-zinc-100' })} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Ouvrir une feuille de route">
        <div className="space-y-3">
          <label className="block text-sm font-semibold">Modèle de feuille de route
            <input value={form.template_id} onChange={e => setForm({ ...form, template_id: e.target.value })} placeholder="ID du modèle" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-semibold">Account manager (id utilisateur)
            <input value={form.account_manager_user_id} onChange={e => setForm({ ...form, account_manager_user_id: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          </label>
          <button onClick={submit} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-sm font-semibold">Ouvrir</button>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════ CHANTIERS ══════════════
function ChantiersTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<R>>('am/chantiers' + buildQuery({ per_page: 50 }));
      if (res.ok) setRows(res.data.data);
    })();
  }, []);
  return rows.length === 0 ? (
    <EmptyState title="Aucun chantier" message="Les chantiers apparaissent après ouverture d'une feuille de route." />
  ) : (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr><th className="text-left px-4 py-2">Code</th><th className="text-left px-4 py-2">Chantier</th><th className="text-left px-4 py-2">Statut</th><th className="text-left px-4 py-2">Deadline</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-t border-zinc-100">
              <td className="px-4 py-2 font-bold">{r.code}</td>
              <td className="px-4 py-2">{r.template?.label ?? '—'}</td>
              <td className="px-4 py-2"><span className="text-xs font-semibold">{r.status}</span></td>
              <td className="px-4 py-2 text-zinc-500">{fmtDate(r.deadline)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════ GATES ══════════════
function GatesTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  const [selected, setSelected] = useState<R | null>(null);
  const [refuseReason, setRefuseReason] = useState('');

  const load = async () => {
    const res = await api.get<Paginated<R>>('am/gates' + buildQuery({ per_page: 50 }));
    if (res.ok) setRows(res.data.data);
  };
  useEffect(() => { load(); }, []);

  const action = async (id: number, endpoint: string, body: any = {}) => {
    const res = await api.post<R>(`am/gates/${id}/${endpoint}`, body);
    if (res.ok) { toast.success('OK.'); setSelected(null); setRefuseReason(''); load(); }
    else toast.error(res.message);
  };

  return (
    <div className="grid gap-3">
      {rows.map(g => (
        <div key={g.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-black text-zinc-900">{g.code} — {g.template?.label ?? ''}</div>
              <div className="text-xs text-zinc-500">
                Critères satisfaits :{' '}
                {g.criteria?.filter((c: R) => c.status === 'satisfait').length ?? 0}/{g.criteria?.length ?? 0}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge {...(GATE_STATUS[g.status] ?? { label: g.status, cls: 'bg-zinc-100' })} />
              <button onClick={() => setSelected(g)} className="px-3 py-1 rounded-lg bg-zinc-900 text-white text-xs font-semibold">Détails</button>
            </div>
          </div>
        </div>
      ))}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.code} — ${selected.template?.label ?? ''}` : ''} maxW="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs uppercase font-bold text-zinc-500">Critères</div>
              {selected.criteria?.map((c: R) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                  <span>{c.template?.label ?? c.template_id}</span>
                  <span className="text-xs font-semibold">{c.status}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.status === 'criteres_en_cours' && (
                <button onClick={() => action(selected.id, 'request')} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Demander le franchissement</button>
              )}
              {selected.status === 'demandee' && (
                <>
                  <button onClick={() => action(selected.id, 'validate')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Valider</button>
                  <input value={refuseReason} onChange={e => setRefuseReason(e.target.value)} placeholder="Motif de refus" className="rounded-xl border border-zinc-200 px-3 py-2 text-sm flex-1" />
                  <button onClick={() => action(selected.id, 'refuse', { reason: refuseReason })} className="px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold">Refuser</button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ══════════════ DEROGATIONS ══════════════
function DerogationsTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  const [decideOn, setDecideOn] = useState<R | null>(null);
  const [decision, setDecision] = useState({ decision: 'accordee', reason: '', validity_days: '30' });

  const load = async () => {
    const res = await api.get<Paginated<R>>('am/derogations' + buildQuery({ per_page: 50 }));
    if (res.ok) setRows(res.data.data);
  };
  useEffect(() => { load(); }, []);

  const submitDecision = async () => {
    if (!decideOn) return;
    const res = await api.post<R>(`am/derogations/${decideOn.id}/decide`, {
      decision: decision.decision,
      reason: decision.reason,
      validity_days: decision.decision === 'accordee' ? Number(decision.validity_days || 30) : undefined,
    });
    if (res.ok) { toast.success('Décision enregistrée.'); setDecideOn(null); load(); }
    else toast.error(res.message);
  };

  return (
    <div className="grid gap-3">
      {rows.map(d => (
        <div key={d.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-base font-black text-zinc-900">Dérogation #{d.id} — Porte {d.gate?.code}</div>
            <Badge {...(DEROG_STATUS[d.status] ?? { label: d.status, cls: 'bg-zinc-100' })} />
          </div>
          <div className="text-xs text-zinc-500 mb-2">Motif : {d.request_reason}</div>
          <div className="text-xs text-zinc-500 mb-2">Risque : {d.identified_risk}</div>
          <div className="text-xs text-zinc-500 mb-2">Mesure compensatoire : {d.compensatory_measure}</div>
          {d.expires_at && <div className="text-xs text-orange-700 font-semibold">Expire le {fmtDate(d.expires_at)}</div>}
          {d.status === 'demandee' && (
            <button onClick={() => setDecideOn(d)} className="mt-2 px-3 py-1 rounded-lg bg-zinc-900 text-white text-xs font-semibold">Décider</button>
          )}
        </div>
      ))}
      <Modal open={!!decideOn} onClose={() => setDecideOn(null)} title="Décider de la dérogation">
        <div className="space-y-3">
          <select value={decision.decision} onChange={e => setDecision({ ...decision, decision: e.target.value })} className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm">
            <option value="accordee">Accorder</option>
            <option value="refusee">Refuser</option>
          </select>
          <input value={decision.reason} onChange={e => setDecision({ ...decision, reason: e.target.value })} placeholder="Motif" className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          {decision.decision === 'accordee' && (
            <input value={decision.validity_days} onChange={e => setDecision({ ...decision, validity_days: e.target.value })} placeholder="Validité (jours, max 30)" className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          )}
          <button onClick={submitDecision} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-sm font-semibold">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}

// ══════════════ DELIVERABLES ══════════════
function DeliverablesTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  const load = async () => {
    const res = await api.get<Paginated<R>>('am/deliverables' + buildQuery({ per_page: 50 }));
    if (res.ok) setRows(res.data.data);
  };
  useEffect(() => { load(); }, []);

  const validate = async (id: number) => {
    const res = await api.post<R>(`am/deliverables/${id}/validate`);
    if (res.ok) { toast.success('Livrable validé.'); load(); }
    else toast.error(res.message);
  };

  return rows.length === 0 ? (
    <EmptyState title="Aucun livrable" message="Créez un livrable rattaché à un chantier." />
  ) : (
    <div className="grid gap-3">
      {rows.map(d => (
        <div key={d.id} className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-black text-zinc-900">{d.label}</div>
            <div className="text-xs text-zinc-500">{d.deliverable_type} • Deadline : {fmtDate(d.deadline)}</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge {...(DELIV_STATUS[d.status] ?? { label: d.status, cls: 'bg-zinc-100' })} />
            {['depose', 'en_controle', 'a_corriger'].includes(d.status) && (
              <button onClick={() => validate(d.id)} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Valider</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════ ECONOMICS ══════════════
function EconomicsTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<R>>('am/brand-economics' + buildQuery({ per_page: 25 }));
      if (res.ok) setRows(res.data.data);
    })();
  }, []);
  return rows.length === 0 ? (
    <EmptyState title="Modèle économique non renseigné" message="Ajoutez le modèle économique via l'API pour piloter la marge et le ratio LTV/CAC." />
  ) : (
    <div className="grid gap-3">
      {rows.map(e => (
        <div key={e.id} className="bg-white rounded-2xl border border-zinc-200 p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Metric label="Prix vente" value={e.selling_price} />
            <Metric label="COGS" value={e.cogs} />
            <Metric label="Marge brute" value={e.gross_margin != null ? `${(Number(e.gross_margin) * 100).toFixed(1)} %` : '—'} />
            <Metric label="Cible marge" value={e.gross_margin_target != null ? `${(Number(e.gross_margin_target) * 100).toFixed(1)} %` : '—'} />
            <Metric label="CAC observé" value={e.observed_cac} />
            <Metric label="LTV" value={e.ltv} />
            <Metric label="Ratio LTV/CAC" value={e.ltv_cac_ratio} highlight={Number(e.ltv_cac_ratio ?? 0) < Number(e.ltv_cac_threshold ?? 3)} />
            <Metric label="Seuil ratio" value={e.ltv_cac_threshold} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value, highlight = false }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-red-50 text-red-800' : 'bg-zinc-50 text-zinc-800'}`}>
      <div className="text-xs uppercase font-semibold opacity-70">{label}</div>
      <div className="text-lg font-black">{value ?? '—'}</div>
    </div>
  );
}

// ══════════════ DECISIONS ══════════════
function DecisionsTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<R>>('am/decisions' + buildQuery({ per_page: 30 }));
      if (res.ok) setRows(res.data.data);
    })();
  }, []);
  return rows.length === 0 ? (
    <EmptyState title="Journal vide" message="Aucune décision consignée." />
  ) : (
    <div className="space-y-3">
      {rows.map(d => (
        <div key={d.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="text-sm font-black text-zinc-900">{d.subject}</div>
          <div className="text-xs text-zinc-500 mb-2">{fmtDate(d.decided_at)} — {d.author?.name}</div>
          <div className="text-sm text-zinc-700">{d.decision_taken}</div>
          {d.invoked_indicator && <div className="text-xs mt-2 text-zinc-500">Indicateur : {d.invoked_indicator} = {d.invoked_value}</div>}
        </div>
      ))}
    </div>
  );
}

// ══════════════ TESTS ══════════════
function TestsTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<R>>('am/tests' + buildQuery({ per_page: 30 }));
      if (res.ok) setRows(res.data.data);
    })();
  }, []);
  return rows.length === 0 ? (
    <EmptyState title="Aucun test" message="Planifiez un test pour tracer l'apprentissage." />
  ) : (
    <div className="space-y-3">
      {rows.map(t => (
        <div key={t.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="text-sm font-black text-zinc-900">{t.hypothesis}</div>
          <div className="text-xs text-zinc-500">{t.tested_variable} • Statut : {t.status}</div>
          <div className="text-xs mt-1">Cible : {t.success_metric} ≥ {t.success_threshold}, observé : {t.observed_result ?? '—'}</div>
          {t.verdict && <div className="text-xs mt-1 font-bold uppercase text-emerald-700">Verdict : {t.verdict}</div>}
        </div>
      ))}
    </div>
  );
}

// ══════════════ COMPLIANCE ══════════════
function ComplianceTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  const load = async () => {
    const res = await api.get<Paginated<R>>('am/compliance-checks' + buildQuery({ per_page: 30 }));
    if (res.ok) setRows(res.data.data);
  };
  useEffect(() => { load(); }, []);

  const setStatus = async (id: number, status: string) => {
    const res = await api.patch<R>(`am/compliance-checks/${id}`, { status });
    if (res.ok) { toast.success('Statut mis à jour.'); load(); }
    else toast.error(res.message);
  };

  return rows.length === 0 ? (
    <EmptyState title="Aucun contrôle" message="Créez un contrôle par produit / marché." />
  ) : (
    <div className="grid gap-3">
      {rows.map(c => (
        <div key={c.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-zinc-900">Produit #{c.product_id ?? 'Consolidé'} — {c.market}</div>
              <div className="text-xs text-zinc-500">Type : {c.product_type ?? 'non renseigné'}</div>
            </div>
            <div className="text-xs font-bold uppercase">{c.status}</div>
          </div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setStatus(c.id, 'conforme')} className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Marquer conforme</button>
            <button onClick={() => setStatus(c.id, 'non_conforme')} className="px-2 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold">Non conforme (suspension auto)</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════ ALERTS ══════════════
function AlertsTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  const load = async () => {
    const res = await api.get<Paginated<R>>('am/alerts' + buildQuery({ per_page: 50 }));
    if (res.ok) setRows(res.data.data);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: number, endpoint: string, body: any = {}) => {
    const res = await api.post<R>(`am/alerts/${id}/${endpoint}`, body);
    if (res.ok) { toast.success('OK.'); load(); }
    else toast.error(res.message);
  };

  return rows.length === 0 ? (
    <EmptyState title="Aucune alerte" message="Aucune règle AM ne s'est déclenchée récemment." />
  ) : (
    <div className="space-y-3">
      {rows.map(a => (
        <div key={a.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-black text-zinc-900">{a.label}</div>
            <Badge {...(ALERT_SEVERITY[a.severity] ?? { label: a.severity, cls: 'bg-zinc-100' })} />
          </div>
          <div className="text-xs text-zinc-500">{a.rule_code} • Ouverte le {fmtDate(a.opened_at)}</div>
          {a.description && <div className="text-sm text-zinc-700 mt-1">{a.description}</div>}
          <div className="mt-2 flex gap-2">
            {a.status === 'ouverte' && <button onClick={() => act(a.id, 'take')} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold">Prendre en charge</button>}
            {['ouverte', 'prise_en_charge'].includes(a.status) && (
              <button onClick={() => {
                const r = prompt('Action de résolution ?'); if (r) act(a.id, 'resolve', { resolution_action: r });
              }} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Résoudre</button>
            )}
            {['ouverte', 'prise_en_charge'].includes(a.status) && (
              <button onClick={() => act(a.id, 'escalate', { level: 1 })} className="px-3 py-1 rounded-lg bg-orange-600 text-white text-xs font-semibold">Escalader</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════ MEETINGS ══════════════
function MeetingsTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<R>>('am/client-meetings' + buildQuery({ per_page: 30 }));
      if (res.ok) setRows(res.data.data);
    })();
  }, []);
  return rows.length === 0 ? (
    <EmptyState title="Aucune réunion" message="Aucune réunion client planifiée." />
  ) : (
    <div className="space-y-3">
      {rows.map(m => (
        <div key={m.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-black text-zinc-900">Réunion #{m.id}</div>
            <span className="text-xs font-bold uppercase text-zinc-500">{m.status}</span>
          </div>
          <div className="text-xs text-zinc-500">Planifiée le {fmtDate(m.scheduled_at)}</div>
          {m.agenda && <div className="text-sm mt-1">{m.agenda}</div>}
          {m.actions?.length > 0 && (
            <div className="mt-2 text-xs text-zinc-600">
              {m.actions.length} action(s) de suivi.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ══════════════ REPORTS ══════════════
function ReportsTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  const load = async () => {
    const res = await api.get<Paginated<R>>('am/client-reports' + buildQuery({ per_page: 30 }));
    if (res.ok) setRows(res.data.data);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: number, endpoint: string, body: any = {}) => {
    const res = await api.post<R>(`am/client-reports/${id}/${endpoint}`, body);
    if (res.ok) { toast.success('OK.'); load(); }
    else toast.error(res.message);
  };

  return rows.length === 0 ? (
    <EmptyState title="Aucun rapport" message="Créez un rapport client pour le partager avec la marque." />
  ) : (
    <div className="grid gap-3">
      {rows.map(r => (
        <div key={r.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-zinc-900">Rapport {r.period} — {r.template?.label ?? ''}</div>
              <div className="text-xs text-zinc-500">Statut : {r.status}</div>
            </div>
            <div className="flex gap-2">
              {r.status === 'brouillon' && <button onClick={() => act(r.id, 'validate')} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold">Valider</button>}
              {r.status === 'valide' && (
                <button onClick={() => {
                  const ids = prompt('IDs utilisateurs destinataires (séparés par virgule) ?');
                  if (ids) act(r.id, 'publish', { recipient_user_ids: ids.split(',').map(s => Number(s.trim())).filter(Boolean) });
                }} className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Publier</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════ ASSIGNMENTS ══════════════
function AssignmentsTab({ toast }: { toast: any }) {
  const [rows, setRows] = useState<R[]>([]);
  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<R>>('am/brand-assignments' + buildQuery({ per_page: 50 }));
      if (res.ok) setRows(res.data.data);
    })();
  }, []);
  return rows.length === 0 ? (
    <EmptyState title="Aucun rattachement" message="Aucune personne rattachée à cette marque." />
  ) : (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr><th className="text-left px-4 py-2">Personne</th><th className="text-left px-4 py-2">Rôle</th><th className="text-left px-4 py-2">Quotité</th><th className="text-left px-4 py-2">Période</th></tr>
        </thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id} className="border-t border-zinc-100">
              <td className="px-4 py-2 font-semibold">{a.user?.name ?? '—'}</td>
              <td className="px-4 py-2">{a.role_on_brand}</td>
              <td className="px-4 py-2">{a.quotity_percent}%</td>
              <td className="px-4 py-2 text-xs text-zinc-500">{fmtDate(a.starts_at)} → {fmtDate(a.ends_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AmWorkspaceScreen;
