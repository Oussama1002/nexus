import React from 'react';
import { Bell, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Topbar({
  left,
  brandPill,
  onSearchClick,
  right,
}: {
  left?: React.ReactNode;
  brandPill?: React.ReactNode;
  onSearchClick?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-zinc-100 flex items-center justify-between px-8 z-40 shrink-0 sticky top-0">
      <div className="flex items-center gap-4 min-w-0">{left}</div>

      <div className="flex items-center gap-6 shrink-0">
        {brandPill}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn('relative p-2.5 text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors')}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 border-2 border-white rounded-full" />
          </button>
          <button
            type="button"
            onClick={onSearchClick}
            className="p-2.5 text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
        {right}
      </div>
    </header>
  );
}

