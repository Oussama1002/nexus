import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { View } from '../../types';

export type NavTreeNode = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  view?: View;
  level: 1 | 2 | 3;
  active: boolean;
  path?: string;
  onClick?: () => void;
  children: NavTreeNode[];
};

export type NavBlock = {
  id: string;
  label: string;
  sections: NavTreeNode[];
};

const COLLAPSE_KEY = 'nexus:nav-collapse';

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCollapsed(state: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

const L3Item: React.FC<{ node: NavTreeNode; sidebarOpen: boolean }> = ({ node, sidebarOpen }) => {
  if (!sidebarOpen) return null;
  return (
    <button
      onClick={(e) => {
        if ((e.ctrlKey || e.metaKey) && node.path) { window.open(node.path, '_blank'); return; }
        node.onClick?.();
      }}
      onAuxClick={(e) => { if (e.button === 1 && node.path) { e.preventDefault(); window.open(node.path, '_blank'); } }}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 group/l3 text-left',
        node.active
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800',
      )}
      aria-current={node.active ? 'page' : undefined}
    >
      {node.icon && <node.icon className={cn('w-3.5 h-3.5 shrink-0', node.active ? 'text-white' : 'text-zinc-300 group-hover/l3:text-zinc-500')} />}
      <span className="flex-1 font-medium text-[11.5px] truncate">{node.label}</span>
    </button>
  );
};

const L2Item: React.FC<{
  node: NavTreeNode;
  sidebarOpen: boolean;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
}> = ({ node, sidebarOpen, collapsed, onToggle }) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = !collapsed[node.id];
  const hasActiveChild = node.children.some((c) => c.active);

  if (hasChildren && sidebarOpen) {
    return (
      <div>
        <button
          onClick={() => onToggle(node.id)}
          className={cn(
            'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group/l2 text-left',
            hasActiveChild || node.active
              ? 'text-primary-700 bg-primary-50/60'
              : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
          )}
        >
          {node.icon && <node.icon className={cn('w-4 h-4 shrink-0', hasActiveChild || node.active ? 'text-primary-600' : 'text-zinc-400 group-hover/l2:text-zinc-600')} />}
          <span className="flex-1 font-medium text-[12px] truncate">{node.label}</span>
          <ChevronDown className={cn('w-3 h-3 text-zinc-400 transition-transform duration-200', isExpanded && 'rotate-180')} />
        </button>
        {isExpanded && (
          <div className="mt-0.5 ml-5 pl-2.5 border-l border-zinc-100 space-y-0.5">
            {node.children.map((child) => (
              <L3Item key={child.id} node={child} sidebarOpen={sidebarOpen} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        if ((e.ctrlKey || e.metaKey) && node.path) { window.open(node.path, '_blank'); return; }
        node.onClick?.();
      }}
      onAuxClick={(e) => { if (e.button === 1 && node.path) { e.preventDefault(); window.open(node.path, '_blank'); } }}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 group/item text-left',
        node.active
          ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
      )}
      aria-current={node.active ? 'page' : undefined}
    >
      {node.icon && <node.icon className={cn('w-4 h-4 shrink-0', node.active ? 'text-white' : 'text-zinc-400 group-hover/item:text-zinc-600')} />}
      {sidebarOpen && <span className="flex-1 font-medium text-[12.5px] truncate">{node.label}</span>}
    </button>
  );
};

const L1Section: React.FC<{
  node: NavTreeNode;
  sidebarOpen: boolean;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
}> = ({ node, sidebarOpen, collapsed, onToggle }) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = !collapsed[node.id];
  const hasActiveDescendant = node.active;

  if (!hasChildren) {
    return (
      <button
        onClick={(e) => {
          if ((e.ctrlKey || e.metaKey) && node.path) { window.open(node.path, '_blank'); return; }
          node.onClick?.();
        }}
        onAuxClick={(e) => { if (e.button === 1 && node.path) { e.preventDefault(); window.open(node.path, '_blank'); } }}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-left',
          node.active
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        )}
        aria-current={node.active ? 'page' : undefined}
      >
        {node.icon && <node.icon className={cn('w-[18px] h-[18px] shrink-0', node.active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-700')} />}
        {sidebarOpen && <span className="font-semibold text-[13px]">{node.label}</span>}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => onToggle(node.id)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group text-left',
          hasActiveDescendant
            ? 'bg-primary-50 text-primary-700'
            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
        )}
      >
        {node.icon && <node.icon className={cn('w-[18px] h-[18px] shrink-0', hasActiveDescendant ? 'text-primary-600' : 'text-zinc-400 group-hover:text-zinc-700')} />}
        {sidebarOpen && (
          <>
            <span className="flex-1 font-semibold text-[13px]">{node.label}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-400 transition-transform duration-200', isExpanded && 'rotate-180')} />
          </>
        )}
      </button>
      {sidebarOpen && isExpanded && (
        <div className="mt-0.5 ml-4 pl-3 border-l-2 border-zinc-100 space-y-0.5">
          {node.children.map((child) => (
            <L2Item key={child.id} node={child} sidebarOpen={sidebarOpen} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
};

const BlockSeparator: React.FC<{ label: string; sidebarOpen: boolean }> = ({ label, sidebarOpen }) => {
  if (!sidebarOpen) {
    return <div className="my-2 mx-4 h-px bg-zinc-100" />;
  }
  return (
    <div className="pt-4 pb-1 px-4 first:pt-0">
      <span className="text-[10px] font-black tracking-[0.1em] text-zinc-300 uppercase select-none">
        {label}
      </span>
    </div>
  );
};

export function SidebarNav({
  open,
  blocks,
  header,
  footer,
}: {
  open: boolean;
  blocks: NavBlock[];
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const navRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  const handleToggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveCollapsed(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const active = navRef.current?.querySelector('[aria-current="page"]');
      if (active) {
        active.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [blocks]);

  useEffect(() => {
    const expandParentsOfActive = () => {
      const current = loadCollapsed();
      let changed = false;
      for (const block of blocks) {
        for (const section of block.sections) {
          if (section.active && current[section.id]) {
            current[section.id] = false;
            changed = true;
          }
          for (const child of section.children) {
            if ((child.active || child.children.some((c) => c.active)) && current[child.id]) {
              current[child.id] = false;
              changed = true;
            }
          }
        }
      }
      if (changed) {
        saveCollapsed(current);
        setCollapsed(current);
      }
    };
    expandParentsOfActive();
  }, [blocks]);

  return (
    <aside
      className={cn(
        'bg-white border-r border-zinc-100 h-screen transition-all duration-300 flex flex-col z-50 sticky top-0 shrink-0',
        open ? 'w-72' : 'w-20',
      )}
    >
      <div className="p-6 pb-2">{header}</div>
      <nav ref={navRef} className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
        {blocks.map((block) => (
          <div key={block.id}>
            <BlockSeparator label={block.label} sidebarOpen={open} />
            <div className="space-y-0.5">
              {block.sections.map((section) => (
                <L1Section
                  key={section.id}
                  node={section}
                  sidebarOpen={open}
                  collapsed={collapsed}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div className="p-4 border-t border-zinc-100">{footer}</div>}
    </aside>
  );
}
