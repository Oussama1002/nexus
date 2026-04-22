import React, { useMemo, useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterBar } from '../components/ui/FilterBar';
import { cn } from '../lib/utils';

type SessionEvent = {
  name: string;
  ts: number;
  meta?: Record<string, unknown>;
};

function safeReadSessions(): SessionEvent[] {
  try {
    const raw = localStorage.getItem('nexus.sessions');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is SessionEvent => Boolean(x && typeof (x as any).name === 'string' && typeof (x as any).ts === 'number'))
      .sort((a, b) => b.ts - a.ts);
  } catch {
    return [];
  }
}

function labelFor(evt: SessionEvent) {
  const n = evt.name;
  if (n === 'session.start') return 'Session démarrée';
  if (n === 'nav.view') return 'Navigation';
  if (n.startsWith('audit.order.create')) return 'Commande créée';
  if (n.startsWith('audit.whatsapp.')) return 'Action WhatsApp';
  if (n.startsWith('audit.shipment')) return 'Màj expédition';
  if (n.startsWith('audit.product')) return 'Màj produit';
  if (n.startsWith('audit.finance')) return 'Finance';
  if (n.startsWith('audit.settings')) return 'Configuration';
  if (n.startsWith('audit.confirmatrice')) return 'Confirmatrice';
  return n;
}

function moduleFor(name: string) {
  const p = name.split('.');
  if (p.length >= 2) return p[1]!;
  return name.split(':')[0] ?? name;
}

function toDayKey(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function metaPairs(meta: Record<string, unknown> | undefined) {
  if (!meta) return [];
  const entries = Object.entries(meta)
    .filter(([k, v]) => v !== undefined && v !== null && k !== '')
    .slice(0, 6);
  return entries.map(([k, v]) => {
    const val =
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
        ? String(v)
        : Array.isArray(v)
          ? `[${v.length}]`
          : typeof v === 'object'
            ? '{…}'
            : String(v);
    return { k, v: val };
  });
}

function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(events: SessionEvent[]) {
  const headers = ['ts', 'date', 'time', 'module', 'action', 'label', 'meta'];
  const rows = events.map((e) => {
    const d = new Date(e.ts);
    const date = d.toLocaleDateString('fr-FR');
    const time = timeLabel(e.ts);
    const mod = moduleFor(e.name);
    const label = labelFor(e);
    const meta = e.meta ? JSON.stringify(e.meta) : '';
    const esc = (x: string) => `"${x.replaceAll('"', '""')}"`;
    return [String(e.ts), date, time, mod, e.name, label, meta].map(esc).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

export function TrackingScreen() {
  const [q, setQ] = useState('');
  const [module, setModule] = useState<string>('Tous');
  const [action, setAction] = useState<string>('Tous');
  const [rangeDays, setRangeDays] = useState<number>(7);

  const all = useMemo(() => safeReadSessions(), []);

  const modules = useMemo(() => {
    const set = new Set<string>();
    for (const e of all) set.add(moduleFor(e.name));
    return ['Tous', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [all]);

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const e of all) set.add(e.name);
    return ['Tous', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [all]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const minTs = now - rangeDays * 24 * 60 * 60 * 1000;
    const s = q.trim().toLowerCase();
    return all.filter((e) => {
      if (e.ts < minTs) return false;
      if (module !== 'Tous' && moduleFor(e.name) !== module) return false;
      if (action !== 'Tous' && e.name !== action) return false;
      if (!s) return true;
      const blob = `${e.name} ${labelFor(e)} ${JSON.stringify(e.meta ?? {})}`.toLowerCase();
      return blob.includes(s);
    });
  }, [all, q, module, action, rangeDays]);

  const grouped = useMemo(() => {
    const m = new Map<string, SessionEvent[]>();
    for (const e of filtered) {
      const key = toDayKey(e.ts);
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    const keys = Array.from(m.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((k) => ({ day: k, events: (m.get(k) ?? []).sort((a, b) => b.ts - a.ts) }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique / Tracking"
        subtitle="Audit trail local (nexus.sessions). Filtre, recherche et export."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadText(`nexus.sessions.${Date.now()}.json`, JSON.stringify(filtered, null, 2), 'application/json')}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export JSON
            </button>
            <button
              onClick={() => downloadText(`nexus.sessions.${Date.now()}.csv`, toCsv(filtered), 'text/csv;charset=utf-8')}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        }
      />

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs font-black text-zinc-400 uppercase tracking-widest">
              <Filter className="w-4 h-4" /> Filtres
            </div>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700"
            >
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700 max-w-[260px]"
              title="Action"
            >
              {actions.slice(0, 250).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={String(rangeDays)}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700"
              title="Plage"
            >
              <option value="1">1 jour</option>
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="365">1 an</option>
            </select>
          </div>
        }
        right={
          <div className="hidden md:flex items-center gap-2 text-sm font-black text-zinc-700">
            <Search className="w-4 h-4 text-zinc-400" /> {filtered.length} événements
          </div>
        }
        onClear={() => undefined}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun historique"
          description="Aucun événement trouvé. Lance quelques actions (WhatsApp, commandes, expéditions…) puis reviens ici."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.day} className="card p-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-black text-zinc-900">
                  {new Date(`${g.day}T00:00:00`).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <span className="text-xs font-black text-zinc-500 bg-zinc-50 border border-zinc-200 px-3 py-1 rounded-full">
                  {g.events.length}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {g.events.map((e, idx) => (
                  <div
                    key={`${e.ts}-${idx}`}
                    className={cn(
                      'card-muted p-5 flex items-start justify-between gap-6',
                      idx === 0 && 'ring-1 ring-primary-200',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-zinc-500">{timeLabel(e.ts)}</span>
                            <span className="text-xs font-black text-primary-700 bg-primary-50 border border-primary-100 px-2 py-0.5 rounded-full">
                              {moduleFor(e.name)}
                            </span>
                            <span className="text-sm font-black text-zinc-900">{labelFor(e)}</span>
                          </div>
                          <p className="mt-1 text-[11px] font-medium text-zinc-500 break-all">{e.name}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-white/60 border border-zinc-200 px-2.5 py-1 rounded-full">
                          {String((e.meta as any)?.role ?? 'system')}
                        </span>
                      </div>

                      {e.meta && metaPairs(e.meta).length > 0 && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {metaPairs(e.meta).map((p) => (
                            <div key={p.k} className="bg-white border border-zinc-200 rounded-xl px-3 py-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{p.k}</p>
                              <p className="mt-1 text-xs font-bold text-zinc-800 break-all">{p.v}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {e.meta && (
                        <details className="mt-4">
                          <summary className="cursor-pointer text-xs font-black text-zinc-600 hover:text-zinc-900">
                            Voir détails
                          </summary>
                          <pre className="mt-3 text-[11px] font-mono whitespace-pre-wrap text-zinc-700 bg-white border border-zinc-200 rounded-xl p-3">
                            {JSON.stringify(e.meta, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="shrink-0 text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {String((e.meta as any)?.userId ?? (e.meta as any)?.user ?? 'system')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

