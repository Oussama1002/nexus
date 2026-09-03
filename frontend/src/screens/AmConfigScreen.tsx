import React, { useEffect, useMemo, useState } from 'react';
import {
  Settings, Layers, Flag, DoorOpen, ListChecks, ClipboardCheck,
  Activity, Bell, FileText, Plus, Save, Trash2, XCircle,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type R = Record<string, any>;

type Resource = {
  key: string;
  label: string;
  Icon: any;
  fields: { name: string; label: string; type: 'text' | 'number' | 'bool' | 'json' | 'textarea' }[];
};

const RESOURCES: Resource[] = [
  {
    key: 'roadmap-templates', label: 'Modèles de feuille de route', Icon: Layers,
    fields: [
      { name: 'code', label: 'Code', type: 'text' },
      { name: 'label', label: 'Libellé', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Actif', type: 'bool' },
      { name: 'is_default', label: 'Par défaut', type: 'bool' },
    ],
  },
  {
    key: 'chantier-templates', label: 'Chantiers', Icon: Flag,
    fields: [
      { name: 'roadmap_template_id', label: 'ID modèle feuille', type: 'number' },
      { name: 'code', label: 'Code', type: 'text' },
      { name: 'label', label: 'Libellé', type: 'text' },
      { name: 'objective', label: 'Objectif', type: 'textarea' },
      { name: 'prerequisite_gate_codes', label: 'Portes pré-requises (JSON)', type: 'json' },
      { name: 'sort_order', label: 'Ordre', type: 'number' },
    ],
  },
  {
    key: 'gate-templates', label: 'Portes', Icon: DoorOpen,
    fields: [
      { name: 'roadmap_template_id', label: 'ID modèle feuille', type: 'number' },
      { name: 'chantier_template_id', label: 'ID chantier', type: 'number' },
      { name: 'code', label: 'Code', type: 'text' },
      { name: 'label', label: 'Libellé', type: 'text' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'validator_role', label: 'Rôle validateur', type: 'text' },
      { name: 'unlocks_modules_json', label: 'Modules débloqués (JSON)', type: 'json' },
      { name: 'is_scaling_gate', label: 'Porte scaling', type: 'bool' },
      { name: 'is_conversion_gate', label: 'Porte conversion', type: 'bool' },
      { name: 'sort_order', label: 'Ordre', type: 'number' },
    ],
  },
  {
    key: 'gate-criteria-templates', label: 'Critères de portes', Icon: ListChecks,
    fields: [
      { name: 'gate_template_id', label: 'ID porte', type: 'number' },
      { name: 'label', label: 'Libellé', type: 'text' },
      { name: 'verification_mode', label: 'Mode', type: 'text' },
      { name: 'source', label: 'Source', type: 'text' },
      { name: 'operator', label: 'Opérateur', type: 'text' },
      { name: 'threshold', label: 'Seuil', type: 'number' },
      { name: 'is_mandatory', label: 'Obligatoire', type: 'bool' },
      { name: 'sort_order', label: 'Ordre', type: 'number' },
    ],
  },
  {
    key: 'qa-grid-templates', label: 'Grilles QA', Icon: ClipboardCheck,
    fields: [
      { name: 'deliverable_type', label: 'Type de livrable', type: 'text' },
      { name: 'label', label: 'Libellé', type: 'text' },
      { name: 'criteria_json', label: 'Critères (JSON)', type: 'json' },
      { name: 'is_active', label: 'Actif', type: 'bool' },
    ],
  },
  {
    key: 'health-score-configs', label: 'Score de santé', Icon: Activity,
    fields: [
      { name: 'brand_id', label: 'ID marque (vide = défaut)', type: 'number' },
      { name: 'code', label: 'Code', type: 'text' },
      { name: 'weights_json', label: 'Pondérations (JSON)', type: 'json' },
      { name: 'components_json', label: 'Composants (JSON)', type: 'json' },
      { name: 'is_active', label: 'Actif', type: 'bool' },
    ],
  },
  {
    key: 'alert-rule-templates', label: 'Règles d\'alertes', Icon: Bell,
    fields: [
      { name: 'code', label: 'Code', type: 'text' },
      { name: 'label', label: 'Libellé', type: 'text' },
      { name: 'severity', label: 'Sévérité (low/medium/high/critical)', type: 'text' },
      { name: 'trigger_type', label: 'Type déclencheur', type: 'text' },
      { name: 'default_recipient_role', label: 'Rôle destinataire', type: 'text' },
      { name: 'target_resolution_minutes', label: 'SLA (min)', type: 'number' },
      { name: 'is_active', label: 'Actif', type: 'bool' },
    ],
  },
  {
    key: 'report-templates', label: 'Modèles de rapports', Icon: FileText,
    fields: [
      { name: 'code', label: 'Code', type: 'text' },
      { name: 'label', label: 'Libellé', type: 'text' },
      { name: 'sections_json', label: 'Sections (JSON)', type: 'json' },
      { name: 'publishable_fields_whitelist', label: 'Whitelist champs (JSON)', type: 'json' },
      { name: 'is_active', label: 'Actif', type: 'bool' },
    ],
  },
];

function Modal({ open, onClose, title, children }: any) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-black text-zinc-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100"><XCircle className="w-5 h-5 text-zinc-500" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function AmConfigScreen() {
  const [activeKey, setActiveKey] = useState<string>(RESOURCES[0].key);
  const active = useMemo(() => RESOURCES.find(r => r.key === activeKey)!, [activeKey]);
  const [rows, setRows] = useState<R[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<R | null>(null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    const res = await api.get<Paginated<R>>(`am/config/${activeKey}` + buildQuery({ per_page: 100 }));
    if (res.ok) setRows(res.data.data);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeKey]);

  const save = async (form: R) => {
    const payload = coerce(form, active.fields);
    if (editing) {
      const res = await api.patch<R>(`am/config/${activeKey}/${editing.id}`, payload);
      if (res.ok) { toast.success('Mis à jour.'); setEditing(null); load(); }
      else toast.error(res.message);
    } else {
      const res = await api.post<R>(`am/config/${activeKey}`, payload);
      if (res.ok) { toast.success('Créé.'); setCreating(false); load(); }
      else toast.error(res.message);
    }
  };

  const del = async (id: number) => {
    if (!confirm('Supprimer définitivement ?')) return;
    const res = await api.del<R>(`am/config/${activeKey}/${id}`);
    if (res.ok) { toast.success('Supprimé.'); load(); }
    else toast.error(res.message);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Configuration Pilotage de marque"
        subtitle="Modèles de feuille de route, chantiers, portes, critères, QA, score de santé, alertes et rapports."
      />

      <div className="flex flex-wrap gap-2 border-b border-zinc-200">
        {RESOURCES.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveKey(key)}
            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-t-lg transition ${
              activeKey === key
                ? 'bg-white border-x border-t border-zinc-200 text-zinc-900 -mb-px'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-semibold hover:bg-zinc-800">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun élément" description="Créez votre premier élément avec le bouton ci-dessus." />
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="text-left px-4 py-2">ID</th>
                {active.fields.slice(0, 4).map(f => <th key={f.name} className="text-left px-4 py-2">{f.label}</th>)}
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-2 font-mono text-xs text-zinc-500">{r.id}</td>
                  {active.fields.slice(0, 4).map(f => (
                    <td key={f.name} className="px-4 py-2">
                      {formatCell(r[f.name], f.type, f.name)}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => setEditing(r)} className="text-xs font-semibold text-blue-600 hover:underline">Modifier</button>
                    <button onClick={() => del(r.id)} className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1"><Trash2 className="w-3 h-3" />Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing || creating} onClose={() => { setEditing(null); setCreating(false); }} title={editing ? `Modifier ${active.label}` : `Nouveau ${active.label}`}>
        <FormEditor
          fields={active.fields}
          initial={editing ?? {}}
          onSubmit={save}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      </Modal>
    </div>
  );
}

function FormEditor({ fields, initial, onSubmit, onCancel }: any) {
  const [form, setForm] = useState<R>(() => {
    const out: R = {};
    for (const f of fields as Resource['fields']) {
      const v = initial[f.name];
      if (f.type === 'json' && v !== undefined && v !== null && typeof v !== 'string') {
        out[f.name] = JSON.stringify(v, null, 2);
      } else {
        out[f.name] = v ?? '';
      }
    }
    return out;
  });

  return (
    <div className="space-y-3">
      {(fields as Resource['fields']).map(f => (
        <label key={f.name} className="block text-sm font-semibold text-zinc-700">
          {f.label}
          {f.type === 'textarea' && (
            <textarea value={form[f.name] ?? ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-normal" rows={3} />
          )}
          {f.type === 'json' && (
            <textarea value={form[f.name] ?? ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })}
              placeholder="[] ou {}" className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-xs font-mono" rows={5} />
          )}
          {f.type === 'bool' && (
            <select value={String(form[f.name] ?? 'false')} onChange={e => setForm({ ...form, [f.name]: e.target.value === 'true' })}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-normal">
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          )}
          {(f.type === 'text' || f.type === 'number') && (
            <input type={f.type} value={form[f.name] ?? ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-normal" />
          )}
        </label>
      ))}
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSubmit(form)} className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-zinc-900 text-white rounded-xl text-sm font-semibold">
          <Save className="w-4 h-4" /> Enregistrer
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-xl text-sm font-semibold">Annuler</button>
      </div>
    </div>
  );
}

function coerce(form: R, fields: Resource['fields']): R {
  const out: R = {};
  for (const f of fields) {
    const v = form[f.name];
    if (v === '' || v === null || v === undefined) { out[f.name] = null; continue; }
    if (f.type === 'number') out[f.name] = Number(v);
    else if (f.type === 'bool') out[f.name] = !!v;
    else if (f.type === 'json') { try { out[f.name] = JSON.parse(v); } catch { out[f.name] = null; } }
    else out[f.name] = v;
  }
  return out;
}

// Human-friendly labels for well-known configuration values.
const KNOWN_CODE_LABELS: Record<string, string> = {
  default: 'Par défaut',
  'monthly-client': 'Rapport client mensuel',
};
const KNOWN_KEY_LABELS: Record<string, string> = {
  // health score components / weights
  economics: 'Économique',
  conversion: 'Conversion',
  execution: 'Exécution',
  risk: 'Risque',
  // deliverable types
  brand_book: 'Brand book',
  landing_page: 'Landing page',
  creative_video: 'Créatif vidéo',
  monthly_plan: 'Plan mensuel',
};

function humanizeKey(k: string): string {
  return KNOWN_KEY_LABELS[k] ?? k.replace(/_/g, ' ');
}

function humanizeCode(v: string): string {
  return KNOWN_CODE_LABELS[v] ?? v;
}

function jsonSummary(value: any): React.ReactNode {
  const parsed = typeof value === 'string' ? tryParse(value) : value;
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed);
    if (entries.length === 0) return <span className="text-zinc-400">— aucun —</span>;
    // For numeric maps (e.g. weights) render "clé : valeur" chips
    const allNumeric = entries.every(([, v]) => typeof v === 'number');
    if (allNumeric) {
      return (
        <div className="flex flex-wrap gap-1">
          {entries.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
              {humanizeKey(k)} <span className="font-black">{formatWeight(v as number)}</span>
            </span>
          ))}
        </div>
      );
    }
    // Otherwise list the labels
    return (
      <div className="flex flex-wrap gap-1">
        {entries.slice(0, 6).map(([k]) => (
          <span key={k} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
            {humanizeKey(k)}
          </span>
        ))}
        {entries.length > 6 && <span className="text-[11px] text-zinc-500">+{entries.length - 6}</span>}
      </div>
    );
  }
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return <span className="text-zinc-400">— aucun —</span>;
    return <span className="text-xs text-zinc-600 font-semibold">{parsed.length} élément{parsed.length > 1 ? 's' : ''}</span>;
  }
  return <span className="text-zinc-400">—</span>;
}

function tryParse(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

function formatWeight(v: number): string {
  // Weights are typically 0..1 → show as percent for readability
  if (v <= 1 && v >= 0) return `${Math.round(v * 100)}%`;
  return String(v);
}

function formatCell(value: any, type: string, fieldName?: string) {
  if (value === null || value === undefined || value === '') {
    // Friendly default for brand_id column ("empty = default config")
    if (fieldName === 'brand_id') return <span className="text-xs font-semibold text-blue-700">Toutes les marques</span>;
    return <span className="text-zinc-400">—</span>;
  }
  if (type === 'bool') return value ? <span className="text-emerald-600 font-black">Oui</span> : <span className="text-zinc-400 font-black">Non</span>;
  if (type === 'json') return jsonSummary(value);
  if (fieldName === 'code') return <span className="font-semibold text-zinc-800">{humanizeCode(String(value))}</span>;
  if (fieldName === 'severity') {
    const map: Record<string, string> = { low: 'Faible', medium: 'Moyenne', high: 'Élevée', critical: 'Critique' };
    return <span className="font-semibold">{map[String(value)] ?? value}</span>;
  }
  if (fieldName === 'deliverable_type') return <span className="font-semibold">{humanizeKey(String(value))}</span>;
  const s = String(value);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

export default AmConfigScreen;
