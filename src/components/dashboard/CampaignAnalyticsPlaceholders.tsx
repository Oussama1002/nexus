import React from 'react';

export function CampaignAnalyticsPlaceholders() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-black text-[color:var(--color-text-0)]">Campagnes & sources</p>
        <p className="mt-1 text-xs font-medium text-[color:var(--color-text-2)]">
          Synthèse ads (commandes par source, volume campagnes, coûts) — données à brancher.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Commandes par source" subtitle="Attribution (placeholder)" />
        <ChartCard title="Leads par campagne" subtitle="Volume / campagne (placeholder)" />
        <ChartCard title="Coût par campagne" subtitle="Budget / période (placeholder)" />
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-zinc-900">{title}</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">{subtitle}</p>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-50 border border-zinc-200 px-3 py-1 rounded-full">
          placeholder
        </span>
      </div>
      <div className="mt-5 h-40 rounded-2xl bg-gradient-to-br from-zinc-50 to-white border border-zinc-200 flex items-center justify-center">
        <span className="text-xs font-bold text-zinc-400">Zone graphique</span>
      </div>
    </div>
  );
}
