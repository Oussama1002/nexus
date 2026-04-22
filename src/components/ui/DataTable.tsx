import React from 'react';
import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';

export type TableDensity = 'compact' | 'comfortable';

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  className?: string;
  cell: (row: T) => React.ReactNode;
};

export function DataTable<T>({
  rows,
  columns,
  density = 'comfortable',
  loading = false,
  emptyTitle = 'Aucune donnée',
  emptyDescription = "Il n'y a pas encore de données à afficher.",
  className,
}: {
  rows: T[];
  columns: Column<T>[];
  density?: TableDensity;
  loading?: boolean;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  className?: string;
}) {
  const pad = density === 'compact' ? 'px-5 py-2.5' : 'px-6 py-4';

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
      ) : rows.length === 0 ? (
        <div className="p-6">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50/60 border-b border-zinc-100">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
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
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('align-middle', pad, c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

