import React from 'react';
import { cn } from '../../lib/utils';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'blue' | 'pink' | 'purple';

const toneStyles: Record<StatusTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-600 border-zinc-200/70',
  success: 'bg-[color:var(--color-success-50)] text-[color:var(--color-success-600)] border-[color:var(--color-success-600)]/15',
  warning: 'bg-[color:var(--color-warning-50)] text-[color:var(--color-warning-600)] border-[color:var(--color-warning-600)]/15',
  danger: 'bg-[color:var(--color-danger-50)] text-[color:var(--color-danger-600)] border-[color:var(--color-danger-600)]/15',
  info: 'bg-[color:var(--color-accent-50)] text-[color:var(--color-accent-700)] border-[color:var(--color-accent-600)]/20',
  // Couleurs fixes des statuts de commande (spec Confirmatrice §6.2).
  blue: 'bg-blue-50 text-blue-700 border-blue-600/15',
  pink: 'bg-pink-50 text-pink-700 border-pink-500/15',
  purple: 'bg-purple-50 text-purple-700 border-purple-600/15',
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em]',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

