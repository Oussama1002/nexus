import React from 'react';
import { cn } from '../../lib/utils';

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card p-12 text-center', className)}>
      {icon && <div className="mb-4 flex justify-center text-[color:var(--color-text-2)]">{icon}</div>}
      <p className="font-display text-lg text-[color:var(--color-text-0)]">{title}</p>
      {description && <p className="mt-2 text-sm text-[color:var(--color-text-2)] max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

