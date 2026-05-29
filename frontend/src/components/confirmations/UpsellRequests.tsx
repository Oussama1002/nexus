import React from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { StatusChip } from '../ui/StatusChip';

export type UpsellRequest = {
  id: string;
  customer: string;
  brand: string;
  requested: string;
  priority: 'Normal' | 'Urgent';
};

export function UpsellRequests({
  items,
  onOpen,
}: {
  items: UpsellRequest[];
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-zinc-900">Demandes upsell</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Opportunités à traiter rapidement.</p>
        </div>
        <StatusChip tone={items.length === 0 ? 'success' : 'info'}>
          <Sparkles className="w-3 h-3" /> {items.length}
        </StatusChip>
      </div>

      <div className="mt-5 divide-y divide-zinc-100">
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm font-medium text-zinc-500">Aucune demande upsell.</div>
        ) : (
          items.map((u) => (
            <button
              key={u.id}
              onClick={() => onOpen?.(u.id)}
              className="w-full text-left py-4 hover:bg-zinc-50/60 transition-colors rounded-xl px-2 -mx-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{u.customer}</p>
                  <p className="mt-1 text-[11px] font-medium text-zinc-500 truncate">
                    {u.brand} • {u.requested}
                  </p>
                  <div className="mt-2">
                    <StatusChip tone={u.priority === 'Urgent' ? 'danger' : 'info'}>{u.priority}</StatusChip>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 shrink-0 mt-1" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

