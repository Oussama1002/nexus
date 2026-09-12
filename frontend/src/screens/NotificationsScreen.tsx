import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { pathForView, VIEW_PATH } from '../lib/appPaths';
import type { View } from '../types';
import * as api from '../lib/api';

type NotificationItem = {
  id: string;
  severity: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  body: string;
  link?: string | null;
  count?: number;
  occurred_at: string;
};

type Payload = {
  items: NotificationItem[];
  summary: { total: number; danger: number; warning: number };
};

const SEVERITY = {
  danger: { Icon: AlertCircle, ring: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-700', chip: 'bg-rose-100 text-rose-700' },
  warning: { Icon: AlertTriangle, ring: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', chip: 'bg-amber-100 text-amber-800' },
  info: { Icon: Info, ring: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700', chip: 'bg-blue-100 text-blue-700' },
  success: { Icon: CheckCircle2, ring: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-700' },
} as const;

const SEVERITY_LABELS: Record<NotificationItem['severity'], string> = {
  danger: 'Critique',
  warning: 'Alerte',
  info: 'Information',
  success: 'Succès',
};

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isViewKey(link: string): link is Exclude<View, 'login' | 'settings'> {
  return Object.prototype.hasOwnProperty.call(VIEW_PATH, link);
}

export function NotificationsScreen() {
  const navigate = useNavigate();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<'all' | NotificationItem['severity']>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Payload>('notifications');
    if (res.ok && res.data) setData(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh every 60s while the tab is visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (severityFilter === 'all') return data.items;
    return data.items.filter((n) => n.severity === severityFilter);
  }, [data, severityFilter]);

  const openLink = (link?: string | null) => {
    if (!link) return;
    if (link.startsWith('/')) { navigate(link); return; }
    if (isViewKey(link)) { navigate(pathForView(link)); return; }
  };

  const counts = data?.summary ?? { total: 0, danger: 0, warning: 0 };
  const infoCount = data?.items.filter((n) => n.severity === 'info').length ?? 0;
  const successCount = data?.items.filter((n) => n.severity === 'success').length ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={loading ? 'Chargement…' : `${counts.total} notification${counts.total > 1 ? 's' : ''} au total`}
        right={
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            title="Actualiser"
          >
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryTile label="Critiques" value={counts.danger} tone="danger" active={severityFilter === 'danger'} onClick={() => setSeverityFilter((f) => f === 'danger' ? 'all' : 'danger')} />
        <SummaryTile label="Alertes" value={counts.warning} tone="warning" active={severityFilter === 'warning'} onClick={() => setSeverityFilter((f) => f === 'warning' ? 'all' : 'warning')} />
        <SummaryTile label="Infos" value={infoCount} tone="info" active={severityFilter === 'info'} onClick={() => setSeverityFilter((f) => f === 'info' ? 'all' : 'info')} />
        <SummaryTile label="Succès" value={successCount} tone="success" active={severityFilter === 'success'} onClick={() => setSeverityFilter((f) => f === 'success' ? 'all' : 'success')} />
      </div>

      {severityFilter !== 'all' && (
        <button
          onClick={() => setSeverityFilter('all')}
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          ← Voir toutes les notifications
        </button>
      )}

      {loading && !data ? (
        <div className="text-sm text-zinc-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={severityFilter === 'all' ? 'Aucune notification' : `Aucune notification de type ${SEVERITY_LABELS[severityFilter]}`}
          description="Vous êtes à jour."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const s = SEVERITY[n.severity];
            const Icon = s.Icon;
            const clickable = !!n.link;
            return (
              <div
                key={n.id}
                onClick={clickable ? () => openLink(n.link) : undefined}
                className={`bg-white rounded-2xl border ${s.ring} p-4 flex items-start gap-3 ${clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              >
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <Icon className={`w-5 h-5 ${s.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-zinc-900">{n.title}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.chip}`}>
                      {SEVERITY_LABELS[n.severity]}
                    </span>
                    {n.count && n.count > 1 && (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
                        ×{n.count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 mt-1 whitespace-pre-wrap">{n.body}</p>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-2">
                    <span>{formatRelativeTime(n.occurred_at)}</span>
                    {clickable && <span className="text-blue-600 font-semibold">→ Ouvrir</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone, active, onClick }: {
  label: string; value: number; tone: 'danger' | 'warning' | 'info' | 'success'; active: boolean; onClick: () => void;
}) {
  const toneMap = {
    danger: 'from-rose-50 to-rose-100 text-rose-800',
    warning: 'from-amber-50 to-amber-100 text-amber-800',
    info: 'from-blue-50 to-blue-100 text-blue-800',
    success: 'from-emerald-50 to-emerald-100 text-emerald-800',
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl bg-gradient-to-br ${toneMap[tone]} p-4 text-left transition ${active ? 'ring-2 ring-offset-2 ring-zinc-900' : 'hover:shadow-md'}`}
    >
      <div className="text-xs uppercase font-bold opacity-80">{label}</div>
      <div className="text-3xl font-black mt-1">{value}</div>
    </button>
  );
}

export default NotificationsScreen;
