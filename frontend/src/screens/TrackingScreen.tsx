import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { cn } from '../lib/utils';
import {
  auditActionLabelFr,
  auditEntityFilterOptions,
  auditEntitySummaryFr,
  auditFieldLabelFr,
  formatAuditFieldValue,
  isAuditImageField,
  sortedAuditEntries,
} from '../lib/auditDisplayFr';
import { resolvePublicAssetUrl } from '../lib/publicAssetUrl';

type LookupMap = Record<number, string>;

const STATUS_FR: Record<string, string> = {
  open: 'Ouvert', closed: 'Fermé', pending: 'En attente', active: 'Actif',
  inactive: 'Inactif', draft: 'Brouillon', in_progress: 'En cours',
  blocked: 'Bloqué', review: 'En révision', published: 'Publié',
  done: 'Terminé', cancelled: 'Annulé', confirmed: 'Confirmé',
  shipped: 'Expédié', delivered: 'Livré', returned: 'Retourné',
  paid: 'Payé', unpaid: 'Impayé', partial: 'Partiel',
  new: 'Nouveau', qualified: 'Qualifié', converted: 'Converti',
  lost: 'Perdu', contacted: 'Contacté', won: 'Gagné',
  processing: 'En traitement', completed: 'Terminé',
  paused: 'En pause', ended: 'Terminé', scheduled: 'Planifié',
};

const CHANNEL_FR: Record<string, string> = {
  whatsapp: 'WhatsApp', email: 'E-mail', phone: 'Téléphone',
  sms: 'SMS', facebook: 'Facebook', instagram: 'Instagram',
  tiktok: 'TikTok', google: 'Google', web: 'Web', other: 'Autre',
};

const ENUM_FIELDS: Record<string, Record<string, string>> = {
  status: STATUS_FR,
  channel: CHANNEL_FR,
  payment_method: { cash: 'Espèces', card: 'Carte', transfer: 'Virement', cod: 'Contre remboursement', check: 'Chèque' },
  payment_state: { paid: 'Payé', unpaid: 'Impayé', partial: 'Partiel', refunded: 'Remboursé' },
  priority: { low: 'Basse', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente' },
  traffic_source: { organic: 'Organique', sponsored: 'Sponsorisé' },
  project_role: { content_creator: 'Tournage contenu', video_editor: 'Monteur', copywriter: 'Copywriter', publisher: 'Publication', reviewer: 'Relecture', other: 'Autre' },
};

const ID_FIELD_LOOKUP: Record<string, string> = {
  brand_id: 'brands',
  user_id: 'users',
  customer_id: 'customers',
  assigned_user_id: 'users',
  created_by_user_id: 'users',
  updated_by_user_id: 'users',
  assigned_to: 'users',
  sender_id: 'users',
  receiver_id: 'users',
  uploaded_by: 'users',
  supplier_id: 'suppliers',
};

const ENTITY_TYPE_LOOKUP: Record<string, string> = {
  'App\\Models\\User': 'users',
  'App\\Models\\Customer': 'customers',
  'App\\Models\\Brand': 'brands',
  'App\\Models\\Supplier': 'suppliers',
};

function resolveEntityName(
  entityType: string | null | undefined,
  entityId: string | number | null | undefined,
  lookups: Record<string, LookupMap>,
): string | null {
  if (!entityType || entityId == null || entityId === '') return null;
  const lookupKey = ENTITY_TYPE_LOOKUP[entityType];
  if (!lookupKey || !lookups[lookupKey]) return null;
  return lookups[lookupKey][entityId] ?? null;
}

type AuditUser = { id: number; name: string; email: string };

type AuditLogRow = {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: string | number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user?: AuditUser | null;
};

function hasAuditPayload(values: Record<string, unknown> | null | undefined): boolean {
  return values !== null && values !== undefined && Object.keys(values).length > 0;
}

function resolveAuditValue(fieldKey: string, value: unknown, lookups: Record<string, LookupMap>): string | null {
  if (value === null || value === undefined) return null;
  if (ENUM_FIELDS[fieldKey] && typeof value === 'string') {
    return ENUM_FIELDS[fieldKey][value] ?? null;
  }
  const lookupType = ID_FIELD_LOOKUP[fieldKey];
  if (lookupType && (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))) {
    const id = Number(value);
    const map = lookups[lookupType];
    if (map && map[id]) return `${map[id]} (#${id})`;
  }
  return null;
}

const JSON_KEY_LABELS: Record<string, string> = {
  type: 'Type', target: 'Cible', variants: 'Variantes', label: 'Libellé',
  message: 'Message', weight: 'Poids', field: 'Champ', op: 'Opérateur',
  value: 'Valeur', all: 'Toutes les conditions', any: 'Au moins une condition',
  action: 'Action', condition: 'Condition', name: 'Nom', status: 'Statut',
  email: 'E-mail', phone: 'Téléphone', description: 'Description', id: 'ID',
  subject: 'Sujet', body: 'Corps', url: 'URL', key: 'Clé', code: 'Code',
  title: 'Titre', content: 'Contenu', reason: 'Raison', note: 'Note',
  amount: 'Montant', quantity: 'Quantité', price: 'Prix', total: 'Total',
};
const OP_LABELS: Record<string, string> = {
  eq: '=', neq: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤',
  contains: 'contient', not_contains: 'ne contient pas',
  in: 'dans', not_in: 'pas dans', exists: 'existe', not_exists: 'n’existe pas',
};

function humanizeJsonKey(k: string): string {
  return JSON_KEY_LABELS[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function HumanJsonValue({ value, depth = 0 }: { value: unknown; depth?: number }): React.ReactElement {
  if (value === null || value === undefined) return <span className="text-zinc-400">—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Oui' : 'Non'}</span>;
  if (typeof value === 'number' || typeof value === 'string') return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-400">—</span>;
    if (value.every(v => typeof v === 'object' && v !== null && 'field' in v && 'op' in v && 'value' in v)) {
      return (
        <ul className="list-disc list-inside space-y-0.5">
          {value.map((rule, i) => (
            <li key={i} className="text-sm">
              <span className="font-medium">{String(rule.field)}</span>{' '}
              <span className="text-zinc-500">{OP_LABELS[rule.op] ?? rule.op}</span>{' '}
              <span className="font-semibold">{String(rule.value)}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ul className={cn('space-y-1', depth === 0 ? 'mt-1' : 'ml-3')}>
        {value.map((item, i) => (
          <li key={i} className="text-sm border-l-2 border-zinc-200 pl-2">
            <HumanJsonValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) return <span className="text-zinc-400">—</span>;
    return (
      <dl className={cn('space-y-1', depth === 0 ? 'mt-1' : 'ml-3')}>
        {entries.map(([k, v]) => (
          <div key={k} className="text-sm">
            <dt className="inline font-medium text-zinc-600">{humanizeJsonKey(k)} :</dt>{' '}
            <dd className="inline"><HumanJsonValue value={v} depth={depth + 1} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{String(value)}</span>;
}

function isJsonField(key: string): boolean {
  return key.endsWith('_json') || key === 'metadata' || key === 'payload' || key === 'config' || key === 'options' || key === 'data';
}

function AuditFieldValue({ fieldKey, value, className, lookups = {} }: { fieldKey: string; value: unknown; className?: string; lookups?: Record<string, LookupMap> }) {
  if (isAuditImageField(fieldKey) && typeof value === 'string' && value) {
    const src = resolvePublicAssetUrl(value);
    return <img src={src} alt={auditFieldLabelFr(fieldKey)} className={cn('w-12 h-12 rounded-lg object-cover', className)} />;
  }
  const resolved = resolveAuditValue(fieldKey, value, lookups);
  if (resolved) return <span className={className}>{resolved}</span>;
  if (isJsonField(fieldKey) && value !== null && value !== undefined && typeof value === 'object') {
    return <div className={className}><HumanJsonValue value={value} /></div>;
  }
  if (isJsonField(fieldKey) && typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return <div className={className}><HumanJsonValue value={parsed} /></div>;
    } catch { /* fall through */ }
  }
  return <span className={className}>{formatAuditFieldValue(fieldKey, value)}</span>;
}

function AuditDiffSection({
  oldValues,
  newValues,
  lookups = {},
}: {
  oldValues: Record<string, unknown> | null | undefined;
  newValues: Record<string, unknown> | null | undefined;
  lookups?: Record<string, LookupMap>;
}) {
  const hasOld = hasAuditPayload(oldValues ?? null);
  const hasNew = hasAuditPayload(newValues ?? null);

  // Creation: no old values — show only new values
  if (!hasOld && hasNew) {
    return (
      <AuditPayloadSection
        heading="Données créées"
        tone="success"
        values={newValues}
        emptyHint=""
        lookups={lookups}
      />
    );
  }

  // Deletion: no new values — show only old values
  if (hasOld && !hasNew) {
    return (
      <AuditPayloadSection
        heading="Données supprimées"
        tone="neutral"
        values={oldValues}
        emptyHint=""
        lookups={lookups}
      />
    );
  }

  // Neither side has data
  if (!hasOld && !hasNew) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-sm text-zinc-600">
        Aucune donnée avant/après enregistrée pour cette action.
      </div>
    );
  }

  // Both sides exist — compute diff (only changed fields)
  const old = oldValues as Record<string, unknown>;
  const nw = newValues as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(old), ...Object.keys(nw)]);
  const changed: { key: string; before: unknown; after: unknown }[] = [];

  for (const key of allKeys) {
    const before = old[key];
    const after = nw[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changed.push({ key, before, after });
    }
  }

  if (changed.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50/90 px-4 py-3 text-sm text-zinc-600">
        Aucun champ modifié détecté.
      </div>
    );
  }

  // Sort using the same helper
  const sorted = changed.sort((a, b) => {
    const la = auditFieldLabelFr(a.key);
    const lb = auditFieldLabelFr(b.key);
    return la.localeCompare(lb, 'fr');
  });

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 pt-3">
        Modifications ({sorted.length} champ{sorted.length > 1 ? 's' : ''})
      </p>
      <dl className="divide-y divide-zinc-100 px-4 pb-3 pt-2">
        {sorted.map(({ key, before, after }) => (
          <div key={key} className="py-3 first:pt-1">
            <dt className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1.5">{auditFieldLabelFr(key)}</dt>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5 inline-block w-5 h-5 rounded-md bg-rose-100 text-rose-600 text-[10px] font-black flex items-center justify-center">−</span>
                <AuditFieldValue fieldKey={key} value={before} className="text-zinc-500 line-through break-words" lookups={lookups} />
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5 inline-block w-5 h-5 rounded-md bg-emerald-100 text-emerald-600 text-[10px] font-black flex items-center justify-center">+</span>
                <AuditFieldValue fieldKey={key} value={after} className="text-zinc-900 font-bold break-words" lookups={lookups} />
              </div>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AuditPayloadSection({
  heading,
  tone,
  values,
  emptyHint,
  lookups = {},
}: {
  heading: string;
  tone: 'neutral' | 'success';
  values: Record<string, unknown> | null | undefined;
  emptyHint: string;
  lookups?: Record<string, LookupMap>;
}) {
  const wrap =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/40'
      : 'border-zinc-200 bg-zinc-50/90';

  if (!hasAuditPayload(values ?? null)) {
    return (
      <div className={cn('rounded-xl border px-4 py-3 text-sm', wrap)}>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{heading}</p>
        <p className="mt-2 text-zinc-600">{emptyHint}</p>
      </div>
    );
  }

  const rows = sortedAuditEntries(values as Record<string, unknown>);
  return (
    <div className={cn('rounded-xl border overflow-hidden', wrap)}>
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-4 pt-3">{heading}</p>
      <dl className="divide-y divide-zinc-100/90 px-4 pb-3 pt-2">
        {rows.map(([key, val]) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,32%)_1fr] gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0">
            <dt className="font-bold text-zinc-600">{auditFieldLabelFr(key)}</dt>
            <dd className="text-zinc-900 break-words"><AuditFieldValue fieldKey={key} value={val} lookups={lookups} /></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function TrackingScreen() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [detail, setDetail] = useState<AuditLogRow | null>(null);
  const [lookups, setLookups] = useState<Record<string, LookupMap>>({});

  const canView = hasPermission('audit_logs.view');

  useEffect(() => {
    (async () => {
      const res = await api.get<{ users: { id: number; name: string }[]; brands: { id: number; name: string }[]; customers: { id: number; name: string }[]; suppliers: { id: number; name: string }[] }>('audit-logs/lookups');
      if (!res.ok || !res.data) return;
      const d = res.data as any;
      const maps: Record<string, LookupMap> = { users: {}, brands: {}, customers: {}, suppliers: {} };
      for (const u of (d.users ?? [])) maps.users[u.id] = u.name;
      for (const b of (d.brands ?? [])) maps.brands[b.id] = b.name;
      for (const c of (d.customers ?? [])) maps.customers[c.id] = c.name;
      for (const s of (d.suppliers ?? [])) maps.suppliers[s.id] = s.name;
      setLookups(maps);
    })();
  }, []);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    const res = await api.get<Paginated<AuditLogRow>>(
      `audit-logs${buildQuery({
        per_page: 100,
        action: action.trim() || undefined,
        entity_type: entityType.trim() || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })}`,
    );
    if (res.ok && res.data) {
      setRows(res.data.data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  }, [canView, action, entityType, dateFrom, dateTo]);

  const entityFilterOpts = useMemo(() => auditEntityFilterOptions(), []);

  const displayed = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => {
      const actionFr = auditActionLabelFr(r.action).toLowerCase();
      const entityFr = auditEntitySummaryFr(r.entity_type, r.entity_id).toLowerCase();
      return (
        actionFr.includes(s) ||
        r.action.toLowerCase().includes(s) ||
        `${r.user?.name ?? ''} ${r.user?.email ?? ''} ${entityFr}`.toLowerCase().includes(s)
      );
    });
  }, [rows, q]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <div className="card p-8 text-center text-sm font-medium text-zinc-600">
        Vous n’avez pas accès au journal d’audit. Contactez un administrateur si nécessaire.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique d’activité"
        subtitle="Journal des opérations enregistrées par le serveur (connexions, créations, modifications). Ce qui se passe uniquement dans le navigateur n’apparaît pas ici."
        right={
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 rounded-2xl border text-sm font-black inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          placeholder="Filtrer par libellé d’action…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="px-4 py-3 rounded-xl border border-zinc-200 text-sm font-bold"
          title="Recherche libre sur le code d’action enregistré côté serveur"
        />
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="px-4 py-3 rounded-xl border border-zinc-200 text-sm font-bold bg-white"
        >
          {entityFilterOpts.map((o) => (
            <option key={o.value || '__all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-4 py-3 rounded-xl border text-sm" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-4 py-3 rounded-xl border text-sm" />
      </div>

      <FilterBar query={q} onQueryChange={setQ} placeholder="Rechercher (action, utilisateur, type d’objet)…" />

      <div className="card divide-y divide-zinc-100">
        {displayed.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setDetail(r)}
            className={cn(
              'w-full text-left px-5 py-4 hover:bg-zinc-50 transition-colors flex flex-col md:flex-row md:items-center md:justify-between gap-2',
            )}
          >
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">
                {new Date(r.created_at).toLocaleString('fr-FR')}
              </p>
              <p className="mt-1 text-sm font-black text-zinc-900">{auditActionLabelFr(r.action)}</p>
              <p className="text-xs text-zinc-600 mt-1">
                {r.user?.name ?? '—'} · {resolveEntityName(r.entity_type, r.entity_id, lookups) ?? auditEntitySummaryFr(r.entity_type, r.entity_id)}
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">{r.ip_address}</span>
          </button>
        ))}
        {displayed.length === 0 && !loading && (
          <p className="p-8 text-center text-sm text-zinc-500">
            Aucune entrée. Les journaux sont créés quand l’API enregistre une action (ex. connexion, commandes, utilisateurs). Réessayez après une action ou vérifiez les filtres ci‑dessus.
          </p>
        )}
      </div>

      <Modal
        open={detail !== null}
        title="Détail du journal"
        subtitle={detail ? auditActionLabelFr(detail.action) : undefined}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-4 max-h-[min(75vh,560px)] overflow-y-auto pr-1">
            <div className="rounded-xl border border-zinc-100 bg-white px-4 py-3 space-y-1.5 text-sm">
              <p>
                <span className="text-zinc-500">Date : </span>
                <span className="font-bold text-zinc-900">{new Date(detail.created_at).toLocaleString('fr-FR')}</span>
              </p>
              <p>
                <span className="text-zinc-500">Action : </span>
                <span className="font-bold text-zinc-900">{auditActionLabelFr(detail.action)}</span>
              </p>
              <p>
                <span className="text-zinc-500">Utilisateur : </span>
                <span className="font-bold text-zinc-900">{detail.user?.name ?? '—'}</span>
                {detail.user?.email ? (
                  <span className="text-zinc-600 font-medium"> ({detail.user.email})</span>
                ) : null}
              </p>
              <p>
                <span className="text-zinc-500">Objet concerné : </span>
                <span className="font-bold text-zinc-900">{resolveEntityName(detail.entity_type, detail.entity_id, lookups) ?? auditEntitySummaryFr(detail.entity_type, detail.entity_id)}</span>
              </p>
              {detail.ip_address ? (
                <p className="text-xs text-zinc-500">
                  IP : <span className="font-mono">{detail.ip_address}</span>
                </p>
              ) : null}
            </div>

            <AuditDiffSection
              oldValues={detail.old_values}
              newValues={detail.new_values}
              lookups={lookups}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
