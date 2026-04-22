import React from 'react';
import { StatusChip } from '../ui/StatusChip';

export function ConfirmatriceStats({
  confirmationRate,
  volume,
  confirmed,
  cancelled,
  avgHandleMins,
}: {
  confirmationRate: number;
  volume: number;
  confirmed: number;
  cancelled: number;
  avgHandleMins: number;
}) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-zinc-900">Performance</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Aperçu journée (confirmatrice).</p>
        </div>
        <StatusChip tone={confirmationRate >= 85 ? 'success' : confirmationRate >= 70 ? 'warning' : 'danger'}>
          {confirmationRate.toFixed(1)}% Tx conf
        </StatusChip>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card-muted p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Volume traité</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{volume}</p>
        </div>
        <div className="card-muted p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Délai moyen</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{avgHandleMins} min</p>
        </div>
        <div className="card-muted p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Confirmées</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{confirmed}</p>
        </div>
        <div className="card-muted p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Annulées</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{cancelled}</p>
        </div>
      </div>
    </div>
  );
}

