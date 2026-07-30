import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export type NavItem = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  path?: string;
};

export type NavGroup = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

const GroupSection: React.FC<{
  group: NavGroup;
  sidebarOpen: boolean;
}> = ({ group, sidebarOpen }) => {
  const hasActiveItem = group.items.some((it) => it.active);
  const [expanded, setExpanded] = useState(hasActiveItem || group.items.length === 1);

  useEffect(() => {
    if (hasActiveItem) setExpanded(true);
  }, [hasActiveItem]);

  const isSingle = group.items.length === 1;
  const singleItem = isSingle ? group.items[0] : null;

  if (isSingle && singleItem) {
    return (
      <button
        onClick={singleItem.onClick}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-left',
          singleItem.active
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        )}
        aria-current={singleItem.active ? 'page' : undefined}
      >
        {group.icon && (
          <group.icon
            className={cn('w-[18px] h-[18px]', singleItem.active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-700')}
          />
        )}
        {sidebarOpen && <span className="font-semibold text-[13px]">{group.label}</span>}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-left',
          hasActiveItem
            ? 'bg-primary-50 text-primary-700'
            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
        )}
      >
        {group.icon && (
          <group.icon
            className={cn('w-[18px] h-[18px] shrink-0', hasActiveItem ? 'text-primary-600' : 'text-zinc-400 group-hover:text-zinc-700')}
          />
        )}
        {sidebarOpen && (
          <>
            <span className="flex-1 font-semibold text-[13px]">{group.label}</span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-zinc-400 transition-transform duration-200',
                expanded && 'rotate-180',
              )}
            />
          </>
        )}
      </button>

      {sidebarOpen && expanded && (
        <div className="mt-0.5 ml-4 pl-3 border-l-2 border-zinc-100 space-y-0.5">
          {group.items.map((it) => (
            <button
              key={it.id}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  if (it.path) window.open(it.path, '_blank');
                  return;
                }
                it.onClick();
              }}
              onAuxClick={(e) => {
                if (e.button === 1 && it.path) {
                  e.preventDefault();
                  window.open(it.path, '_blank');
                }
              }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group/item text-left',
                it.active
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
              )}
              aria-current={it.active ? 'page' : undefined}
            >
              {it.icon && (
                <it.icon
                  className={cn('w-4 h-4', it.active ? 'text-white' : 'text-zinc-400 group-hover/item:text-zinc-600')}
                />
              )}
              <span className="flex-1 font-medium text-[12.5px]">{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const active = navRef.current?.querySelector('[aria-current="page"]');
      if (active) {
        active.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [groups]);

  return (
    <aside
      className={cn(
        'bg-white border-r border-zinc-100 h-screen transition-all duration-300 flex flex-col z-50 sticky top-0 shrink-0',
        open ? 'w-72' : 'w-20',
      )}
    >
      <div className="p-6 pb-2">{header}</div>
      <nav ref={navRef} className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {groups.map((g) => (
          <GroupSection key={g.id} group={g} sidebarOpen={open} />
        ))}
      </nav>
      {footer && <div className="p-4 border-t border-zinc-100">{footer}</div>}
    </aside>
  );
}
