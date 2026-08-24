import React from 'react';
import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';

export type TableDensity = 'compact' | 'comfortable';

export type Column<T> = {
  /** Optional — auto-derived from index when omitted (needed by legacy callers). */
  key?: string;
  header: React.ReactNode;
  className?: string;
  /** Canonical render function. Legacy callers may pass `accessor` instead. */
  cell?: (row: T) => React.ReactNode;
  /** Legacy alias for `cell` (some screens pass this name). */
  accessor?: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  rows,
  data,
  columns,
  density = 'comfortable',
  loading = false,
  emptyTitle = 'Aucune donnée',
  emptyDescription = "Il n'y a pas encore de données à afficher.",
  emptyAction,
  className,
}: {
  rows?: T[];
  /** Legacy alias for `rows`. */
  data?: T[];
  columns: Column<T>[];
  density?: TableDensity;
  loading?: boolean;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  className?: string;
}) {
  const pad = density === 'compact' ? 'px-5 py-2.5' : 'px-6 py-4';
  // Accept both `rows` (canonical) and `data` (legacy alias) so a caller
  // passing `data={...}` doesn't leave `rows` undefined and blow up on
  // `rows.length`. Same story for `cell` / `accessor` on each column.
  const list: T[] = rows ?? data ?? [];

  return (
    <div className={cn('card overflow-hidden', className)}>
      {loading ? (
        <div className="p-10">
          <div className="h-4 w-40 bg-zinc-100 rounded mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-zinc-100 rounded-xl" />
            ))}
          </div>
        </div>
      ) : list.length === 0 ? (
        <div className="p-6">
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50/60 border-b border-zinc-100">
              <tr>
                {columns.map((c, ci) => (
                  <th
                    key={c.key ?? `c-${ci}`}
                    className={cn(
                      'text-[11px] font-bold text-zinc-400 uppercase tracking-widest whitespace-nowrap',
                      pad,
                      c.className,
                    )}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {list.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                  {columns.map((c, ci) => {
                    const render = c.cell ?? c.accessor;
                    return (
                      <td key={c.key ?? `c-${ci}`} className={cn('align-middle', pad, c.className)}>
                        {render ? render(row) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

