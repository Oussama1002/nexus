import React from 'react';
import { cn } from '../../lib/utils';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('card p-10 text-center', className)}>
      <p className="text-sm font-bold text-[color:var(--color-text-0)]">{title}</p>
      {description && <p className="mt-2 text-sm font-medium text-[color:var(--color-text-2)]">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

