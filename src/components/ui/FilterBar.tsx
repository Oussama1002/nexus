import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function FilterBar({
  query,
  onQueryChange,
  left,
  right,
  onClear,
  className,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('card p-4 flex items-center gap-4', className)}>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="relative flex-1 min-w-[280px] max-w-[520px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
            placeholder="Rechercher… (commande, client, colis, téléphone)"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onQueryChange('');
                onClear?.();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-zinc-200/60 text-zinc-500"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {left && <div className="flex items-center gap-3">{left}</div>}
      </div>
      {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
    </div>
  );
}

