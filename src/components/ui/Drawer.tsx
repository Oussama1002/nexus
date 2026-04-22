import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Drawer({
  open,
  title,
  subtitle,
  children,
  footer,
  onClose,
  widthClassName = 'w-[520px]',
}: {
  open: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  widthClassName?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[999]">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside
        className={cn(
          'absolute right-0 top-0 h-full bg-white border-l border-[color:var(--color-border)] shadow-[var(--shadow-overlay)] flex flex-col',
          widthClassName,
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 border-b border-[color:var(--color-border-subtle)] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-black text-[color:var(--color-text-0)] truncate">{title}</p>
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

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && <div className="p-5 border-t border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-2)]">{footer}</div>}
      </aside>
    </div>
  );
}

