import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Beaker,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  List,
  Plus,
  RefreshCw,
  Trash2,
  Zap,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusChip } from '../components/ui/StatusChip';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

/* ── Types ── */

type TriggerKey = 'attendance.marked' | 'order.status_changed';
type Op = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';

type AutomationRule = {
  id: number;
  name: string;
  trigger_key: TriggerKey;
  description: string | null;
  condition_json: Record<string, unknown> | null;
  action_json: Record<string, unknown>;
  is_active: boolean;
};

type AutomationRun = {
  id: number;
  status: 'executed' | 'skipped' | 'failed';
  result_message: string | null;
  trigger_key: string;
  created_at: string;
  rule?: { id: number; name: string } | null;
};

type ConditionRow = { field: string; op: Op; value: string };
type VariantRow = { label: string; message: string; weight: number };
type ActionStep = { type: string; target: string; message: string; variants: VariantRow[]; useAB: boolean };

/* ── Trigger config ── */

type TriggerField = { value: string; label: string; type: 'string' | 'number' | 'boolean'; options?: { value: string; label: string }[] };
type TriggerConfig = {
  value: TriggerKey;
  label: string;
  icon: React.ReactNode;
  fields: TriggerField[];
  actionTypes: { value: string; label: string }[];
  actionTargets: { value: string; label: string }[];
  sampleEvent: Record<string, unknown>;
};

const OP_LABELS: Record<Op, string> = {
  eq: 'est égal à', neq: 'est différent de', gt: 'supérieur à', gte: 'supérieur ou égal à',
  lt: 'inférieur à', lte: 'inférieur ou égal à', in: 'est dans', contains: 'contient',
};

const TRIGGERS: TriggerConfig[] = [
  {
    value: 'attendance.marked',
    label: 'Retard / présence employé',
    icon: <AlertTriangle className="w-4 h-4" />,
    fields: [
      { value: 'event.status', label: 'Statut présence', type: 'string', options: [
        { value: 'present', label: 'Présent' }, { value: 'late', label: 'En retard' },
        { value: 'absent', label: 'Absent' }, { value: 'justified', label: 'Justifié' },
      ]},
      { value: 'event.minutes_late', label: 'Minutes de retard', type: 'number' },
      { value: 'event.was_late', label: 'Est en retard', type: 'boolean' },
      { value: 'metrics.late_count_week', label: 'Retards cette semaine', type: 'number' },
      { value: 'metrics.late_count_month', label: 'Retards ce mois', type: 'number' },
    ],
    actionTypes: [
      { value: 'send_warning_message', label: 'Envoyer un avertissement' },
      { value: 'send_notification', label: 'Envoyer une notification' },
      { value: 'log', label: 'Enregistrer un log' },
    ],
    actionTargets: [
      { value: 'employee', label: 'Employé concerné' },
      { value: 'employee_manager', label: 'Manager de l\'employé' },
      { value: 'admin', label: 'Administrateur' },
    ],
    sampleEvent: { employee_id: 1, attendance_date: new Date().toISOString().slice(0, 10), status: 'late', minutes_late: 8, was_late: true },
  },
  {
    value: 'order.status_changed',
    label: 'Statut commande changé',
    icon: <Zap className="w-4 h-4" />,
    fields: [
      { value: 'event.from_status', label: 'Ancien statut', type: 'string', options: [
        { value: 'new', label: 'Nouvelle' }, { value: 'confirmed', label: 'Confirmée' },
        { value: 'shipped', label: 'Expédiée' }, { value: 'delivered', label: 'Livrée' },
        { value: 'cancelled', label: 'Annulée' }, { value: 'returned', label: 'Retournée' },
      ]},
      { value: 'event.to_status', label: 'Nouveau statut', type: 'string', options: [
        { value: 'new', label: 'Nouvelle' }, { value: 'confirmed', label: 'Confirmée' },
        { value: 'shipped', label: 'Expédiée' }, { value: 'delivered', label: 'Livrée' },
        { value: 'cancelled', label: 'Annulée' }, { value: 'returned', label: 'Retournée' },
      ]},
      { value: 'event.total', label: 'Total commande', type: 'number' },
      { value: 'event.order_number', label: 'N° commande', type: 'string' },
    ],
    actionTypes: [
      { value: 'send_customer_message', label: 'Envoyer un message au client' },
      { value: 'send_notification', label: 'Envoyer une notification' },
      { value: 'send_message_variant', label: 'Message avec variantes A/B' },
      { value: 'log', label: 'Enregistrer un log' },
    ],
    actionTargets: [
      { value: 'customer', label: 'Client' },
      { value: 'confirmatrice', label: 'Confirmatrice' },
      { value: 'admin', label: 'Administrateur' },
    ],
    sampleEvent: { order_id: 1, from_status: 'confirmed', to_status: 'cancelled', order_number: 'NX-SAMPLE', total: 0 },
  },
];

/* ── Helpers ── */

function defaultConditions(trigger: TriggerKey): ConditionRow[] {
  if (trigger === 'attendance.marked') {
    return [
      { field: 'event.status', op: 'eq', value: 'late' },
      { field: 'event.minutes_late', op: 'gt', value: '5' },
    ];
  }
  return [{ field: 'event.to_status', op: 'eq', value: 'cancelled' }];
}

function defaultActions(trigger: TriggerKey): ActionStep[] {
  if (trigger === 'attendance.marked') {
    return [{
      type: 'send_warning_message', target: 'employee_manager', message: '', useAB: true,
      variants: [
        { label: 'A', message: 'Avertissement : retard répété cette semaine ({{metrics.late_count_week}} retards).', weight: 1 },
        { label: 'B', message: 'Veuillez corriger vos horaires : retard de plus de 5 min détecté à nouveau.', weight: 1 },
      ],
    }];
  }
  return [{
    type: 'send_customer_message', target: 'customer', message: 'Votre commande {{event.order_number}} a été annulée.', useAB: false, variants: [],
  }];
}

function conditionsToJson(conditions: ConditionRow[]): Record<string, unknown> | null {
  if (conditions.length === 0) return null;
  return {
    all: conditions.map((c) => {
      let val: unknown = c.value;
      if (c.value === 'true') val = true;
      else if (c.value === 'false') val = false;
      else if (/^\d+(\.\d+)?$/.test(c.value)) val = Number(c.value);
      return { field: c.field, op: c.op, value: val };
    }),
  };
}

function actionsToJson(steps: ActionStep[]): Record<string, unknown> {
  if (steps.length === 1 && !steps[0].useAB) {
    return { type: steps[0].type, target: steps[0].target, message: steps[0].message };
  }
  if (steps.length === 1 && steps[0].useAB) {
    return {
      type: steps[0].type, target: steps[0].target,
      variants: steps[0].variants.map((v) => ({ label: v.label, message: v.message, weight: v.weight })),
    };
  }
  return {
    type: 'sequence', target: steps[0]?.target ?? 'admin',
    sequence: steps.map((s) => {
      if (s.useAB) return { type: s.type, variants: s.variants.map((v) => ({ label: v.label, message: v.message, weight: v.weight })) };
      return { type: s.type, message: s.message };
    }),
  };
}

function jsonToConditions(json: Record<string, unknown> | null): ConditionRow[] {
  if (!json) return [];
  const all = (json as any).all;
  if (!Array.isArray(all)) return [];
  return all.map((c: any) => ({ field: String(c.field ?? ''), op: (c.op ?? 'eq') as Op, value: String(c.value ?? '') }));
}

function jsonToActions(json: Record<string, unknown>): ActionStep[] {
  const j = json as any;
  if (j.sequence && Array.isArray(j.sequence)) {
    return j.sequence.map((s: any) => ({
      type: s.type ?? 'log', target: j.target ?? 'admin', message: s.message ?? '',
      useAB: Array.isArray(s.variants) && s.variants.length > 0,
      variants: (s.variants ?? []).map((v: any) => ({ label: v.label ?? 'A', message: v.message ?? '', weight: v.weight ?? 1 })),
    }));
  }
  if (Array.isArray(j.variants) && j.variants.length > 0) {
    return [{
      type: j.type ?? 'send_warning_message', target: j.target ?? 'admin', message: '', useAB: true,
      variants: j.variants.map((v: any) => ({ label: v.label ?? 'A', message: v.message ?? '', weight: v.weight ?? 1 })),
    }];
  }
  return [{ type: j.type ?? 'log', target: j.target ?? 'admin', message: j.message ?? '', useAB: false, variants: [] }];
}

/* ══════════════════════════════════════════════════════
   Main Screen
   ══════════════════════════════════════════════════════ */

export function AutomationsScreen() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('automations.create');
  const canUpdate = hasPermission('automations.update');
  const canDelete = hasPermission('automations.delete');
  const canRun = hasPermission('automations.run');

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runsExpanded, setRunsExpanded] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftTrigger, setDraftTrigger] = useState<TriggerKey>('attendance.marked');
  const [draftActive, setDraftActive] = useState(true);
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [actions, setActions] = useState<ActionStep[]>([]);

  const triggerConfig = useMemo(() => TRIGGERS.find((t) => t.value === draftTrigger) ?? TRIGGERS[0], [draftTrigger]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    const res = await api.get<LaravelPaginator<AutomationRule>>(`automations/rules?per_page=200&search=${encodeURIComponent(q.trim())}`);
    setLoading(false);
    if (!res.ok) { toast.error(res.message); setRules([]); return; }
    setRules(isPaginator<AutomationRule>(res.data) ? res.data.data : []);
  }, [q, toast]);

  const loadRuns = useCallback(async () => {
    const res = await api.get<LaravelPaginator<AutomationRun>>('automations/runs?per_page=50');
    if (!res.ok) return;
    setRuns(isPaginator<AutomationRun>(res.data) ? res.data.data : []);
  }, []);

  useEffect(() => { void loadRules(); void loadRuns(); }, [loadRules, loadRuns]);

  function openCreate() {
    setEditingId(null);
    setDraftName(''); setDraftDesc('');
    setDraftTrigger('attendance.marked');
    setDraftActive(true);
    setConditions(defaultConditions('attendance.marked'));
    setActions(defaultActions('attendance.marked'));
    setModalOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditingId(rule.id);
    setDraftName(rule.name);
    setDraftDesc(rule.description ?? '');
    setDraftTrigger(rule.trigger_key);
    setDraftActive(rule.is_active);
    setConditions(jsonToConditions(rule.condition_json));
    setActions(jsonToActions(rule.action_json));
    setModalOpen(true);
  }

  function changeTrigger(key: TriggerKey) {
    setDraftTrigger(key);
    setConditions(defaultConditions(key));
    setActions(defaultActions(key));
  }

  async function saveRule() {
    if (!draftName.trim()) { toast.error('Nom de règle requis.'); return; }
    const body = {
      name: draftName.trim(), description: draftDesc.trim() || null,
      trigger_key: draftTrigger, is_active: draftActive,
      condition_json: conditionsToJson(conditions),
      action_json: actionsToJson(actions),
    };
    const res = editingId ? await api.put(`automations/rules/${editingId}`, body) : await api.post('automations/rules', body);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(editingId ? 'Règle mise à jour.' : 'Règle créée.');
    setModalOpen(false);
    await loadRules();
  }

  async function deleteRule(rule: AutomationRule) {
    if (!window.confirm(`Supprimer la règle « ${rule.name} » ?`)) return;
    const res = await api.del(`automations/rules/${rule.id}`);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Règle supprimée.');
    await loadRules();
  }

  async function testRule(rule: AutomationRule) {
    const sample = TRIGGERS.find((t) => t.value === rule.trigger_key)?.sampleEvent ?? {};
    const res = await api.post<{ status: string; message: string }>(`automations/rules/${rule.id}/test`, { event_payload: sample });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success(`${res.message} (${res.data?.status ?? 'ok'})`);
    await loadRuns();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Automatisations" subtitle="Créez des règles « si ceci, alors cela » sans écrire de code."
        right={
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadRules()} className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
            </button>
            {canCreate && <button type="button" onClick={openCreate} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Nouvelle automatisation</button>}
          </div>
        }
      />

      <FilterBar query={q} onQueryChange={setQ} />

      {rules.length === 0 && !loading ? (
        <EmptyState title="Aucune automatisation" description="Créez votre première règle pour automatiser vos processus." />
      ) : (
        <DataTable<AutomationRule> rows={rules} columns={[
          { key: 'name', header: 'Règle', cell: (r) => (
            <div>
              <span className="font-black text-zinc-900">{r.name}</span>
              {r.description && <p className="text-xs text-zinc-500 mt-0.5">{r.description}</p>}
            </div>
          )},
          { key: 'trigger', header: 'Déclencheur', cell: (r) => {
            const t = TRIGGERS.find((tr) => tr.value === r.trigger_key);
            return <StatusChip tone="info">{t?.label ?? r.trigger_key}</StatusChip>;
          }},
          { key: 'active', header: 'Statut', cell: (r) => <StatusChip tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'Active' : 'Inactive'}</StatusChip> },
          { key: 'actions', header: '', cell: (r) => (
            <div className="flex items-center gap-3">
              {(canUpdate || canCreate) && <button type="button" onClick={() => openEdit(r)} className="text-sm font-black text-primary-600 hover:underline">Modifier</button>}
              {canRun && <button type="button" onClick={() => void testRule(r)} className="text-sm font-black text-emerald-700 hover:underline inline-flex items-center gap-1"><Beaker className="w-3.5 h-3.5" />Tester</button>}
              {canDelete && <button type="button" onClick={() => void deleteRule(r)} className="text-sm font-black text-rose-700 hover:underline inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Suppr.</button>}
            </div>
          )},
        ]} />
      )}

      {/* Recent runs */}
      <div className="card p-5">
        <button type="button" onClick={() => setRunsExpanded(!runsExpanded)} className="flex items-center gap-2 w-full text-left">
          {runsExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
          <span className="text-sm font-black text-zinc-900">Exécutions récentes</span>
          <span className="text-xs font-bold text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5">{runs.length}</span>
        </button>
        {runsExpanded && (
          <div className="mt-3 space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="card-muted p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusChip tone={r.status === 'executed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>
                    {r.status === 'executed' ? 'Exécutée' : r.status === 'failed' ? 'Échouée' : 'Ignorée'}
                  </StatusChip>
                  <span className="text-xs font-black text-zinc-700">{r.rule?.name ?? r.trigger_key}</span>
                </div>
                <span className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleString()}</span>
                <span className="text-xs text-zinc-700">{r.result_message ?? '—'}</span>
              </div>
            ))}
            {runs.length === 0 && <p className="text-sm text-zinc-500">Aucune exécution pour le moment.</p>}
          </div>
        )}
      </div>

      {/* ── Rule Builder Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editingId ? 'Modifier l\'automatisation' : 'Nouvelle automatisation'}
        panelClassName="max-w-3xl max-h-[92vh] flex flex-col"
        footer={
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
            <button type="button" onClick={() => void saveRule()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Enregistrer</button>
          </div>
        }
      >
        <div className="space-y-5 max-h-[calc(92vh-12rem)] overflow-y-auto pr-1">

          {/* Name + Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-black uppercase text-zinc-500">Nom <span className="text-rose-600">*</span>
              <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="Ex: Alerte retard employé" />
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">Description
              <input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="Optionnel" />
            </label>
          </div>

          {/* Trigger selector */}
          <div className="rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-4">
            <p className="text-xs font-black uppercase text-indigo-600 mb-3 inline-flex items-center gap-2">
              <Zap className="w-4 h-4" /> Quand (déclencheur)
            </p>
            <div className="flex flex-wrap gap-2">
              {TRIGGERS.map((t) => (
                <button key={t.value} type="button" onClick={() => changeTrigger(t.value)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition-all ${
                    draftTrigger === t.value ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                  }`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <label className="inline-flex items-center gap-2 text-sm font-bold text-zinc-700 cursor-pointer">
            <input type="checkbox" checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} className="rounded" />
            Règle active
          </label>

          {/* Conditions builder */}
          <div className="rounded-2xl border-2 border-amber-100 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black uppercase text-amber-700 inline-flex items-center gap-2">
                <List className="w-4 h-4" /> Si (conditions)
              </p>
              <button type="button" onClick={() => setConditions((prev) => [...prev, { field: triggerConfig.fields[0]?.value ?? '', op: 'eq', value: '' }])}
                className="text-xs font-black text-amber-700 hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ajouter
              </button>
            </div>
            {conditions.length === 0 ? (
              <p className="text-xs text-amber-600">Aucune condition — la règle se déclenche toujours.</p>
            ) : (
              <div className="space-y-2">
                {conditions.map((cond, ci) => (
                  <div key={ci} className="flex items-center gap-2 flex-wrap bg-white rounded-xl p-2.5 border border-amber-100">
                    {ci > 0 && <span className="text-[10px] font-black text-amber-500 bg-amber-100 rounded-full px-2 py-0.5">ET</span>}
                    <select value={cond.field} onChange={(e) => setConditions((prev) => prev.map((c, i) => i === ci ? { ...c, field: e.target.value } : c))}
                      className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold flex-1 min-w-[140px]">
                      {triggerConfig.fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select value={cond.op} onChange={(e) => setConditions((prev) => prev.map((c, i) => i === ci ? { ...c, op: e.target.value as Op } : c))}
                      className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold min-w-[130px]">
                      {(Object.keys(OP_LABELS) as Op[]).map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
                    </select>
                    {(() => {
                      const fieldConf = triggerConfig.fields.find((f) => f.value === cond.field);
                      if (fieldConf?.options) {
                        return (
                          <select value={cond.value} onChange={(e) => setConditions((prev) => prev.map((c, i) => i === ci ? { ...c, value: e.target.value } : c))}
                            className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold flex-1 min-w-[100px]">
                            <option value="">— Choisir —</option>
                            {fieldConf.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        );
                      }
                      if (fieldConf?.type === 'boolean') {
                        return (
                          <select value={cond.value} onChange={(e) => setConditions((prev) => prev.map((c, i) => i === ci ? { ...c, value: e.target.value } : c))}
                            className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold flex-1 min-w-[80px]">
                            <option value="true">Oui</option><option value="false">Non</option>
                          </select>
                        );
                      }
                      return (
                        <input value={cond.value} onChange={(e) => setConditions((prev) => prev.map((c, i) => i === ci ? { ...c, value: e.target.value } : c))}
                          type={fieldConf?.type === 'number' ? 'number' : 'text'}
                          className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm flex-1 min-w-[80px]" placeholder="Valeur" />
                      );
                    })()}
                    <button type="button" onClick={() => setConditions((prev) => prev.filter((_, i) => i !== ci))}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions builder */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-black uppercase text-emerald-700 inline-flex items-center gap-2">
                <Zap className="w-4 h-4" /> Alors (actions)
              </p>
              <button type="button" onClick={() => setActions((prev) => [...prev, { type: triggerConfig.actionTypes[0]?.value ?? 'log', target: triggerConfig.actionTargets[0]?.value ?? 'admin', message: '', useAB: false, variants: [] }])}
                className="text-xs font-black text-emerald-700 hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Ajouter étape
              </button>
            </div>
            {actions.length === 0 ? (
              <p className="text-xs text-emerald-600">Aucune action définie.</p>
            ) : (
              <div className="space-y-3">
                {actions.map((step, si) => (
                  <div key={si} className="bg-white rounded-xl p-3 border border-emerald-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-600">Étape {si + 1}</span>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setActions((prev) => prev.filter((_, i) => i !== si))}
                          className="text-xs font-black text-rose-500 hover:underline">Retirer</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-black uppercase text-zinc-500">Type d'action
                        <select value={step.type} onChange={(e) => setActions((prev) => prev.map((s, i) => i === si ? { ...s, type: e.target.value } : s))}
                          className="mt-1 w-full px-2 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold">
                          {triggerConfig.actionTypes.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                      </label>
                      <label className="text-[10px] font-black uppercase text-zinc-500">Destinataire
                        <select value={step.target} onChange={(e) => setActions((prev) => prev.map((s, i) => i === si ? { ...s, target: e.target.value } : s))}
                          className="mt-1 w-full px-2 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold">
                          {triggerConfig.actionTargets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </label>
                    </div>

                    {/* A/B toggle */}
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 cursor-pointer">
                      <input type="checkbox" checked={step.useAB} onChange={(e) => {
                        setActions((prev) => prev.map((s, i) => {
                          if (i !== si) return s;
                          if (e.target.checked) return { ...s, useAB: true, variants: s.variants.length > 0 ? s.variants : [{ label: 'A', message: s.message || '', weight: 1 }, { label: 'B', message: '', weight: 1 }] };
                          return { ...s, useAB: false, message: s.variants[0]?.message ?? s.message };
                        }));
                      }} className="rounded" />
                      <GitBranch className="w-3.5 h-3.5" /> Test A/B (variantes de message)
                    </label>

                    {step.useAB ? (
                      <div className="space-y-2">
                        {step.variants.map((v, vi) => (
                          <div key={vi} className="flex items-start gap-2 bg-zinc-50 rounded-lg p-2">
                            <span className={`text-[10px] font-black px-2 py-1 rounded-full mt-1 ${vi === 0 ? 'bg-indigo-100 text-indigo-700' : vi === 1 ? 'bg-amber-100 text-amber-700' : 'bg-zinc-200 text-zinc-600'}`}>
                              {v.label}
                            </span>
                            <textarea value={v.message} onChange={(e) => setActions((prev) => prev.map((s, i) => i === si ? { ...s, variants: s.variants.map((vv, j) => j === vi ? { ...vv, message: e.target.value } : vv) } : s))}
                              rows={2} className="flex-1 px-2 py-1.5 rounded-lg border border-zinc-200 text-sm" placeholder={`Message variante ${v.label}…`} />
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[9px] font-black text-zinc-400">Poids</span>
                              <input type="number" min={1} max={10} value={v.weight} onChange={(e) => setActions((prev) => prev.map((s, i) => i === si ? { ...s, variants: s.variants.map((vv, j) => j === vi ? { ...vv, weight: Number(e.target.value) || 1 } : vv) } : s))}
                                className="w-12 px-1 py-1 rounded-lg border border-zinc-200 text-xs text-center" />
                            </div>
                            {step.variants.length > 2 && (
                              <button type="button" onClick={() => setActions((prev) => prev.map((s, i) => i === si ? { ...s, variants: s.variants.filter((_, j) => j !== vi) } : s))}
                                className="p-1 mt-1 rounded hover:bg-rose-50 text-zinc-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => {
                          const nextLabel = String.fromCharCode(65 + (actions[si]?.variants.length ?? 0));
                          setActions((prev) => prev.map((s, i) => i === si ? { ...s, variants: [...s.variants, { label: nextLabel, message: '', weight: 1 }] } : s));
                        }} className="text-xs font-black text-indigo-600 hover:underline inline-flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Ajouter variante
                        </button>
                      </div>
                    ) : (
                      <label className="text-[10px] font-black uppercase text-zinc-500 block">Message
                        <textarea value={step.message} onChange={(e) => setActions((prev) => prev.map((s, i) => i === si ? { ...s, message: e.target.value } : s))}
                          rows={2} className="mt-1 w-full px-2 py-1.5 rounded-lg border border-zinc-200 text-sm"
                          placeholder="Utilisez les variables ci-dessous pour personnaliser le message" />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Variables hint */}
          <div className="card-muted p-3">
            <p className="text-[10px] font-black uppercase text-zinc-500 mb-2">Variables disponibles <span className="text-zinc-400 normal-case font-bold">(cliquez pour copier)</span></p>
            <div className="flex flex-wrap gap-1.5">
              {triggerConfig.fields.map((f) => (
                <button key={f.value} type="button"
                  className="text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-2.5 py-1 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1.5 border border-zinc-200"
                  title={`Copier {{${f.value}}}`}
                  onClick={() => { void navigator.clipboard.writeText(`{{${f.value}}}`); toast.success(`Variable « ${f.label} » copiée !`); }}>
                  <Copy className="w-3 h-3 text-zinc-400" />
                  <span className="font-bold">{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
