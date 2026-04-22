import React from 'react';
import { cn } from '../../lib/utils';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneStyles: Record<StatusTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger: 'bg-rose-50 text-rose-700 border-rose-100',
  info: 'bg-blue-50 text-blue-700 border-blue-100',
};

export function StatusChip({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

