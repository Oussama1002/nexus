import React, { useMemo, useState } from 'react';
import { CalendarClock, MessageSquare, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { StatusChip } from '../components/ui/StatusChip';
import type { Lead, Brand, User } from '../types';
import type { OrderDraft } from '../domain/orders';
import { trackSession } from '../lib/session';

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: Parameters<typeof StatusChip>[0]['tone'] }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="text-2xl font-black text-zinc-900">{value}</p>
        <StatusChip tone={tone ?? 'neutral'} />
      </div>
    </div>
  );
}

export function LeadsScreen({
  leads,
  brands,
  users,
  activeBrandName,
  onOpenConversation,
  onCreateOrderFromLead,
}: {
  leads: Lead[];
  brands: Brand[];
  users: User[];
  activeBrandName: string;
  onOpenConversation: (leadId: string) => void;
  onCreateOrderFromLead: (draft: Partial<OrderDraft>) => void;
}) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<string>('Marque active');
  const [status, setStatus] = useState<string>('Tous');
  const [source, setSource] = useState<string>('Toutes');
  const [confirmatrice, setConfirmatrice] = useState<string>('Toutes');
  const [openId, setOpenId] = useState<string | null>(null);

  const statusOptions = useMemo(() => ['Tous', 'new', 'contacted', 'confirmed', 'refused', 'shipped', 'delivered', 'returned'], []);
  const sources = useMemo(() => ['Toutes', ...Array.from(new Set(leads.map((l) => l.source))).sort()], [leads]);
  const confirmatrices = useMemo(
    () => ['Toutes', ...users.filter((u) => u.role === 'confirmatrice').map((u) => u.name)],
    [users],
  );
  const brandOptions = useMemo(() => ['Marque active', 'Toutes', ...brands.map((b) => b.name)], [brands]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads.filter((l) => {
      const brandMatch =
        brand === 'Toutes' ? true : brand === 'Marque active' ? l.brand === activeBrandName : l.brand === brand;
      if (!brandMatch) return false;
      if (status !== 'Tous' && l.status !== status) return false;
      if (source !== 'Toutes' && l.source !== source) return false;
      if (confirmatrice !== 'Toutes' && l.agent !== confirmatrice) return false;
      if (!s) return true;
      const blob = `${l.name} ${l.phone} ${l.brand} ${l.source} ${l.status} ${l.agent}`.toLowerCase();
      return blob.includes(s);
    });
  }, [leads, q, brand, status, source, confirmatrice, activeBrandName]);

  const kpis = useMemo(() => {
    const scope = filtered;
    const by = (st: Lead['status']) => scope.filter((x) => x.status === st).length;
    const newLeads = by('new');
    const inProgress = by('contacted');
    const confirmed = by('confirmed');
    const lost = by('refused');
    const noAnswer = scope.filter((x) => x.status === 'contacted').length; // placeholder
    const upsell = Math.max(0, Math.round(confirmed * 0.15));
    return { newLeads, inProgress, confirmed, lost, noAnswer, upsell };
  }, [filtered]);

  const selected = useMemo(() => leads.find((l) => l.id === openId) ?? null, [leads, openId]);

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" subtitle="Gestion dédiée des leads (complément WhatsApp)." />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Kpi label="Nouveaux leads" value={kpis.newLeads} tone="info" />
        <Kpi label="En cours" value={kpis.inProgress} />
        <Kpi label="Confirmés" value={kpis.confirmed} tone="success" />
        <Kpi label="Perdus" value={kpis.lost} tone="danger" />
        <Kpi label="Sans réponse" value={kpis.noAnswer} tone="warning" />
        <Kpi label="Upsell potentiels" value={kpis.upsell} tone="info" />
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        left={
          <div className="flex items-center gap-3 flex-wrap">
            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {brandOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select value={confirmatrice} onChange={(e) => setConfirmatrice(e.target.value)} className="px-3 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm font-bold text-zinc-700">
              {confirmatrices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        }
        right={<div className="text-sm font-black text-zinc-700">{filtered.length} leads</div>}
      />

      <DataTable
        rows={filtered}
        columns={[
          {
            key: 'who',
            header: 'Nom / téléphone',
            cell: (l) => (
              <button onClick={() => setOpenId(l.id)} className="text-left">
                <p className="font-black text-zinc-900">{l.name}</p>
                <p className="text-xs font-bold text-zinc-500">{l.phone}</p>
              </button>
            ),
          },
          { key: 'brand', header: 'Marque', cell: (l) => <span className="font-bold text-zinc-700">{l.brand}</span> },
          { key: 'source', header: 'Source', cell: (l) => <span className="font-bold text-zinc-700">{l.source}</span> },
          { key: 'agent', header: 'Confirmatrice', cell: (l) => <span className="font-bold text-zinc-700">{l.agent}</span> },
          { key: 'status', header: 'Statut', cell: (l) => <StatusChip tone={l.status === 'confirmed' ? 'success' : l.status === 'refused' ? 'danger' : l.status === 'new' ? 'info' : 'neutral'}>{l.status}</StatusChip> },
          { key: 'createdAt', header: 'Date création', cell: (l) => <span className="font-bold text-zinc-700">{l.createdAt}</span> },
        ]}
        emptyTitle="Aucun lead"
        emptyDescription="Aucun résultat pour les filtres actuels."
      />

      <Drawer
        open={Boolean(selected)}
        onClose={() => setOpenId(null)}
        title={selected ? selected.name : ''}
        subtitle={selected ? `${selected.phone} • ${selected.brand}` : ''}
        footer={
          selected && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  trackSession({ name: 'audit.leads.open_conversation', ts: Date.now(), meta: { leadId: selected.id } });
                  onOpenConversation(selected.id);
                }}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Ouvrir conv
              </button>
              <button
                onClick={() => {
                  trackSession({ name: 'audit.leads.create_order', ts: Date.now(), meta: { leadId: selected.id } });
                  onCreateOrderFromLead({
                    brand: selected.brand as any,
                    source: selected.source as any,
                    customerName: selected.name,
                    phone: selected.phone,
                    city: 'Casablanca',
                  });
                }}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
              >
                Créer commande
              </button>
              <button className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center justify-center gap-2">
                <CalendarClock className="w-4 h-4" /> Programmer rappel
              </button>
              <button className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 bg-white text-sm font-black hover:bg-rose-50 inline-flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Marquer perdu
              </button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Contact</p>
              <div className="mt-3 space-y-2 text-sm font-bold text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Marque</span>
                  <span className="text-zinc-900">{selected.brand}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Source</span>
                  <span className="text-zinc-900">{selected.source}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Statut</span>
                  <span className="text-zinc-900">{selected.status}</span>
                </div>
              </div>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Conversation summary</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — extrait WhatsApp + dernier message.</p>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Notes</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — notes confirmatrice + historique.</p>
            </div>

            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Timeline</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — à brancher à `TrackingScreen` + events lead.</p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

