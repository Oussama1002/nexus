import React from 'react';
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Info, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { pathForView, VIEW_PATH } from '../../lib/appPaths';
import type { View } from '../../types';

export type DashboardNotification = {
  id: string;
  severity: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  body: string;
  link?: string | null;
  count?: number;
  occurred_at: string;
};

type NotificationsPayload = {
  items: DashboardNotification[];
  summary: { total: number; danger: number; warning: number };
};

const SEVERITY_STYLES: Record<
  DashboardNotification['severity'],
  { icon: React.ComponentType<{ className?: string }>; ring: string; bg: string; text: string }
> = {
  danger: { icon: AlertCircle, ring: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-800' },
  warning: { icon: AlertTriangle, ring: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-900' },
  info: { icon: Info, ring: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-900' },
  success: { icon: CheckCircle2, ring: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-900' },
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
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function isViewKey(link: string): link is Exclude<View, 'login' | 'settings'> {
  return Object.prototype.hasOwnProperty.call(VIEW_PATH, link);
}

export function DashboardNotificationsSection({
  data,
  loading,
}: {
  data: NotificationsPayload | null;
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const items = data?.items ?? [];
  const summary = data?.summary;

  const goTo = (link: string | null | undefined) => {
    if (!link) return;
    if (link.startsWith('/')) {
      navigate(link);
      return;
    }
    if (isViewKey(link)) {
      navigate(pathForView(link as Exclude<View, 'login' | 'settings'>));
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-600 text-white">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-black text-[color:var(--color-text-0)]">Notifications</p>
            <p className="mt-0.5 text-xs font-medium text-[color:var(--color-text-2)]">
              Alertes opérationnelles selon vos droits (commandes, leads, stock, etc.)
            </p>
          </div>
        </div>
        {summary && summary.total > 0 ? (
          <div className="flex items-center gap-2 shrink-0">
            {summary.danger > 0 ? (
              <span className="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-black uppercase">
                {summary.danger} urgent{summary.danger > 1 ? 's' : ''}
              </span>
            ) : null}
            {summary.warning > 0 ? (
              <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 text-[10px] font-black uppercase">
                {summary.warning} attention
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading && !data ? (
        <p className="mt-6 text-sm font-bold text-zinc-500">Chargement des notifications…</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="mt-3 text-sm font-bold text-zinc-700">Aucune alerte pour le moment</p>
          <p className="mt-1 text-xs text-zinc-500">Les nouvelles actions à traiter apparaîtront ici.</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-zinc-100">
          {items.map((n) => {
            const style = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
            const Icon = style.icon;
            const clickable = Boolean(n.link);

            return (
              <li key={n.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => goTo(n.link)}
                  className={cn(
                    'w-full flex items-start gap-3 py-4 text-left transition-colors rounded-xl',
                    clickable && 'hover:bg-zinc-50 px-2 -mx-2',
                    !clickable && 'cursor-default',
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 p-2 rounded-xl border',
                      style.ring,
                      style.bg,
                      style.text,
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-zinc-900">{n.title}</span>
                      {(n.count ?? 0) > 1 ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                          ×{n.count}
                        </span>
                      ) : null}
                    </span>
                    <span className="block mt-0.5 text-xs font-medium text-zinc-600">{n.body}</span>
                    <span className="block mt-1 text-[10px] font-bold text-zinc-400">
                      {formatRelativeTime(n.occurred_at)}
                    </span>
                  </span>
                  {clickable ? (
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0 mt-1" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
