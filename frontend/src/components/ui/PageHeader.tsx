import React from 'react';
import { cn } from '../../lib/utils';

export function PageHeader({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  /** Backward-compat alias for `right`. Several screens pass action buttons as children. */
  children?: React.ReactNode;
  className?: string;
}) {
  const actions = right ?? children;
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6', className)}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[color:var(--color-text-0)] truncate">{title}</h1>
        {subtitle && <p className="mt-1 text-sm font-medium text-[color:var(--color-text-2)]">{subtitle}</p>}
      </div>
      {actions && <div className="shrink-0 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
