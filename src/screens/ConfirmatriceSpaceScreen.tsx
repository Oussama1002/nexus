import React, { useMemo } from 'react';
import { ArrowUpRight, CheckCircle2, MessageSquare, PhoneCall, Sparkles, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusChip } from '../components/ui/StatusChip';
import { ConfirmatriceStats } from '../components/confirmations/ConfirmatriceStats';
import { ReminderList } from '../components/confirmations/ReminderList';
import { UpsellRequests } from '../components/confirmations/UpsellRequests';
import { cn } from '../lib/utils';
import { trackSession } from '../lib/session';
import type { User } from '../types';

export function ConfirmatriceSpaceScreen({
  viewerRole,
  selectedConfirmatriceId,
  selectedConfirmatriceName,
  confirmatriceOptions,
  onSelectConfirmatrice,
  onOpenWhatsApp,
  onOpenOrders,
  onOpenLeads,
  onCreateOrder,
}: {
  viewerRole: User['role'];
  selectedConfirmatriceId: string;
  selectedConfirmatriceName: string;
  confirmatriceOptions: { id: string; name: string }[];
  onSelectConfirmatrice: (id: string) => void;
  onOpenWhatsApp: () => void;
  onOpenOrders: () => void;
  onOpenLeads: () => void;
  onCreateOrder: () => void;
}) {
  const isSelf = viewerRole === 'confirmatrice';
  const pageTitle = isSelf ? 'Votre espace' : 'Espace Confirmatrice';
  const pageSubtitle = isSelf
    ? 'Ton poste de travail quotidien: conversations, leads, confirmations, relances et upsells.'
    : `Supervision du poste confirmatrice — vue pour ${selectedConfirmatriceName}.`;
  const kpis = useMemo(
    () => ({
      newConversations: 12,
      leadsInProgress: 18,
      confirmed: 14,
      cancelled: 4,
      remindersDue: 6,
      upsellsOpen: 3,
    }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        right={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {viewerRole === 'admin' && (
              <div className="flex flex-col gap-1 min-w-[200px]">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Confirmatrice</label>
                <select
                  value={selectedConfirmatriceId}
                  onChange={(e) => onSelectConfirmatrice(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-800 outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {confirmatriceOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                onClick={() => {
                  trackSession({ name: 'audit.confirmatrice.quick.open_whatsapp', ts: Date.now() });
                  onOpenWhatsApp();
                }}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Ouvrir WhatsApp
              </button>
              <button
                onClick={() => {
                  trackSession({ name: 'audit.confirmatrice.quick.create_order', ts: Date.now() });
                  onCreateOrder();
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
              >
                <ArrowUpRight className="w-4 h-4" /> Créer commande
              </button>
            </div>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Nouvelles conversations</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{kpis.newConversations}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Leads en cours</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{kpis.leadsInProgress}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Confirmées</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{kpis.confirmed}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Annulées</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{kpis.cancelled}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Relances à faire</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{kpis.remindersDue}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Upsells ouverts</p>
          <p className="mt-2 text-2xl font-black text-indigo-600">{kpis.upsellsOpen}</p>
        </div>
      </div>

      {/* Productivity layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: operational queues */}
        <div className="space-y-6 xl:col-span-2">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-zinc-900">Queues opérationnelles</p>
                <p className="mt-1 text-xs font-medium text-zinc-500">Priorise en 10 secondes.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={onOpenLeads} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50">
                  Mes leads
                </button>
                <button onClick={onOpenOrders} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50">
                  Mes commandes
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-muted p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Leads en attente de réponse</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">7</p>
                <button onClick={onOpenWhatsApp} className="mt-4 w-full py-2.5 rounded-xl bg-primary-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-primary-700 transition-colors">
                  Ouvrir conversations
                </button>
              </div>
              <div className="card-muted p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pas de réponse</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">5</p>
                <button className="mt-4 w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-700 font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-colors">
                  Relancer
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReminderList
              reminders={[
                { id: 'r1', at: '11:00', label: 'Relance Karim B.', meta: 'Luxe Cosmetics • Casablanca' },
                { id: 'r2', at: '14:30', label: 'Relance Zineb A.', meta: 'Zest Home • Rabat' },
                { id: 'r3', at: '18:00', label: 'Relance Fatima Z.', meta: 'Luxe Cosmetics • Casablanca' },
              ]}
              onOpen={() => {
                trackSession({ name: 'audit.confirmatrice.reminder.open', ts: Date.now() });
                onOpenWhatsApp();
              }}
            />

            <UpsellRequests
              items={[
                { id: 'u1', customer: 'Karim B.', brand: 'Luxe Cosmetics', requested: 'Ajouter crème +50MAD', priority: 'Urgent' },
                { id: 'u2', customer: 'Zineb A.', brand: 'Zest Home', requested: 'Pack 2 lampes', priority: 'Normal' },
              ]}
              onOpen={() => {
                trackSession({ name: 'audit.confirmatrice.upsell.open', ts: Date.now() });
                onOpenWhatsApp();
              }}
            />
          </div>
        </div>

        {/* Right: performance + shortcuts */}
        <div className="space-y-6">
          <ConfirmatriceStats confirmationRate={82.4} volume={36} confirmed={kpis.confirmed} cancelled={kpis.cancelled} avgHandleMins={12} />

          <div className="card p-6">
            <p className="text-sm font-black text-zinc-900">Raccourcis</p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Actions 1‑clic pour la productivité.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="py-3 rounded-xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 transition-colors inline-flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Confirmer
              </button>
              <button className="py-3 rounded-xl border border-rose-200 text-rose-700 font-black text-[11px] uppercase tracking-widest hover:bg-rose-50 transition-colors inline-flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Annuler
              </button>
              <button className="col-span-2 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-colors">
                Programmer rappel
              </button>
              <button className="col-span-2 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-colors">
                Marquer “pas de réponse”
              </button>
              <button className="col-span-2 py-3 rounded-xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-colors inline-flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" /> Créer upsell
              </button>
              <button className="col-span-2 py-3 rounded-xl border border-zinc-200 text-zinc-700 font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-colors inline-flex items-center justify-center gap-2">
                <PhoneCall className="w-4 h-4" /> Ouvrir profil client
              </button>
            </div>
          </div>

          <div className="card-muted p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Astuce</p>
            <p className="mt-2 text-sm font-medium text-zinc-700">
              Garde le focus: commence par <span className="font-black">Relances</span>, puis <span className="font-black">Leads en attente</span>, et termine par <span className="font-black">Upsells</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

