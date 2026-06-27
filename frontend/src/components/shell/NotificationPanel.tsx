import React, { useEffect, useRef } from 'react';
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { pathForView, VIEW_PATH } from '../../lib/appPaths';
import type { View } from '../../types';

export type NotificationItem = {
  id: string;
  severity: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  body: string;
  link?: string | null;
  count?: number;
  occurred_at: string;
};

type NotificationsPayload = {
  items: NotificationItem[];
  summary: { total: number; danger: number; warning: number };
};

const SEVERITY_STYLES: Record<
  NotificationItem['severity'],
  { icon: React.ComponentType<{ className?: string }>; ring: string; bg: string; text: string }
> = {
  danger: { icon: AlertCircle, ring: 'border-rose-200', bg: 'bg-rose-50', text: 'text-rose-700' },
  warning: { icon: AlertTriangle, ring: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800' },
  info: { icon: Info, ring: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
  success: { icon: CheckCircle2, ring: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
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

export function NotificationPanel({
  open,
  onClose,
  data,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  data: NotificationsPayload | null;
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const items = data?.items ?? [];
  const summary = data?.summary;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const goTo = (link: string | null | undefined) => {
    if (!link) return;
    onClose();
    if (link.startsWith('/')) {
      navigate(link);
      return;
    }
    if (isViewKey(link)) {
      navigate(pathForView(link as Exclude<View, 'login' | 'settings'>));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="fixed inset-0 bg-black/20" />
      <div
        ref={panelRef}
        className="absolute top-16 right-8 w-[400px] max-h-[calc(100vh-5rem)] bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-zinc-600" />
            <h3 className="text-sm font-black text-zinc-900">Notifications</h3>
            {summary && summary.total > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black">
                {summary.total}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && !data ? (
            <p className="px-5 py-8 text-sm font-bold text-zinc-500 text-center">Chargement...</p>
          ) : items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="mt-3 text-sm font-bold text-zinc-700">Aucune notification</p>
              <p className="mt-1 text-xs text-zinc-500">Tout est en ordre pour le moment.</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
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
                        'w-full flex items-start gap-3 px-5 py-3.5 text-left transition-colors',
                        clickable && 'hover:bg-zinc-50 cursor-pointer',
                        !clickable && 'cursor-default',
                      )}
                    >
                      <span className={cn('shrink-0 p-1.5 rounded-lg border', style.ring, style.bg, style.text)}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-zinc-900">{n.title}</span>
                          {(n.count ?? 0) > 1 && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                              x{n.count}
                            </span>
                          )}
                        </span>
                        <span className="block mt-0.5 text-xs text-zinc-600">{n.body}</span>
                        <span className="block mt-1 text-[10px] font-bold text-zinc-400">
                          {formatRelativeTime(n.occurred_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
