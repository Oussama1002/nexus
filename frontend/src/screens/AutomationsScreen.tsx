import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Beaker, Plus, RefreshCw, Trash2 } from 'lucide-react';
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

type TriggerKey = 'attendance.marked' | 'order.status_changed';

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

const TRIGGERS: { value: TriggerKey; label: string; sampleEvent: Record<string, unknown> }[] = [
  {
    value: 'attendance.marked',
    label: 'Retard / présence employé',
    sampleEvent: {
      employee_id: 1,
      attendance_date: new Date().toISOString().slice(0, 10),
      status: 'late',
      minutes_late: 8,
      was_late: true,
    },
  },
  {
    value: 'order.status_changed',
    label: 'Statut commande changé',
    sampleEvent: {
      order_id: 1,
      from_status: 'confirmed',
      to_status: 'cancelled',
      order_number: 'NX-SAMPLE',
      total: 0,
    },
  },
];

function defaultConditionForTrigger(trigger: TriggerKey): string {
  if (trigger === 'attendance.marked') {
    return JSON.stringify(
      {
        all: [
          { field: 'event.status', op: 'eq', value: 'late' },
          { field: 'event.minutes_late', op: 'gt', value: 5 },
          { field: 'metrics.late_count_week', op: 'gt', value: 1 },
        ],
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      all: [{ field: 'event.to_status', op: 'eq', value: 'cancelled' }],
    },
    null,
    2,
  );
}

function defaultActionForTrigger(trigger: TriggerKey): string {
  if (trigger === 'attendance.marked') {
    return JSON.stringify(
      {
        type: 'send_warning_message',
        target: 'employee_manager',
        variants: [
          { label: 'A', message: 'Avertissement: retard répété cette semaine ({{metrics.late_count_week}} fois).', weight: 1 },
          { label: 'B', message: 'Merci de corriger vos horaires: retard > 5 min détecté à nouveau.', weight: 1 },
        ],
      },
      null,
      2,
    );
  }
  return JSON.stringify(
    {
      type: 'send_customer_message',
      target: 'customer',
      sequence: [
        { type: 'log', message: 'Commande {{event.order_number}} annulée, relance SAV.' },
        {
          type: 'send_message_variant',
          variants: [
            { label: 'A', message: 'Votre commande {{event.order_number}} a été annulée. Nous vous aidons à relancer.', weight: 1 },
            { label: 'B', message: 'Désolé pour l’annulation de {{event.order_number}}. Une solution alternative arrive.', weight: 1 },
          ],
        },
      ],
    },
    null,
    2,
  );
}

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    trigger_key: 'attendance.marked' as TriggerKey,
    condition_json_text: defaultConditionForTrigger('attendance.marked'),
    action_json_text: defaultActionForTrigger('attendance.marked'),
    is_active: true,
  });

  const loadRules = useCallback(async () => {
    setLoading(true);
    const res = await api.get<LaravelPaginator<AutomationRule>>(`automations/rules?per_page=200&search=${encodeURIComponent(q.trim())}`);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setRules([]);
      return;
    }
    setRules(isPaginator<AutomationRule>(res.data) ? res.data.data : []);
  }, [q, toast]);

  const loadRuns = useCallback(async () => {
    const res = await api.get<LaravelPaginator<AutomationRun>>('automations/runs?per_page=50');
    if (!res.ok) return;
    setRuns(isPaginator<AutomationRun>(res.data) ? res.data.data : []);
  }, []);

  useEffect(() => {
    void loadRules();
    void loadRuns();
  }, [loadRules, loadRuns]);

  const selectedTrigger = useMemo(
    () => TRIGGERS.find((t) => t.value === draft.trigger_key) ?? TRIGGERS[0],
    [draft.trigger_key],
  );

  function openCreate() {
    setEditingId(null);
    setDraft({
      name: '',
      description: '',
      trigger_key: 'attendance.marked',
      condition_json_text: defaultConditionForTrigger('attendance.marked'),
      action_json_text: defaultActionForTrigger('attendance.marked'),
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditingId(rule.id);
    setDraft({
      name: rule.name,
      description: rule.description ?? '',
      trigger_key: rule.trigger_key,
      condition_json_text: JSON.stringify(rule.condition_json ?? {}, null, 2),
      action_json_text: JSON.stringify(rule.action_json ?? {}, null, 2),
      is_active: rule.is_active,
    });
    setModalOpen(true);
  }

  async function saveRule() {
    let conditionJson: Record<string, unknown> | null = null;
    let actionJson: Record<string, unknown> = {};
    try {
      conditionJson = draft.condition_json_text.trim() ? (JSON.parse(draft.condition_json_text) as Record<string, unknown>) : null;
      actionJson = JSON.parse(draft.action_json_text) as Record<string, unknown>;
    } catch {
      toast.error('JSON invalide dans conditions ou actions.');
      return;
    }
    if (!draft.name.trim()) {
      toast.error('Nom de règle requis.');
      return;
    }

    const body = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      trigger_key: draft.trigger_key,
      condition_json: conditionJson,
      action_json: actionJson,
      is_active: draft.is_active,
    };
    const res = editingId
      ? await api.put(`automations/rules/${editingId}`, body)
      : await api.post('automations/rules', body);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(editingId ? 'Règle automatisation mise à jour.' : 'Règle automatisation créée.');
    setModalOpen(false);
    await loadRules();
  }

  async function deleteRule(rule: AutomationRule) {
    if (!window.confirm(`Supprimer la règle "${rule.name}" ?`)) return;
    const res = await api.del(`automations/rules/${rule.id}`);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Règle supprimée.');
    await loadRules();
  }

  async function testRule(rule: AutomationRule) {
    const sample = TRIGGERS.find((t) => t.value === rule.trigger_key)?.sampleEvent ?? {};
    const res = await api.post<{ status: string; message: string; result_payload?: unknown }>(`automations/rules/${rule.id}/test`, {
      event_payload: sample,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`${res.message} (${res.data?.status ?? 'ok'})`);
    await loadRuns();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatisations personnalisées"
        subtitle="Créez vos séquences if-this-then-that sans dépendre des développeurs."
        right={
          <div className="flex gap-2">
            <button type="button" onClick={() => void loadRules()} className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
            </button>
            {canCreate ? (
              <button type="button" onClick={openCreate} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nouvelle règle
              </button>
            ) : null}
          </div>
        }
      />

      <FilterBar query={q} onQueryChange={setQ} />

      {rules.length === 0 && !loading ? (
        <EmptyState title="Aucune automatisation" description="Commencez par créer une règle (retard, annulation commande, etc.)." />
      ) : (
        <DataTable<AutomationRule>
          rows={rules}
          columns={[
            { key: 'name', header: 'Règle', cell: (r) => <span className="font-black">{r.name}</span> },
            { key: 'trigger', header: 'Déclencheur', cell: (r) => <StatusChip tone="info">{r.trigger_key}</StatusChip> },
            { key: 'desc', header: 'Description', cell: (r) => <span className="text-sm text-zinc-700">{r.description ?? '—'}</span> },
            { key: 'active', header: 'Statut', cell: (r) => <StatusChip tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'Active' : 'Inactive'}</StatusChip> },
            {
              key: 'actions',
              header: '',
              cell: (r) => (
                <div className="flex items-center gap-3">
                  {(canUpdate || canCreate) ? (
                    <button type="button" onClick={() => openEdit(r)} className="text-sm font-black text-primary-600 hover:underline">
                      Modifier
                    </button>
                  ) : null}
                  {canRun ? (
                    <button type="button" onClick={() => void testRule(r)} className="text-sm font-black text-emerald-700 hover:underline inline-flex items-center gap-1">
                      <Beaker className="w-3.5 h-3.5" /> Tester
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button type="button" onClick={() => void deleteRule(r)} className="text-sm font-black text-rose-700 hover:underline inline-flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}

      <div className="card p-5">
        <p className="text-sm font-black text-zinc-900 mb-3">Exécutions récentes</p>
        <div className="space-y-2">
          {runs.map((r) => (
            <div key={r.id} className="card-muted p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <StatusChip tone={r.status === 'executed' ? 'success' : r.status === 'failed' ? 'danger' : 'warning'}>
                  {r.status}
                </StatusChip>
                <span className="text-xs font-black text-zinc-700">{r.rule?.name ?? r.trigger_key}</span>
              </div>
              <span className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleString()}</span>
              <span className="text-xs text-zinc-700">{r.result_message ?? '—'}</span>
            </div>
          ))}
          {runs.length === 0 ? <p className="text-sm text-zinc-500">Aucune exécution pour le moment.</p> : null}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Modifier automatisation' : 'Nouvelle automatisation'}
        subtitle="If this then that: conditions JSON + actions JSON (A/B testing et séquences)."
        panelClassName="max-w-4xl max-h-[92vh] flex flex-col"
        footer={
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">
              Annuler
            </button>
            <button type="button" onClick={() => void saveRule()} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[calc(92vh-12rem)] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-xs font-black uppercase text-zinc-500">
              Nom
              <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
            </label>
            <label className="text-xs font-black uppercase text-zinc-500">
              Déclencheur
              <select
                value={draft.trigger_key}
                onChange={(e) => {
                  const t = e.target.value as TriggerKey;
                  setDraft((d) => ({
                    ...d,
                    trigger_key: t,
                    condition_json_text: defaultConditionForTrigger(t),
                    action_json_text: defaultActionForTrigger(t),
                  }));
                }}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
              >
                {TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="text-xs font-black uppercase text-zinc-500 block">
            Description
            <input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" />
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-bold text-zinc-700">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))} />
            Règle active
          </label>

          <label className="text-xs font-black uppercase text-zinc-500 block">
            Conditions JSON
            <textarea
              value={draft.condition_json_text}
              onChange={(e) => setDraft((d) => ({ ...d, condition_json_text: e.target.value }))}
              rows={9}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-mono text-xs"
            />
          </label>

          <label className="text-xs font-black uppercase text-zinc-500 block">
            Actions JSON (séquence + A/B)
            <textarea
              value={draft.action_json_text}
              onChange={(e) => setDraft((d) => ({ ...d, action_json_text: e.target.value }))}
              rows={14}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-mono text-xs"
            />
          </label>

          <div className="card-muted p-3 text-xs text-zinc-600">
            <p className="font-black text-zinc-800 mb-1">Événement test rapide (pour ce trigger)</p>
            <pre className="whitespace-pre-wrap">{JSON.stringify(selectedTrigger.sampleEvent, null, 2)}</pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}
