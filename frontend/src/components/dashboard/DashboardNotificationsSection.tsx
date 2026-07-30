import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Filter,
  Info,
  Package,
  Truck,
  FileWarning,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { pathForView, VIEW_PATH } from '../../lib/appPaths';
import type { View } from '../../types';

export type DashboardNotification = {
  id: string;
  severity: 'danger' | 'warning' | 'info' | 'success';
  priority?: 'P1' | 'P2' | 'P3';
  category?: 'incident' | 'reclamation' | 'livraison' | 'notification';
  title: string;
  body: string;
  link?: string | null;
  count?: number;
  occurred_at: string;
};

type NotificationsPayload = {
  items: DashboardNotification[];
  summary: { total: number; p1?: number; p2?: number; p3?: number; danger: number; warning: number };
};

const PRIORITY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  P1: { label: 'P1', bg: 'bg-rose-600', text: 'text-white', border: 'border-rose-500' },
  P2: { label: 'P2', bg: 'bg-amber-500', text: 'text-white', border: 'border-amber-400' },
  P3: { label: 'P3', bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-400' },
};

const SEVERITY_STYLES: Record<
  DashboardNotification['severity'],
  { icon: React.ComponentType<{ className?: string }>; ring: string; bg: string; text: string }
> = {
  danger: { icon: AlertCircle, ring: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-700' },
  warning: { icon: AlertTriangle, ring: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
  info: { icon: Info, ring: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
  success: { icon: CheckCircle2, ring: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

const CATEGORY_META: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  incident: { icon: Zap, label: 'Incident' },
  reclamation: { icon: FileWarning, label: 'Réclamation' },
  livraison: { icon: Truck, label: 'Livraison' },
  notification: { icon: Bell, label: 'Notification' },
};

type FilterKey = 'all' | 'P1' | 'P2' | 'P3';

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
  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((n) => n.priority === filter);
  }, [items, filter]);

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

  const p1Count = summary?.p1 ?? items.filter((n) => n.priority === 'P1').length;
  const p2Count = summary?.p2 ?? items.filter((n) => n.priority === 'P2').length;
  const p3Count = summary?.p3 ?? items.filter((n) => n.priority === 'P3').length;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black">Journal des événements</p>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-400">
                Incidents, réclamations, livraison, notifications
              </p>
            </div>
          </div>
          {summary && summary.total > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              {p1Count > 0 && (
                <span className="px-2 py-1 rounded-md bg-rose-600 text-[10px] font-black uppercase tracking-wide">
                  {p1Count} P1
                </span>
              )}
              {p2Count > 0 && (
                <span className="px-2 py-1 rounded-md bg-amber-500 text-[10px] font-black uppercase tracking-wide">
                  {p2Count} P2
                </span>
              )}
              {p3Count > 0 && (
                <span className="px-2 py-1 rounded-md bg-blue-500/80 text-[10px] font-black uppercase tracking-wide">
                  {p3Count} P3
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-2.5 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-zinc-400" />
        {(['all', 'P1', 'P2', 'P3'] as const).map((f) => {
          const count = f === 'all' ? items.length : f === 'P1' ? p1Count : f === 'P2' ? p2Count : p3Count;
          const label = f === 'all' ? 'Tout' : f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all',
                filter === f
                  ? f === 'P1' ? 'bg-rose-600 text-white'
                    : f === 'P2' ? 'bg-amber-500 text-white'
                    : f === 'P3' ? 'bg-blue-500 text-white'
                    : 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200',
              )}
            >
              {label}
              {count > 0 && <span className="ml-1 opacity-80">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="px-6">
        {loading && !data ? (
          <div className="py-8">
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-48 bg-zinc-100 rounded" />
                    <div className="h-3 w-72 bg-zinc-50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="mt-3 text-sm font-bold text-zinc-700">
              {filter === 'all' ? 'Aucun événement' : `Aucun événement ${filter}`}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Les nouvelles alertes apparaîtront ici.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map((n) => {
              const style = SEVERITY_STYLES[n.severity] ?? SEVERITY_STYLES.info;
              const Icon = style.icon;
              const pStyle = PRIORITY_STYLES[n.priority ?? 'P3'] ?? PRIORITY_STYLES.P3;
              const catMeta = CATEGORY_META[n.category ?? 'notification'] ?? CATEGORY_META.notification;
              const CatIcon = catMeta.icon;
              const clickable = Boolean(n.link);

              return (
                <button
                  key={n.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => goTo(n.link)}
                  className={cn(
                    'w-full flex items-start gap-3 py-3.5 text-left transition-all group',
                    clickable && 'hover:bg-zinc-50 px-2 -mx-2 rounded-xl',
                    !clickable && 'cursor-default',
                  )}
                >
                  {/* Priority badge + severity icon */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-black leading-none', pStyle.bg, pStyle.text)}>
                      {pStyle.label}
                    </span>
                    <span className={cn('p-1.5 rounded-lg border', style.ring, style.bg, style.text)}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-black text-zinc-900">{n.title}</span>
                      {(n.count ?? 0) > 1 && (
                        <span className="text-[10px] font-black text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                          ×{n.count}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] font-medium text-zinc-600 leading-snug">{n.body}</p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase">
                        <CatIcon className="w-3 h-3" />
                        {catMeta.label}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {formatRelativeTime(n.occurred_at)}
                      </span>
                    </div>
                  </div>

                  {clickable && (
                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 shrink-0 mt-2 transition-colors" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
