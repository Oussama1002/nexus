import React from 'react';
import { cn } from '../../lib/utils';

export type NavItem = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export function SidebarNav({
  open,
  groups,
  header,
  footer,
}: {
  open: boolean;
  groups: NavGroup[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        'bg-white border-r border-zinc-100 h-screen transition-all duration-300 flex flex-col z-50 sticky top-0 shrink-0',
        open ? 'w-72' : 'w-20',
      )}
    >
      <div className="p-6 pb-2">{header}</div>
      <nav className="flex-1 px-4 py-8 space-y-8 overflow-y-auto scrollbar-hide">
        {groups.map((g) => (
          <div key={g.id} className="space-y-2">
            {open && <p className="px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">{g.label}</p>}
            <div className="space-y-1">
              {g.items.map((it) => (
                <button
                  key={it.id}
                  onClick={it.onClick}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-left',
                    it.active
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
                  )}
                  aria-current={it.active ? 'page' : undefined}
                >
                  {it.icon && (
                    <it.icon
                      className={cn('w-5 h-5', it.active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-900')}
                    />
                  )}
                  {open && <span className="font-medium text-sm">{it.label}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div className="p-4 border-t border-zinc-100">{footer}</div>}
    </aside>
  );
}

