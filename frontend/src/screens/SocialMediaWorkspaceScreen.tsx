import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid, Target, Calendar, FileText, ShieldCheck, PartyPopper, Zap,
  Eye, BarChart3, UserCheck, BookOpen, ClipboardList,
  Plus, Send, CheckCircle2, XCircle, AlertTriangle, Pencil, Trash2, Play, Pause,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type Space =
  | 'dashboard' | 'strategy' | 'plans' | 'calendar' | 'contents' | 'validation'
  | 'events' | 'automations' | 'veille' | 'performance' | 'supervision' | 'library';

type R = Record<string, any>;

const SPACES: { key: Space; label: string; Icon: any }[] = [
  { key: 'dashboard', label: 'Tableau de bord', Icon: LayoutGrid },
  { key: 'strategy', label: 'Stratégie', Icon: Target },
  { key: 'plans', label: 'Plan mensuel', Icon: FileText },
  { key: 'calendar', label: 'Calendrier', Icon: Calendar },
  { key: 'contents', label: 'Contenus', Icon: ClipboardList },
  { key: 'validation', label: 'Validation', Icon: ShieldCheck },
  { key: 'events', label: 'Événements', Icon: PartyPopper },
  { key: 'automations', label: 'Automatisations', Icon: Zap },
  { key: 'veille', label: 'Veille', Icon: Eye },
  { key: 'performance', label: 'Performance', Icon: BarChart3 },
  { key: 'supervision', label: 'Supervision CM', Icon: UserCheck },
  { key: 'library', label: 'Bibliothèque', Icon: BookOpen },
];

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x'];
const FORMATS = ['reel', 'story', 'post', 'carrousel', 'video', 'live'];
const FINALITIES = ['awareness', 'consideration', 'conversion', 'fidelisation', 'community'];

const CONTENT_STATUSES: Record<string, { label: string; cls: string }> = {
  a_briefer: { label: 'À briefer', cls: 'bg-zinc-100 text-zinc-700' },
  briefe: { label: 'Briefé', cls: 'bg-blue-50 text-blue-700' },
  en_production: { label: 'En production', cls: 'bg-amber-50 text-amber-700' },
  en_revision: { label: 'En révision', cls: 'bg-violet-50 text-violet-700' },
  a_valider_direction: { label: 'À valider Direction', cls: 'bg-orange-50 text-orange-700' },
  valide: { label: 'Validé', cls: 'bg-emerald-50 text-emerald-700' },
  transmis_cm: { label: 'Transmis CM', cls: 'bg-cyan-50 text-cyan-700' },
  publie: { label: 'Publié', cls: 'bg-emerald-100 text-emerald-800' },
  non_publie: { label: 'Non publié', cls: 'bg-red-50 text-red-700' },
  annule: { label: 'Annulé', cls: 'bg-zinc-100 text-zinc-500' },
};

const STRATEGY_STATUS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-zinc-100 text-zinc-600' },
  soumise: { label: 'Soumise', cls: 'bg-amber-50 text-amber-700' },
  validee: { label: 'Validée', cls: 'bg-emerald-50 text-emerald-700' },
  rejetee: { label: 'Rejetée', cls: 'bg-red-50 text-red-700' },
  modification_demandee: { label: 'Modif. demandée', cls: 'bg-orange-50 text-orange-700' },
};

const PLAN_STATUS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-zinc-100 text-zinc-600' },
  soumis: { label: 'Soumis', cls: 'bg-amber-50 text-amber-700' },
  valide: { label: 'Validé', cls: 'bg-emerald-50 text-emerald-700' },
  rejete: { label: 'Rejeté', cls: 'bg-red-50 text-red-700' },
  modification_demandee: { label: 'Modif. demandée', cls: 'bg-orange-50 text-orange-700' },
};

const MONTHS_FR = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

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

function Field({ label, children }: any) {
  return (
    <label className="block text-sm font-bold text-zinc-700">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm';

export function SocialMediaWorkspaceScreen() {
  const toast = useToast();
  const [space, setSpace] = useState<Space>('dashboard');

  // Shared data
  const [dash, setDash] = useState<R | null>(null);
  const [strategies, setStrategies] = useState<R[]>([]);
  const [plans, setPlans] = useState<R[]>([]);
  const [contents, setContents] = useState<R[]>([]);
  const [events, setEvents] = useState<R[]>([]);
  const [automations, setAutomations] = useState<R[]>([]);
  const [veilleNotes, setVeilleNotes] = useState<R[]>([]);
  const [performances, setPerformances] = useState<R[]>([]);
  const [learnings, setLearnings] = useState<R[]>([]);
  const [reports, setReports] = useState<R[]>([]);
  const [insights, setInsights] = useState<R[]>([]);
  const [execChecks, setExecChecks] = useState<R[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [d, s, p, c, e, a, v, perf, l, r, i, ec] = await Promise.all([
        api.get<R>('smm/dashboard/summary'),
        api.get<Paginated<R>>('smm/strategies' + buildQuery({ per_page: 50 })),
        api.get<Paginated<R>>('smm/plans' + buildQuery({ per_page: 50 })),
        api.get<Paginated<R>>('smm/contents' + buildQuery({ per_page: 100 })),
        api.get<Paginated<R>>('smm/events' + buildQuery({ per_page: 50 })),
        api.get<Paginated<R>>('smm/automations' + buildQuery({ per_page: 50 })),
        api.get<Paginated<R>>('smm/veille/notes' + buildQuery({ per_page: 30 })),
        api.get<Paginated<R>>('smm/performance' + buildQuery({ per_page: 100 })),
        api.get<Paginated<R>>('smm/learnings' + buildQuery({ per_page: 50 })),
        api.get<Paginated<R>>('smm/reports' + buildQuery({ per_page: 24 })),
        api.get<Paginated<R>>('smm/insights' + buildQuery({ per_page: 50 })),
        api.get<Paginated<R>>('smm/execution-checks' + buildQuery({ per_page: 50 })),
      ]);
      if (d.ok) setDash(d.data);
      if (s.ok) setStrategies(s.data.data);
      if (p.ok) setPlans(p.data.data);
      if (c.ok) setContents(c.data.data);
      if (e.ok) setEvents(e.data.data);
      if (a.ok) setAutomations(a.data.data);
      if (v.ok) setVeilleNotes(v.data.data);
      if (perf.ok) setPerformances(perf.data.data);
      if (l.ok) setLearnings(l.data.data);
      if (r.ok) setReports(r.data.data);
      if (i.ok) setInsights(i.data.data);
      if (ec.ok) setExecChecks(ec.data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    validation: contents.filter((c) => c.status === 'a_valider_direction').length + strategies.filter((s) => s.status === 'soumise').length + plans.filter((p) => p.status === 'soumis').length,
    contents: contents.filter((c) => ['a_briefer', 'briefe', 'en_production', 'en_revision'].includes(c.status)).length,
    supervision: execChecks.filter((c) => c.status === 'ecart_constate').length,
  }), [contents, strategies, plans, execChecks]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Réseaux sociaux · Stratégie & contenu"
        subtitle="Stratégie trimestrielle, plan mensuel, production, validation, veille et performance."
      />

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-1">
        {SPACES.map(({ key, label, Icon }) => {
          const active = space === key;
          const count = (counts as any)[key];
          return (
            <button
              key={key}
              onClick={() => setSpace(key)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-t-xl text-sm font-black transition-colors ${active ? 'bg-primary-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && <span className={`inline-flex items-center rounded-full px-1.5 min-w-[20px] justify-center text-[10px] ${active ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {loading && <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>}

      {!loading && space === 'dashboard' && <DashboardTab dash={dash} />}
      {!loading && space === 'strategy' && <StrategyTab strategies={strategies} onReload={load} />}
      {!loading && space === 'plans' && <PlansTab plans={plans} strategies={strategies} onReload={load} />}
      {!loading && space === 'calendar' && <CalendarTab contents={contents} />}
      {!loading && space === 'contents' && <ContentsTab contents={contents} plans={plans} events={events} onReload={load} />}
      {!loading && space === 'validation' && <ValidationTab strategies={strategies} plans={plans} contents={contents} onReload={load} />}
      {!loading && space === 'events' && <EventsTab events={events} onReload={load} />}
      {!loading && space === 'automations' && <AutomationsTab automations={automations} onReload={load} />}
      {!loading && space === 'veille' && <VeilleTab notes={veilleNotes} onReload={load} />}
      {!loading && space === 'performance' && <PerformanceTab performances={performances} contents={contents} onReload={load} />}
      {!loading && space === 'supervision' && <SupervisionTab checks={execChecks} contents={contents} onReload={load} />}
      {!loading && space === 'library' && <LibraryTab learnings={learnings} reports={reports} insights={insights} onReload={load} />}
    </div>
  );
}

/* ─── DASHBOARD ─── */
function DashboardTab({ dash }: { dash: R | null }) {
  if (!dash) return <EmptyState title="Aucune donnée" description="Le tableau de bord se remplira dès qu'il y aura de l'activité." />;
  const kpis = [
    { label: 'Contenus à publier aujourd\'hui', value: dash.today_contents, cls: 'text-blue-600' },
    { label: 'En production', value: dash.in_production, cls: 'text-amber-600' },
    { label: 'En retard', value: dash.late_contents, cls: dash.late_contents > 0 ? 'text-red-600' : 'text-emerald-600' },
    { label: 'À valider Direction', value: dash.pending_validation_direction, cls: 'text-orange-600' },
    { label: 'Plans en attente', value: dash.pending_plans, cls: 'text-violet-600' },
    { label: 'Stratégies en attente', value: dash.pending_strategies, cls: 'text-violet-600' },
    { label: 'Écarts aujourd\'hui', value: dash.today_deviations, cls: dash.today_deviations > 0 ? 'text-red-600' : 'text-emerald-600' },
    { label: 'Événements à venir (30 j)', value: dash.upcoming_events, cls: 'text-cyan-600' },
    { label: 'Automatisations actives', value: dash.active_automations, cls: 'text-emerald-600' },
    { label: 'Échecs de sync', value: dash.sync_failures, cls: dash.sync_failures > 0 ? 'text-red-600' : 'text-emerald-600' },
  ];
  const byStatus = dash.by_status ?? {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{k.label}</p>
            <p className={`text-2xl font-black mt-1 ${k.cls}`}>{k.value ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-black text-zinc-900 mb-3">Pipeline de production</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.keys(CONTENT_STATUSES).map((s) => (
            <div key={s} className="rounded-xl border border-zinc-100 p-3">
              <Badge label={CONTENT_STATUSES[s].label} cls={CONTENT_STATUSES[s].cls} />
              <p className="text-xl font-black text-zinc-900 mt-2">{byStatus[s] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
      {dash.current_report && (
        <div className="card p-5">
          <h3 className="text-sm font-black text-zinc-900">Rapport mensuel en cours</h3>
          <p className="text-sm text-zinc-600 mt-1">
            {MONTHS_FR[dash.current_report.month - 1]} {dash.current_report.year} — statut: <b>{dash.current_report.status}</b>
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── STRATEGY ─── */
function StrategyTab({ strategies, onReload }: { strategies: R[]; onReload: () => void }) {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ year: String(new Date().getFullYear()), quarter: '1', start_date: '', end_date: '', social_objectives: '', business_objectives: '', tone_of_voice: '', quarter_priorities: '' });

  const [pillarOpen, setPillarOpen] = useState<{ strategyId: number } | null>(null);
  const [pillarForm, setPillarForm] = useState({ label: '', business_objective: '', target_share_percent: '', description: '' });

  const [contribOpen, setContribOpen] = useState<{ strategyId: number } | null>(null);
  const [contribUserId, setContribUserId] = useState('');
  const [users, setUsers] = useState<R[]>([]);

  useEffect(() => {
    (async () => {
      const r = await api.get<Paginated<R>>('users' + buildQuery({ per_page: 100 }));
      if (r.ok) setUsers((r.data as any).data ?? r.data);
    })();
  }, []);

  const create = async () => {
    if (!form.start_date || !form.end_date) { toast.error('Dates requises.'); return; }
    const res = await api.post('smm/strategies', {
      year: Number(form.year), quarter: Number(form.quarter),
      start_date: form.start_date, end_date: form.end_date,
      social_objectives: form.social_objectives, business_objectives: form.business_objectives,
      tone_of_voice: form.tone_of_voice || undefined,
      quarter_priorities: form.quarter_priorities || undefined,
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Stratégie créée.'); setShowCreate(false); onReload();
  };

  const submit = async (id: number) => {
    const r = await api.post(`smm/strategies/${id}/submit`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Soumise.'); onReload();
  };

  const validateS = async (id: number) => {
    const r = await api.post(`smm/strategies/${id}/validate`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Validée.'); onReload();
  };

  const reject = async (id: number) => {
    const reason = prompt('Motif de rejet ?'); if (!reason) return;
    const r = await api.post(`smm/strategies/${id}/reject`, { rejection_reason: reason });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Rejetée.'); onReload();
  };

  const addPillar = async () => {
    if (!pillarOpen) return;
    const r = await api.post(`smm/strategies/${pillarOpen.strategyId}/pillars`, {
      label: pillarForm.label,
      business_objective: pillarForm.business_objective,
      target_share_percent: pillarForm.target_share_percent ? Number(pillarForm.target_share_percent) : undefined,
      description: pillarForm.description || undefined,
    });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Pilier ajouté.'); setPillarOpen(null); setPillarForm({ label: '', business_objective: '', target_share_percent: '', description: '' }); onReload();
  };

  const solicit = async () => {
    if (!contribOpen || !contribUserId) return;
    const r = await api.post(`smm/strategies/${contribOpen.strategyId}/solicit-contribution`, { contributor_user_id: Number(contribUserId) });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Contribution sollicitée.'); setContribOpen(null); setContribUserId(''); onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle stratégie
        </button>
      </div>

      {strategies.length === 0 ? (
        <EmptyState title="Aucune stratégie" description="Créez la première stratégie trimestrielle." />
      ) : (
        <div className="grid gap-4">
          {strategies.map((s) => {
            const st = STRATEGY_STATUS[s.status] ?? { label: s.status, cls: 'bg-zinc-100' };
            return (
              <div key={s.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-black text-zinc-900">T{s.quarter} {s.year}</h3>
                      <Badge label={st.label} cls={st.cls} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{s.start_date} → {s.end_date} · {s.pillars_count ?? 0} piliers · {s.contributions_count ?? 0} contributions</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {s.status === 'brouillon' && (
                      <>
                        <button onClick={() => setPillarOpen({ strategyId: s.id })} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold">+ Pilier</button>
                        <button onClick={() => setContribOpen({ strategyId: s.id })} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold">+ Contributeur</button>
                        <button onClick={() => submit(s.id)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-black inline-flex items-center gap-1"><Send className="w-3 h-3" /> Soumettre</button>
                      </>
                    )}
                    {s.status === 'soumise' && (
                      <>
                        <button onClick={() => validateS(s.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Valider</button>
                        <button onClick={() => reject(s.id)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black">Rejeter</button>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><b className="text-zinc-500">Objectifs Social:</b> {s.social_objectives}</div>
                  <div><b className="text-zinc-500">Objectifs Business:</b> {s.business_objectives}</div>
                  {s.tone_of_voice && <div className="md:col-span-2"><b className="text-zinc-500">Tonalité:</b> {s.tone_of_voice}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle stratégie trimestrielle">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Année"><input type="number" className={inputCls} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
          <Field label="Trimestre"><select className={inputCls} value={form.quarter} onChange={(e) => setForm({ ...form, quarter: e.target.value })}><option value="1">T1</option><option value="2">T2</option><option value="3">T3</option><option value="4">T4</option></select></Field>
          <Field label="Début"><input type="date" className={inputCls} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
          <Field label="Fin"><input type="date" className={inputCls} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Objectifs Social Media *"><textarea rows={2} className={inputCls} value={form.social_objectives} onChange={(e) => setForm({ ...form, social_objectives: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Objectifs business *"><textarea rows={2} className={inputCls} value={form.business_objectives} onChange={(e) => setForm({ ...form, business_objectives: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Tonalité de voix"><textarea rows={2} className={inputCls} value={form.tone_of_voice} onChange={(e) => setForm({ ...form, tone_of_voice: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Priorités du trimestre"><textarea rows={2} className={inputCls} value={form.quarter_priorities} onChange={(e) => setForm({ ...form, quarter_priorities: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={create} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>

      <Modal open={!!pillarOpen} onClose={() => setPillarOpen(null)} title="Nouveau pilier de contenu">
        <div className="grid gap-3">
          <Field label="Libellé *"><input className={inputCls} value={pillarForm.label} onChange={(e) => setPillarForm({ ...pillarForm, label: e.target.value })} /></Field>
          <Field label="Objectif business rattaché *"><input className={inputCls} value={pillarForm.business_objective} onChange={(e) => setPillarForm({ ...pillarForm, business_objective: e.target.value })} /></Field>
          <Field label="Part cible (%)"><input type="number" className={inputCls} value={pillarForm.target_share_percent} onChange={(e) => setPillarForm({ ...pillarForm, target_share_percent: e.target.value })} /></Field>
          <Field label="Description"><textarea rows={2} className={inputCls} value={pillarForm.description} onChange={(e) => setPillarForm({ ...pillarForm, description: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setPillarOpen(null)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={addPillar} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Ajouter</button>
        </div>
      </Modal>

      <Modal open={!!contribOpen} onClose={() => setContribOpen(null)} title="Solliciter un contributeur">
        <Field label="Contributeur">
          <select className={inputCls} value={contribUserId} onChange={(e) => setContribUserId(e.target.value)}>
            <option value="">— sélectionner —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setContribOpen(null)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={solicit} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Solliciter</button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── PLANS ─── */
function PlansTab({ plans, strategies, onReload }: { plans: R[]; strategies: R[]; onReload: () => void }) {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1), strategy_id: '', declared_capacity: '' });

  const create = async () => {
    if (!form.strategy_id) { toast.error('Stratégie requise.'); return; }
    const r = await api.post('smm/plans', {
      year: Number(form.year), month: Number(form.month),
      strategy_id: Number(form.strategy_id),
      declared_capacity: form.declared_capacity ? Number(form.declared_capacity) : undefined,
    });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Plan créé.'); setShowCreate(false); onReload();
  };

  const submit = async (id: number) => {
    const r = await api.post(`smm/plans/${id}/submit`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Soumis.'); onReload();
  };

  const validateP = async (id: number) => {
    const r = await api.post(`smm/plans/${id}/validate`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Validé.'); onReload();
  };

  const reject = async (id: number) => {
    const reason = prompt('Motif ?'); if (!reason) return;
    const r = await api.post(`smm/plans/${id}/reject`, { rejection_reason: reason });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Rejeté.'); onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouveau plan
        </button>
      </div>

      {plans.length === 0 ? (
        <EmptyState title="Aucun plan" description="Créez le premier plan mensuel (une stratégie validée est requise)." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Mois</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Stratégie</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Contenus</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Capacité</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => {
                const st = PLAN_STATUS[p.status] ?? { label: p.status, cls: 'bg-zinc-100' };
                return (
                  <tr key={p.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{MONTHS_FR[p.month - 1]} {p.year}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{p.strategy ? `T${p.strategy.quarter} ${p.strategy.year}` : '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{p.contents_count ?? 0}</td>
                    <td className="px-4 py-3 text-sm text-zinc-500">{p.declared_capacity ?? '—'}</td>
                    <td className="px-4 py-3"><Badge label={st.label} cls={st.cls} /></td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'brouillon' && <button onClick={() => submit(p.id)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-black">Soumettre</button>}
                      {p.status === 'soumis' && (
                        <div className="inline-flex gap-1">
                          <button onClick={() => validateP(p.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Valider</button>
                          <button onClick={() => reject(p.id)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black">Rejeter</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau plan mensuel">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Année"><input type="number" className={inputCls} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></Field>
          <Field label="Mois"><select className={inputCls} value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })}>{MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></Field>
          <div className="col-span-2">
            <Field label="Stratégie validée *">
              <select className={inputCls} value={form.strategy_id} onChange={(e) => setForm({ ...form, strategy_id: e.target.value })}>
                <option value="">— sélectionner —</option>
                {strategies.filter((s) => s.status === 'validee').map((s) => <option key={s.id} value={s.id}>T{s.quarter} {s.year}</option>)}
              </select>
            </Field>
          </div>
          <div className="col-span-2"><Field label="Capacité déclarée"><input type="number" className={inputCls} value={form.declared_capacity} onChange={(e) => setForm({ ...form, declared_capacity: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={create} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── CALENDAR ─── */
function CalendarTab({ contents }: { contents: R[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const base = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + monthOffset); return d; }, [monthOffset]);
  const year = base.getFullYear(), month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  const grouped: Record<string, R[]> = {};
  contents.forEach((c) => {
    if (!c.scheduled_publish_at) return;
    const d = new Date(c.scheduled_publish_at);
    if (d.getFullYear() !== year || d.getMonth() !== month) return;
    const day = d.getDate();
    (grouped[day] = grouped[day] ?? []).push(c);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setMonthOffset((v) => v - 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold">‹ Précédent</button>
        <h3 className="text-lg font-black text-zinc-900">{MONTHS_FR[month]} {year}</h3>
        <button onClick={() => setMonthOffset((v) => v + 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold">Suivant ›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs font-black text-zinc-500 uppercase">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <div key={d} className="p-2 text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const items = grouped[day] ?? [];
          return (
            <div key={day} className="border border-zinc-100 rounded-lg p-2 min-h-[100px] bg-white">
              <p className="text-xs font-black text-zinc-400">{day}</p>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((c) => {
                  const st = CONTENT_STATUSES[c.status] ?? { label: c.status, cls: 'bg-zinc-100' };
                  return (
                    <div key={c.id} className={`text-[10px] rounded px-1.5 py-1 ${st.cls} truncate`} title={c.title}>{c.title}</div>
                  );
                })}
                {items.length > 3 && <p className="text-[10px] font-bold text-zinc-500">+{items.length - 3}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── CONTENTS (pipeline) ─── */
function ContentsTab({ contents, plans, events, onReload }: { contents: R[]; plans: R[]; events: R[]; onReload: () => void }) {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [pillars, setPillars] = useState<R[]>([]);
  const [selected, setSelected] = useState<R | null>(null);

  useEffect(() => {
    (async () => {
      // Load pillars from all strategies for the dropdown
      const r = await api.get<Paginated<R>>('smm/strategies' + buildQuery({ per_page: 50 }));
      if (r.ok) {
        const strategies = r.data.data;
        const allPillars: R[] = [];
        for (const s of strategies) {
          const d = await api.get<R>(`smm/strategies/${s.id}`);
          if (d.ok && d.data.pillars) allPillars.push(...d.data.pillars);
        }
        setPillars(allPillars);
      }
    })();
  }, []);

  const [form, setForm] = useState({
    title: '', concept: '', platform: 'instagram', format: 'reel', finality: 'awareness',
    pillar_id: '', monthly_plan_id: '', event_id: '',
    production_mode: 'interne_smm', scheduled_publish_at: '',
    is_sensitive: false, sensitivity_reason: '',
  });

  const filtered = useMemo(() => {
    return contents.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (platformFilter && c.platform !== platformFilter) return false;
      return true;
    });
  }, [contents, statusFilter, platformFilter]);

  const create = async () => {
    if (!form.title.trim() || !form.pillar_id) { toast.error('Titre et pilier requis.'); return; }
    const r = await api.post('smm/contents', {
      title: form.title, concept: form.concept || undefined,
      platform: form.platform, format: form.format, finality: form.finality || undefined,
      pillar_id: Number(form.pillar_id),
      monthly_plan_id: form.monthly_plan_id ? Number(form.monthly_plan_id) : undefined,
      event_id: form.event_id ? Number(form.event_id) : undefined,
      production_mode: form.production_mode,
      scheduled_publish_at: form.scheduled_publish_at || undefined,
      is_sensitive: form.is_sensitive,
      sensitivity_reason: form.sensitivity_reason || undefined,
    });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Contenu créé.'); setShowCreate(false);
    setForm({ title: '', concept: '', platform: 'instagram', format: 'reel', finality: 'awareness', pillar_id: '', monthly_plan_id: '', event_id: '', production_mode: 'interne_smm', scheduled_publish_at: '', is_sensitive: false, sensitivity_reason: '' });
    onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <select className={inputCls + ' w-auto'} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous statuts</option>
            {Object.keys(CONTENT_STATUSES).map((s) => <option key={s} value={s}>{CONTENT_STATUSES[s].label}</option>)}
          </select>
          <select className={inputCls + ' w-auto'} value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
            <option value="">Toutes plateformes</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouveau contenu
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun contenu" description="Créez votre premier contenu." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Plateforme</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Format</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Pilier</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Assigné</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Planifié</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const st = CONTENT_STATUSES[c.status] ?? { label: c.status, cls: 'bg-zinc-100' };
                return (
                  <tr key={c.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">
                      {c.is_sensitive && <AlertTriangle className="inline w-3.5 h-3.5 text-orange-600 mr-1" />}
                      {c.title}
                    </td>
                    <td className="px-4 py-3 text-xs uppercase text-zinc-600">{c.platform}</td>
                    <td className="px-4 py-3 text-xs uppercase text-zinc-600">{c.format}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{c.pillar?.label ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{c.assigned_to?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{c.scheduled_publish_at ? new Date(c.scheduled_publish_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                    <td className="px-4 py-3"><Badge label={st.label} cls={st.cls} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(c)} className="text-xs font-bold text-primary-600">Ouvrir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau contenu" maxW="max-w-2xl">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Titre *"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Concept"><textarea rows={2} className={inputCls} value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} /></Field></div>
          <Field label="Plateforme"><select className={inputCls} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Format"><select className={inputCls} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>{FORMATS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Finalité"><select className={inputCls} value={form.finality} onChange={(e) => setForm({ ...form, finality: e.target.value })}>{FINALITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Pilier *"><select className={inputCls} value={form.pillar_id} onChange={(e) => setForm({ ...form, pillar_id: e.target.value })}><option value="">—</option>{pillars.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
          <Field label="Plan mensuel"><select className={inputCls} value={form.monthly_plan_id} onChange={(e) => setForm({ ...form, monthly_plan_id: e.target.value })}><option value="">—</option>{plans.map((p) => <option key={p.id} value={p.id}>{MONTHS_FR[p.month - 1]} {p.year}</option>)}</select></Field>
          <Field label="Événement lié"><select className={inputCls} value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })}><option value="">—</option>{events.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></Field>
          <Field label="Mode de production"><select className={inputCls} value={form.production_mode} onChange={(e) => setForm({ ...form, production_mode: e.target.value })}><option value="interne_smm">Interne SMM</option><option value="graphiste">Graphiste</option><option value="monteur">Monteur vidéo</option><option value="createur_externe">Créateur externe</option></select></Field>
          <Field label="Publication prévue"><input type="datetime-local" className={inputCls} value={form.scheduled_publish_at} onChange={(e) => setForm({ ...form, scheduled_publish_at: e.target.value })} /></Field>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" checked={form.is_sensitive} onChange={(e) => setForm({ ...form, is_sensitive: e.target.checked })} />
            <span className="text-sm font-bold">Contenu sensible</span>
          </div>
          {form.is_sensitive && (
            <div className="col-span-2"><Field label="Motif de sensibilité"><select className={inputCls} value={form.sensitivity_reason} onChange={(e) => setForm({ ...form, sensitivity_reason: e.target.value })}><option value="">—</option><option value="allegation_produit">Allégation produit</option><option value="reglementation">Réglementation</option><option value="sujet_polemique">Sujet polémique</option><option value="offre_commerciale">Offre commerciale</option></select></Field></div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={create} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>

      {selected && <ContentDetailModal content={selected} onClose={() => setSelected(null)} onReload={onReload} />}
    </div>
  );
}

function ContentDetailModal({ content, onClose, onReload }: { content: R; onClose: () => void; onReload: () => void }) {
  const toast = useToast();
  const [full, setFull] = useState<R | null>(null);
  const [tab, setTab] = useState<'brief' | 'versions' | 'qc' | 'slip'>('brief');
  const [brief, setBrief] = useState<R>({});
  const [slip, setSlip] = useState<R>({});
  const [qcItems, setQcItems] = useState<R[]>([
    { key: 'brand_check', label: 'Cohérence marque', checked: false },
    { key: 'copy_check', label: 'Copy relu', checked: false },
    { key: 'legal_check', label: 'Mentions légales OK', checked: false },
    { key: 'visual_check', label: 'Visuel conforme', checked: false },
    { key: 'cta_check', label: 'Call-to-action clair', checked: false },
  ]);

  useEffect(() => {
    (async () => {
      const r = await api.get<R>(`smm/contents/${content.id}`);
      if (r.ok) {
        setFull(r.data);
        setBrief(r.data.brief ?? {});
        setSlip(r.data.publication_slip ?? {});
        if (r.data.qc_checklist?.items_json) setQcItems(r.data.qc_checklist.items_json);
      }
    })();
  }, [content.id]);

  const saveBrief = async () => {
    const r = await api.put(`smm/contents/${content.id}/brief`, brief);
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Brief sauvegardé.');
  };

  const markBriefed = async () => {
    const r = await api.post(`smm/contents/${content.id}/mark-briefed`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Passé à Briefé.'); onReload(); onClose();
  };

  const uploadVersion = async () => {
    const url = prompt('URL du fichier de la version produite ?'); if (!url) return;
    const r = await api.post(`smm/contents/${content.id}/versions`, { file_url: url });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Version déposée.'); onReload();
  };

  const runQc = async () => {
    const r = await api.put(`smm/contents/${content.id}/qc`, { items_json: qcItems });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('QC enregistrée.');
  };

  const validate = async () => {
    const r = await api.post(`smm/contents/${content.id}/validate`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success(r.data?.message ?? 'Validé.'); onReload(); onClose();
  };

  const directionValidate = async () => {
    const r = await api.post(`smm/contents/${content.id}/direction-validate`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Validation Direction.'); onReload(); onClose();
  };

  const saveSlip = async () => {
    if (!slip.platform) slip.platform = content.platform;
    if (!slip.publish_at) slip.publish_at = content.scheduled_publish_at;
    const r = await api.put(`smm/contents/${content.id}/slip`, slip);
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Fiche sauvegardée.');
  };

  const transmit = async () => {
    const r = await api.post(`smm/contents/${content.id}/transmit`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Transmis au CM.'); onReload(); onClose();
  };

  const setPublished = async () => {
    const r = await api.post(`smm/contents/${content.id}/set-published`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Marqué publié.'); onReload(); onClose();
  };

  const cancel = async () => {
    const reason = prompt('Motif d\'annulation ?'); if (!reason) return;
    const r = await api.post(`smm/contents/${content.id}/cancel`, { cancellation_reason: reason });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Annulé.'); onReload(); onClose();
  };

  return (
    <Modal open onClose={onClose} title={content.title} maxW="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge label={CONTENT_STATUSES[content.status]?.label ?? content.status} cls={CONTENT_STATUSES[content.status]?.cls ?? 'bg-zinc-100'} />
          <div className="flex flex-wrap gap-2">
            {content.status === 'a_briefer' && <button onClick={markBriefed} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-black">Marquer briefé</button>}
            {(content.status === 'briefe' || content.status === 'en_production') && <button onClick={uploadVersion} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-black">Déposer version</button>}
            {content.status === 'en_revision' && <button onClick={validate} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Valider</button>}
            {content.status === 'a_valider_direction' && <button onClick={directionValidate} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Valider (Direction)</button>}
            {content.status === 'valide' && <button onClick={transmit} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-black">Transmettre au CM</button>}
            {content.status === 'transmis_cm' && <button onClick={setPublished} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Marquer publié</button>}
            {!['publie', 'annule'].includes(content.status) && <button onClick={cancel} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black">Annuler</button>}
          </div>
        </div>

        <div className="flex gap-2 border-b border-zinc-200">
          {(['brief', 'versions', 'qc', 'slip'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-black border-b-2 ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-zinc-500'}`}>
              {t === 'brief' ? 'Brief' : t === 'versions' ? 'Versions & révisions' : t === 'qc' ? 'Contrôle qualité' : 'Fiche publication'}
            </button>
          ))}
        </div>

        {tab === 'brief' && (
          <div className="space-y-3">
            <Field label="Concept & intention"><textarea rows={2} className={inputCls} value={brief.concept_intention ?? ''} onChange={(e) => setBrief({ ...brief, concept_intention: e.target.value })} /></Field>
            <Field label="Objectif & résultat attendu"><textarea rows={2} className={inputCls} value={brief.objective_result ?? ''} onChange={(e) => setBrief({ ...brief, objective_result: e.target.value })} /></Field>
            <Field label="Copy / texte"><textarea rows={2} className={inputCls} value={brief.copy_text ?? ''} onChange={(e) => setBrief({ ...brief, copy_text: e.target.value })} /></Field>
            <Field label="Script (monteur)"><textarea rows={2} className={inputCls} value={brief.script ?? ''} onChange={(e) => setBrief({ ...brief, script: e.target.value })} /></Field>
            <Field label="Structure attendue"><textarea rows={2} className={inputCls} value={brief.expected_structure ?? ''} onChange={(e) => setBrief({ ...brief, expected_structure: e.target.value })} /></Field>
            <Field label="Direction visuelle"><textarea rows={2} className={inputCls} value={brief.visual_direction ?? ''} onChange={(e) => setBrief({ ...brief, visual_direction: e.target.value })} /></Field>
            <Field label="Structure de montage"><textarea rows={2} className={inputCls} value={brief.editing_structure ?? ''} onChange={(e) => setBrief({ ...brief, editing_structure: e.target.value })} /></Field>
            <Field label="Matière première fournie"><textarea rows={2} className={inputCls} value={brief.raw_material ?? ''} onChange={(e) => setBrief({ ...brief, raw_material: e.target.value })} /></Field>
            <Field label="Instructions techniques"><textarea rows={2} className={inputCls} value={brief.technical_instructions ?? ''} onChange={(e) => setBrief({ ...brief, technical_instructions: e.target.value })} /></Field>
            <Field label="Informations obligatoires"><textarea rows={2} className={inputCls} value={brief.mandatory_info ?? ''} onChange={(e) => setBrief({ ...brief, mandatory_info: e.target.value })} /></Field>
            <Field label="Call-to-action"><input className={inputCls} value={brief.call_to_action ?? ''} onChange={(e) => setBrief({ ...brief, call_to_action: e.target.value })} /></Field>
            <button onClick={saveBrief} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Sauvegarder brief</button>
          </div>
        )}

        {tab === 'versions' && (
          <div className="space-y-3">
            <button onClick={uploadVersion} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold">+ Déposer une version</button>
            <div className="space-y-2">
              {(full?.versions ?? []).map((v: R) => (
                <div key={v.id} className="border border-zinc-100 rounded-lg p-3 text-sm">
                  <p className="font-bold">v{v.version_number} — {v.uploaded_by?.name ?? '—'}</p>
                  <a href={v.file_url} target="_blank" rel="noreferrer" className="text-primary-600 text-xs">{v.file_url}</a>
                </div>
              ))}
            </div>
            <h4 className="text-sm font-black text-zinc-900 mt-4">Retours de révision</h4>
            <div className="space-y-2">
              {(full?.revisions ?? []).map((r: R) => (
                <div key={r.id} className="border border-zinc-100 rounded-lg p-3 text-sm">
                  <p className="text-xs text-zinc-500">{r.author?.name ?? '—'} · {new Date(r.created_at).toLocaleString('fr-FR')}</p>
                  <p className="mt-1">{r.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'qc' && (
          <div className="space-y-3">
            {qcItems.map((it, idx) => (
              <label key={it.key} className="flex items-center gap-2">
                <input type="checkbox" checked={!!it.checked} onChange={(e) => { const next = [...qcItems]; next[idx] = { ...it, checked: e.target.checked }; setQcItems(next); }} />
                <span className="text-sm">{it.label}</span>
              </label>
            ))}
            <button onClick={runQc} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Sauvegarder QC</button>
          </div>
        )}

        {tab === 'slip' && (
          <div className="space-y-3">
            <Field label="Plateforme"><select className={inputCls} value={slip.platform ?? content.platform} onChange={(e) => setSlip({ ...slip, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
            <Field label="Date & heure de publication"><input type="datetime-local" className={inputCls} value={slip.publish_at ? String(slip.publish_at).slice(0, 16) : ''} onChange={(e) => setSlip({ ...slip, publish_at: e.target.value })} /></Field>
            <Field label="Légende"><textarea rows={3} className={inputCls} value={slip.caption ?? ''} onChange={(e) => setSlip({ ...slip, caption: e.target.value })} /></Field>
            <Field label="Call-to-action"><input className={inputCls} value={slip.call_to_action ?? ''} onChange={(e) => setSlip({ ...slip, call_to_action: e.target.value })} /></Field>
            <Field label="Hashtags"><input className={inputCls} value={slip.hashtags ?? ''} onChange={(e) => setSlip({ ...slip, hashtags: e.target.value })} /></Field>
            <Field label="Instructions Story"><textarea rows={2} className={inputCls} value={slip.story_instructions ?? ''} onChange={(e) => setSlip({ ...slip, story_instructions: e.target.value })} /></Field>
            <Field label="Instructions spécifiques"><textarea rows={2} className={inputCls} value={slip.specific_instructions ?? ''} onChange={(e) => setSlip({ ...slip, specific_instructions: e.target.value })} /></Field>
            <Field label="Sujets sensibles à surveiller"><textarea rows={2} className={inputCls} value={slip.sensitive_topics_watch ?? ''} onChange={(e) => setSlip({ ...slip, sensitive_topics_watch: e.target.value })} /></Field>
            <button onClick={saveSlip} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Sauvegarder fiche</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ─── VALIDATION QUEUE ─── */
function ValidationTab({ strategies, plans, contents, onReload }: any) {
  const toast = useToast();
  const pending = [
    ...strategies.filter((s: R) => s.status === 'soumise').map((s: R) => ({ type: 'Stratégie', id: s.id, label: `T${s.quarter} ${s.year}`, endpoint: 'smm/strategies', row: s })),
    ...plans.filter((p: R) => p.status === 'soumis').map((p: R) => ({ type: 'Plan mensuel', id: p.id, label: `${MONTHS_FR[p.month - 1]} ${p.year}`, endpoint: 'smm/plans', row: p })),
    ...contents.filter((c: R) => c.status === 'a_valider_direction').map((c: R) => ({ type: 'Contenu sensible', id: c.id, label: c.title, endpoint: 'smm/contents', special: 'direction-validate', row: c })),
  ];

  const doAction = async (endpoint: string, id: number, action: string) => {
    const r = await api.post(`${endpoint}/${id}/${action}`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Action effectuée.'); onReload();
  };

  const doReject = async (endpoint: string, id: number, action: string) => {
    const reason = prompt('Motif ?'); if (!reason) return;
    const r = await api.post(`${endpoint}/${id}/${action}`, { rejection_reason: reason });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Rejeté.'); onReload();
  };

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <EmptyState title="File de validation vide" description="Aucun objet en attente de validation." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Objet</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={`${p.type}-${p.id}`} className="border-b border-zinc-50">
                  <td className="px-4 py-3 text-xs uppercase font-bold text-zinc-600">{p.type}</td>
                  <td className="px-4 py-3 text-sm font-bold text-zinc-900">{p.label}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => doAction(p.endpoint, p.id, p.special ?? 'validate')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Valider</button>
                      {!p.special && <button onClick={() => doReject(p.endpoint, p.id, 'reject')} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black">Rejeter</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── EVENTS ─── */
function EventsTab({ events, onReload }: { events: R[]; onReload: () => void }) {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ label: '', event_type: 'previsible', amplitude: '', start_date: '', end_date: '', anticipation_days: '', has_commercial_offer: false });

  const create = async () => {
    if (!form.label.trim() || !form.start_date || !form.end_date) { toast.error('Champs requis manquants.'); return; }
    const r = await api.post('smm/events', {
      label: form.label, event_type: form.event_type,
      amplitude: form.amplitude || undefined,
      start_date: form.start_date, end_date: form.end_date,
      anticipation_days: form.anticipation_days ? Number(form.anticipation_days) : undefined,
      has_commercial_offer: form.has_commercial_offer,
    });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Événement créé.'); setShowCreate(false); onReload();
  };

  const submitRetro = async (id: number) => {
    const r = await api.post(`smm/events/${id}/submit-retroplanning`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Rétroplanning soumis.'); onReload();
  };

  const validateRetro = async (id: number) => {
    const r = await api.post(`smm/events/${id}/validate-retroplanning`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Validé.'); onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvel événement
        </button>
      </div>

      {events.length === 0 ? (
        <EmptyState title="Aucun événement" description="Ajoutez un événement prévisible ou temps réel." />
      ) : (
        <div className="grid gap-3">
          {events.map((e) => (
            <div key={e.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-zinc-900">{e.label}</h3>
                    <Badge label={e.event_type} cls={e.event_type === 'temps_reel' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'} />
                    <Badge label={e.status} cls="bg-zinc-100 text-zinc-600" />
                    {e.has_commercial_offer && <Badge label="Offre commerciale" cls="bg-orange-50 text-orange-700" />}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{e.start_date} → {e.end_date} · {e.contents_count ?? 0} contenus</p>
                </div>
                <div className="flex gap-2">
                  {e.status === 'planifie' && <button onClick={() => submitRetro(e.id)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-black">Soumettre rétroplanning</button>}
                  {e.status === 'retroplanning_a_valider' && <button onClick={() => validateRetro(e.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Valider rétro.</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel événement">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Libellé *"><input className={inputCls} value={form.label} onChange={(ev) => setForm({ ...form, label: ev.target.value })} /></Field></div>
          <Field label="Type"><select className={inputCls} value={form.event_type} onChange={(ev) => setForm({ ...form, event_type: ev.target.value })}><option value="previsible">Prévisible</option><option value="temps_reel">Temps réel</option></select></Field>
          <Field label="Ampleur"><select className={inputCls} value={form.amplitude} onChange={(ev) => setForm({ ...form, amplitude: ev.target.value })}><option value="">—</option><option value="petit">Petit</option><option value="moyen">Moyen</option><option value="grand">Grand</option><option value="majeur">Majeur</option></select></Field>
          <Field label="Début *"><input type="date" className={inputCls} value={form.start_date} onChange={(ev) => setForm({ ...form, start_date: ev.target.value })} /></Field>
          <Field label="Fin *"><input type="date" className={inputCls} value={form.end_date} onChange={(ev) => setForm({ ...form, end_date: ev.target.value })} /></Field>
          <Field label="Délai d'anticipation (jours)"><input type="number" className={inputCls} value={form.anticipation_days} onChange={(ev) => setForm({ ...form, anticipation_days: ev.target.value })} /></Field>
          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" checked={form.has_commercial_offer} onChange={(ev) => setForm({ ...form, has_commercial_offer: ev.target.checked })} />
            <span className="text-sm font-bold">Offre commerciale liée</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={create} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── AUTOMATIONS ─── */
function AutomationsTab({ automations, onReload }: { automations: R[]; onReload: () => void }) {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ label: '', objective: 'lead', platform: 'instagram', trigger_type: 'keyword', trigger_config: '', call_to_action_links: '' });

  const create = async () => {
    if (!form.label.trim()) { toast.error('Libellé requis.'); return; }
    const r = await api.post('smm/automations', form);
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Créée.'); setShowCreate(false); onReload();
  };

  const recordTest = async (id: number) => {
    const notes = prompt('Notes du test ?') ?? '';
    const r = await api.post(`smm/automations/${id}/record-test`, { test_notes: notes });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Test enregistré.'); onReload();
  };

  const activate = async (id: number) => {
    const r = await api.post(`smm/automations/${id}/activate`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Activée.'); onReload();
  };

  const suspend = async (id: number) => {
    const reason = prompt('Motif de suspension ?'); if (!reason) return;
    const r = await api.post(`smm/automations/${id}/suspend`, { suspension_reason: reason });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Suspendue.'); onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle automatisation
        </button>
      </div>

      {automations.length === 0 ? (
        <EmptyState title="Aucune automatisation" description="Créez votre première automatisation sociale." />
      ) : (
        <div className="grid gap-3">
          {automations.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-zinc-900">{a.label}</h3>
                    <Badge label={a.status} cls={a.status === 'active' ? 'bg-emerald-50 text-emerald-700' : a.status === 'suspendue' ? 'bg-red-50 text-red-700' : 'bg-zinc-100'} />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{a.platform} · {a.trigger_type} · objectif: {a.objective ?? '—'}</p>
                  {a.test_recorded && <p className="text-[10px] text-emerald-600 mt-1">✓ Test enregistré</p>}
                </div>
                <div className="flex gap-2">
                  {a.status === 'brouillon' && <button onClick={() => recordTest(a.id)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-black">Enregistrer test</button>}
                  {a.status === 'en_test' && <button onClick={() => activate(a.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black inline-flex items-center gap-1"><Play className="w-3 h-3" /> Activer</button>}
                  {a.status === 'active' && <button onClick={() => suspend(a.id)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black inline-flex items-center gap-1"><Pause className="w-3 h-3" /> Suspendre</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle automatisation">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Field label="Libellé *"><input className={inputCls} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field></div>
          <Field label="Objectif"><select className={inputCls} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}><option value="lead">Lead</option><option value="information">Information</option><option value="ressource">Ressource</option><option value="nurturing">Nurturing</option></select></Field>
          <Field label="Plateforme"><select className={inputCls} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Déclencheur"><select className={inputCls} value={form.trigger_type} onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}><option value="keyword">Mot-clé</option><option value="comment">Commentaire</option><option value="new_follow">Nouveau follow</option><option value="story_interaction">Interaction Story</option></select></Field>
          <Field label="Config du déclencheur"><input className={inputCls} value={form.trigger_config} onChange={(e) => setForm({ ...form, trigger_config: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="CTA & liens"><textarea rows={2} className={inputCls} value={form.call_to_action_links} onChange={(e) => setForm({ ...form, call_to_action_links: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={create} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── VEILLE ─── */
function VeilleTab({ notes, onReload }: { notes: R[]; onReload: () => void }) {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ week_start_date: '', platform_behavior_changes: '' });
  const [trendOpen, setTrendOpen] = useState<{ noteId: number } | null>(null);
  const [trendForm, setTrendForm] = useState({
    label: '', platform: 'instagram', decision: 'retenue' as 'retenue' | 'ecartee', reason: '',
    filter_brand_relevance: false, filter_audience_relevance: false, filter_positioning_coherence: false, filter_execution_effort_ok: false,
  });

  const create = async () => {
    if (!form.week_start_date) { toast.error('Semaine requise.'); return; }
    const r = await api.post('smm/veille/notes', { week_start_date: form.week_start_date, platform_behavior_changes: form.platform_behavior_changes || undefined });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Note créée.'); setShowCreate(false); onReload();
  };

  const addTrend = async () => {
    if (!trendOpen) return;
    if (!trendForm.reason.trim()) { toast.error('Motif requis.'); return; }
    const r = await api.post(`smm/veille/notes/${trendOpen.noteId}/trends`, trendForm);
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Tendance enregistrée.'); setTrendOpen(null); onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nouvelle note
        </button>
      </div>

      {notes.length === 0 ? (
        <EmptyState title="Aucune note de veille" description="Créez votre première note hebdomadaire." />
      ) : (
        <div className="grid gap-3">
          {notes.map((n) => (
            <div key={n.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black text-zinc-900">Semaine du {new Date(n.week_start_date).toLocaleDateString('fr-FR')}</h3>
                <button onClick={() => setTrendOpen({ noteId: n.id })} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold">+ Tendance</button>
              </div>
              {n.platform_behavior_changes && <p className="text-xs text-zinc-600 mb-2">{n.platform_behavior_changes}</p>}
              <div className="space-y-1">
                {(n.trends ?? []).map((t: R) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <Badge label={t.decision} cls={t.decision === 'retenue' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'} />
                    <span className="font-bold">{t.label}</span>
                    <span className="text-xs text-zinc-500">({t.platform})</span>
                    <span className="text-xs text-zinc-500">— {t.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle note de veille">
        <div className="grid gap-3">
          <Field label="Semaine (lundi)"><input type="date" className={inputCls} value={form.week_start_date} onChange={(e) => setForm({ ...form, week_start_date: e.target.value })} /></Field>
          <Field label="Changements de comportement observés"><textarea rows={3} className={inputCls} value={form.platform_behavior_changes} onChange={(e) => setForm({ ...form, platform_behavior_changes: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={create} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>

      <Modal open={!!trendOpen} onClose={() => setTrendOpen(null)} title="Nouvelle tendance">
        <div className="grid gap-3">
          <Field label="Libellé *"><input className={inputCls} value={trendForm.label} onChange={(e) => setTrendForm({ ...trendForm, label: e.target.value })} /></Field>
          <Field label="Plateforme"><select className={inputCls} value={trendForm.platform} onChange={(e) => setTrendForm({ ...trendForm, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
          <Field label="Décision"><select className={inputCls} value={trendForm.decision} onChange={(e) => setTrendForm({ ...trendForm, decision: e.target.value as any })}><option value="retenue">Retenue</option><option value="ecartee">Écartée</option></select></Field>
          <Field label="Motif obligatoire *"><textarea rows={2} className={inputCls} value={trendForm.reason} onChange={(e) => setTrendForm({ ...trendForm, reason: e.target.value })} /></Field>
          {trendForm.decision === 'retenue' && (
            <div className="space-y-2 border border-zinc-200 rounded-xl p-3">
              <p className="text-xs font-black text-zinc-600 uppercase">Filtres de pertinence (tous obligatoires)</p>
              {[
                ['filter_brand_relevance', 'Pertinence marque'],
                ['filter_audience_relevance', 'Pertinence audience'],
                ['filter_positioning_coherence', 'Cohérence de positionnement'],
                ['filter_execution_effort_ok', 'Effort d\'exécution acceptable'],
              ].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={(trendForm as any)[k]} onChange={(e) => setTrendForm({ ...trendForm, [k]: e.target.checked } as any)} />
                  {l}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setTrendOpen(null)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={addTrend} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── PERFORMANCE ─── */
function PerformanceTab({ performances, contents, onReload }: { performances: R[]; contents: R[]; onReload?: () => void }) {
  const toast = useToast();
  const contentMap = new Map(contents.map((c) => [c.id, c]));
  const [syncing, setSyncing] = useState(false);

  const syncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await api.post<R>('smm/performance/sync-all', { stale_minutes: 0, limit: 100 });
      if (!r.ok) { toast.error(r.message); return; }
      toast.success('Synchronisation Meta lancée.');
      onReload?.();
    } finally { setSyncing(false); }
  };

  const syncOne = async (contentId: number) => {
    const r = await api.post<R>(`smm/performance/sync-content/${contentId}`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Synchronisé.');
    onReload?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={syncAll}
          disabled={syncing}
          className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2 disabled:opacity-60"
        >
          <BarChart3 className="w-4 h-4" /> {syncing ? 'Synchronisation…' : 'Synchroniser depuis Meta'}
        </button>
      </div>
      {performances.length === 0 ? (
        <EmptyState title="Aucune donnée de performance" description="Les données sont récupérées automatiquement depuis Meta et TikTok. Configurez les identifiants Meta dans Paramètres → Meta puis cliquez sur « Synchroniser depuis Meta »." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Contenu</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Plateforme</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Reach</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Vues</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Engagement %</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Commentaires</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Partages</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400">Clics</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Dernière sync</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400"></th>
              </tr>
            </thead>
            <tbody>
              {performances.map((p) => (
                <tr key={p.id} className={`border-b border-zinc-50 ${p.sync_failed ? 'bg-red-50/40' : ''}`}>
                  <td className="px-4 py-3 text-sm font-bold text-zinc-900">{p.content?.title ?? contentMap.get(p.content_id)?.title ?? `#${p.content_id}`}</td>
                  <td className="px-4 py-3 text-xs uppercase text-zinc-600">{p.platform}</td>
                  <td className="px-4 py-3 text-sm text-right">{Number(p.reach).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right">{Number(p.views).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold">{Number(p.engagement_rate).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-sm text-right">{Number(p.comments_count).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right">{Number(p.shares).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right">{Number(p.clicks).toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {p.last_synced_at ? new Date(p.last_synced_at).toLocaleString('fr-FR') : '—'}
                    {p.sync_failed && <div className="text-red-600 mt-0.5" title={p.sync_error}>⚠ {p.sync_error?.slice(0, 40) ?? 'Échec'}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {['instagram', 'facebook'].includes(p.platform) && (
                      <button onClick={() => syncOne(p.content_id)} className="text-xs font-bold text-primary-600 hover:underline">Sync</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── SUPERVISION CM ─── */
function SupervisionTab({ checks, contents, onReload }: { checks: R[]; contents: R[]; onReload: () => void }) {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ content_id: '', check_date: new Date().toISOString().slice(0, 10), status: 'conforme', deviation_description: '', has_public_impact: false });

  const create = async () => {
    const r = await api.post('smm/execution-checks', {
      content_id: form.content_id ? Number(form.content_id) : undefined,
      check_date: form.check_date, status: form.status,
      deviation_description: form.deviation_description || undefined,
      has_public_impact: form.has_public_impact,
    });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Contrôle enregistré.'); setShowCreate(false); onReload();
  };

  const escalate = async (id: number) => {
    if (!confirm('Escalader à la Direction (dépublication immédiate) ?')) return;
    const r = await api.post(`smm/execution-checks/${id}/escalate`, { unpublish: true });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Escaladé.'); onReload();
  };

  const correct = async (id: number) => {
    const note = prompt('Note de correction ?'); if (!note) return;
    const r = await api.post(`smm/execution-checks/${id}/correct`, { correction_note: note });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Écart corrigé.'); onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Contrôle du jour
        </button>
      </div>

      {checks.length === 0 ? (
        <EmptyState title="Aucun contrôle" description="Enregistrez un contrôle quotidien d'exécution." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Contenu</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Impact public</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</th>
                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-zinc-400"></th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id} className="border-b border-zinc-50">
                  <td className="px-4 py-3 text-sm text-zinc-700">{new Date(c.check_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm font-bold">{c.content?.title ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge label={c.status} cls={c.status === 'conforme' ? 'bg-emerald-50 text-emerald-700' : c.status === 'ecart_constate' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'} />
                  </td>
                  <td className="px-4 py-3 text-sm">{c.has_public_impact ? <span className="text-red-600 font-black">⚠ Oui</span> : '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600 max-w-xs truncate">{c.deviation_description ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {c.status === 'ecart_constate' && (
                      <div className="inline-flex gap-1">
                        <button onClick={() => correct(c.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Corriger</button>
                        <button onClick={() => escalate(c.id)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black">Escalader</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouveau contrôle d'exécution">
        <div className="grid gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={form.check_date} onChange={(e) => setForm({ ...form, check_date: e.target.value })} /></Field>
          <Field label="Contenu (optionnel)">
            <select className={inputCls} value={form.content_id} onChange={(e) => setForm({ ...form, content_id: e.target.value })}>
              <option value="">— aucun / global —</option>
              {contents.filter((c) => c.status === 'publie').map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>
          <Field label="Statut"><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="conforme">Conforme</option><option value="ecart_constate">Écart constaté</option></select></Field>
          {form.status === 'ecart_constate' && (
            <>
              <Field label="Description"><textarea rows={3} className={inputCls} value={form.deviation_description} onChange={(e) => setForm({ ...form, deviation_description: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={form.has_public_impact} onChange={(e) => setForm({ ...form, has_public_impact: e.target.checked })} /> Impact public</label>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={create} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Enregistrer</button>
        </div>
      </Modal>
    </div>
  );
}

/* ─── LIBRARY (learnings + reports + insights) ─── */
function LibraryTab({ learnings, reports, insights, onReload }: { learnings: R[]; reports: R[]; insights: R[]; onReload: () => void }) {
  const toast = useToast();
  const [sub, setSub] = useState<'learnings' | 'reports' | 'insights'>('learnings');

  const [lOpen, setLOpen] = useState(false);
  const [lForm, setLForm] = useState({ period: '', dimension: 'format', finding: '', recommendation: '', justifying_data: '' });

  const [rOpen, setROpen] = useState(false);
  const [rForm, setRForm] = useState({ year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1), performance_summary: '', patterns_identified: '', next_month_action_plan: '' });

  const [iOpen, setIOpen] = useState(false);
  const [iForm, setIForm] = useState({ source: 'call_center', insight_type: 'objection', verbatim: '' });

  const saveLearning = async () => {
    if (!lForm.finding.trim() || !lForm.recommendation.trim()) { toast.error('Constat et reco requis.'); return; }
    const r = await api.post('smm/learnings', lForm);
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Enregistré.'); setLOpen(false); onReload();
  };
  const markCommunicated = async (id: number) => {
    const r = await api.post(`smm/learnings/${id}/mark-communicated`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Communiqué.'); onReload();
  };
  const saveReport = async () => {
    const r = await api.post('smm/reports', { ...rForm, year: Number(rForm.year), month: Number(rForm.month), decision_grid_json: { keep: [], stop: [], improve: [], test: [], scale: [] } });
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Rapport créé.'); setROpen(false); onReload();
  };
  const diffuseReport = async (id: number) => {
    const r = await api.post(`smm/reports/${id}/diffuse`, {});
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Diffusé.'); onReload();
  };
  const saveInsight = async () => {
    if (!iForm.verbatim.trim()) { toast.error('Verbatim requis.'); return; }
    const r = await api.post('smm/insights', iForm);
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Insight enregistré.'); setIOpen(false); onReload();
  };
  const qualifyInsight = async (id: number, status: 'exploite' | 'ecarte') => {
    let payload: any = { status };
    if (status === 'ecarte') {
      const reason = prompt('Motif ?'); if (!reason) return;
      payload.exclusion_reason = reason;
    }
    const r = await api.post(`smm/insights/${id}/qualify`, payload);
    if (!r.ok) { toast.error(r.message); return; }
    toast.success('Qualifié.'); onReload();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-zinc-200">
        {[
          ['learnings', 'Enseignements'],
          ['reports', 'Rapports mensuels'],
          ['insights', 'Insights client'],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setSub(k as any)} className={`px-4 py-2 text-sm font-black border-b-2 ${sub === k ? 'border-primary-600 text-primary-600' : 'border-transparent text-zinc-500'}`}>{l}</button>
        ))}
      </div>

      {sub === 'learnings' && (
        <>
          <div className="flex justify-end"><button onClick={() => setLOpen(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Enseignement</button></div>
          {learnings.length === 0 ? <EmptyState title="Aucun enseignement" description="—" /> : (
            <div className="grid gap-3">
              {learnings.map((l) => (
                <div key={l.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-black uppercase text-zinc-400">{l.dimension} · {l.period}</p>
                      <p className="text-sm font-bold mt-1">{l.finding}</p>
                      <p className="text-sm text-zinc-600 mt-1"><b>Reco:</b> {l.recommendation}</p>
                      {l.communicated_at && <p className="text-[10px] text-emerald-600 mt-1">✓ Communiqué le {new Date(l.communicated_at).toLocaleDateString('fr-FR')}</p>}
                    </div>
                    {!l.communicated_at && <button onClick={() => markCommunicated(l.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Marquer communiqué</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sub === 'reports' && (
        <>
          <div className="flex justify-end"><button onClick={() => setROpen(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Rapport</button></div>
          {reports.length === 0 ? <EmptyState title="Aucun rapport" description="—" /> : (
            <div className="grid gap-3">
              {reports.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black">{MONTHS_FR[r.month - 1]} {r.year}</h3>
                      <Badge label={r.status} cls={r.status === 'diffuse' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'} />
                    </div>
                    {r.status !== 'diffuse' && <button onClick={() => diffuseReport(r.id)} className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-black">Diffuser</button>}
                  </div>
                  {r.performance_summary && <p className="text-sm text-zinc-700 mt-2">{r.performance_summary}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sub === 'insights' && (
        <>
          <div className="flex justify-end"><button onClick={() => setIOpen(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Insight</button></div>
          {insights.length === 0 ? <EmptyState title="Aucun insight" description="—" /> : (
            <div className="grid gap-3">
              {insights.map((i) => (
                <div key={i.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex gap-2 items-center">
                        <Badge label={i.source} cls="bg-blue-50 text-blue-700" />
                        <Badge label={i.insight_type} cls="bg-violet-50 text-violet-700" />
                        <Badge label={i.status} cls={i.status === 'exploite' ? 'bg-emerald-50 text-emerald-700' : i.status === 'ecarte' ? 'bg-red-50 text-red-700' : 'bg-zinc-100'} />
                        <span className="text-xs text-zinc-500">×{i.observed_frequency}</span>
                      </div>
                      <p className="text-sm mt-2">"{i.verbatim}"</p>
                    </div>
                    {i.status === 'nouveau' && (
                      <div className="flex gap-1">
                        <button onClick={() => qualifyInsight(i.id, 'exploite')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">Exploiter</button>
                        <button onClick={() => qualifyInsight(i.id, 'ecarte')} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-black">Écarter</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={lOpen} onClose={() => setLOpen(false)} title="Nouvel enseignement">
        <div className="grid gap-3">
          <Field label="Période"><input placeholder="2026-08" className={inputCls} value={lForm.period} onChange={(e) => setLForm({ ...lForm, period: e.target.value })} /></Field>
          <Field label="Dimension"><select className={inputCls} value={lForm.dimension} onChange={(e) => setLForm({ ...lForm, dimension: e.target.value })}><option value="format">Format</option><option value="hook">Hook</option><option value="pilier">Pilier</option><option value="finalite">Finalité</option><option value="plateforme">Plateforme</option><option value="angle">Angle</option></select></Field>
          <Field label="Constat *"><textarea rows={3} className={inputCls} value={lForm.finding} onChange={(e) => setLForm({ ...lForm, finding: e.target.value })} /></Field>
          <Field label="Recommandation actionnable *"><textarea rows={3} className={inputCls} value={lForm.recommendation} onChange={(e) => setLForm({ ...lForm, recommendation: e.target.value })} /></Field>
          <Field label="Données justificatives"><textarea rows={2} className={inputCls} value={lForm.justifying_data} onChange={(e) => setLForm({ ...lForm, justifying_data: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setLOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={saveLearning} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>

      <Modal open={rOpen} onClose={() => setROpen(false)} title="Nouveau rapport mensuel">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Année"><input type="number" className={inputCls} value={rForm.year} onChange={(e) => setRForm({ ...rForm, year: e.target.value })} /></Field>
          <Field label="Mois"><select className={inputCls} value={rForm.month} onChange={(e) => setRForm({ ...rForm, month: e.target.value })}>{MONTHS_FR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></Field>
          <div className="col-span-2"><Field label="Synthèse de performance"><textarea rows={3} className={inputCls} value={rForm.performance_summary} onChange={(e) => setRForm({ ...rForm, performance_summary: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Patterns identifiés"><textarea rows={3} className={inputCls} value={rForm.patterns_identified} onChange={(e) => setRForm({ ...rForm, patterns_identified: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Plan d'action mois suivant"><textarea rows={3} className={inputCls} value={rForm.next_month_action_plan} onChange={(e) => setRForm({ ...rForm, next_month_action_plan: e.target.value })} /></Field></div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setROpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={saveReport} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>

      <Modal open={iOpen} onClose={() => setIOpen(false)} title="Nouvel insight client">
        <div className="grid gap-3">
          <Field label="Source"><select className={inputCls} value={iForm.source} onChange={(e) => setIForm({ ...iForm, source: e.target.value })}><option value="call_center">Call Center</option><option value="community_manager">Community Manager</option><option value="reclamation">Réclamation</option></select></Field>
          <Field label="Type"><select className={inputCls} value={iForm.insight_type} onChange={(e) => setIForm({ ...iForm, insight_type: e.target.value })}><option value="objection">Objection</option><option value="question">Question fréquente</option><option value="plainte">Plainte</option><option value="verbatim">Verbatim</option><option value="motif_refus">Motif de refus</option><option value="temoignage">Témoignage</option></select></Field>
          <Field label="Verbatim *"><textarea rows={4} className={inputCls} value={iForm.verbatim} onChange={(e) => setIForm({ ...iForm, verbatim: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setIOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={saveInsight} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer</button>
        </div>
      </Modal>
    </div>
  );
}
