import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Modal({
  open,
  title,
  subtitle,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white rounded-[var(--radius-lg)] border border-[color:var(--color-border)] shadow-[var(--shadow-overlay)] overflow-hidden">
        <div className="p-5 border-b border-[color:var(--color-border-subtle)] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-[color:var(--color-text-0)]">{title}</p>
            {subtitle && <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">{children}</div>

        {footer && (
          <div className={cn('p-5 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-2)]')}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

