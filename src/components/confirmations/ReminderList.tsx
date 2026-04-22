import React from 'react';
import { Clock } from 'lucide-react';
import { StatusChip } from '../ui/StatusChip';

export type Reminder = {
  id: string;
  at: string; // HH:mm
  label: string;
  meta?: string;
};

export function ReminderList({
  title = 'Relances à faire',
  reminders,
  onOpen,
}: {
  title?: string;
  reminders: Reminder[];
  onOpen?: (id: string) => void;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-zinc-900">{title}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Aujourd’hui • priorités opérationnelles.</p>
        </div>
        <StatusChip tone={reminders.length === 0 ? 'success' : 'warning'}>
          <Clock className="w-3 h-3" /> {reminders.length}
        </StatusChip>
      </div>

      <div className="mt-5 divide-y divide-zinc-100">
        {reminders.length === 0 ? (
          <div className="py-8 text-center text-sm font-medium text-zinc-500">Aucune relance due.</div>
        ) : (
          reminders.map((r) => (
            <button
              key={r.id}
              onClick={() => onOpen?.(r.id)}
              className="w-full text-left py-4 hover:bg-zinc-50/60 transition-colors rounded-xl px-2 -mx-2"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 truncate">{r.label}</p>
                  {r.meta && <p className="mt-1 text-[11px] font-medium text-zinc-500 truncate">{r.meta}</p>}
                </div>
                <StatusChip tone="warning">{r.at}</StatusChip>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

