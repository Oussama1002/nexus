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
  panelClassName,
  bodyClassName,
}: {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  /** e.g. max-w-4xl for wide forms */
  panelClassName?: string;
  bodyClassName?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        className={cn(
          'w-full max-w-xl my-auto bg-white rounded-[var(--radius-lg)] border border-[color:var(--color-border)] shadow-[var(--shadow-overlay)] overflow-hidden flex flex-col max-h-[min(90dvh,calc(100vh-1.5rem))]',
          panelClassName,
        )}
      >
        <div className="shrink-0 p-4 sm:p-5 border-b border-[color:var(--color-border-subtle)] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-[color:var(--color-text-0)]">{title}</p>
            {subtitle && <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={cn('p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 overscroll-contain', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div
            className={cn(
              'shrink-0 p-4 sm:p-5 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-2)]',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

