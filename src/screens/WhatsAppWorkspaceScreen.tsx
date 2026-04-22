import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  Mic,
  Paperclip,
  Search,
  Send,
  Smile,
  X,
} from 'lucide-react';
import { StatusChip } from '../components/ui/StatusChip';
import { Drawer } from '../components/ui/Drawer';
import { cn } from '../lib/utils';
import type { OrderDraft } from '../domain/orders';
import { trackSession } from '../lib/session';

type ChatStatus = 'Nouveau' | 'En cours' | 'Confirmé' | 'Annulé' | 'Livré';
type Tag = 'Tous' | 'Confirmer' | 'Serré' | 'Urgent';

type Chat = {
  id: string;
  name: string;
  phone: string;
  brand: 'Luxe Cosmetics' | 'Zest Home' | 'Moda Casa';
  lastMsg: string;
  tsLabel: string;
  unread: number;
  status: ChatStatus;
  tags: Tag[];
  assignedNumber: string;
  city: string;
  source: 'Facebook' | 'TikTok' | 'Instagram' | 'Google' | 'WhatsApp' | 'Autre';
};

type Msg = { id: string; from: 'lead' | 'agent'; text: string; ts: number };

function toneForChatStatus(s: ChatStatus): Parameters<typeof StatusChip>[0]['tone'] {
  switch (s) {
    case 'Confirmé':
    case 'Livré':
      return 'success';
    case 'Annulé':
      return 'danger';
    case 'En cours':
      return 'warning';
    case 'Nouveau':
    default:
      return 'info';
  }
}

export function WhatsAppWorkspaceScreen({
  onCreateOrderFromLead,
}: {
  onCreateOrderFromLead: (draft: Partial<OrderDraft>) => void;
}) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<Tag>('Tous');
  const [selectedId, setSelectedId] = useState<string>('c1');
  const [draft, setDraft] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [reminderAt, setReminderAt] = useState<string>('18:00');
  const [leadOpen, setLeadOpen] = useState(false);

  const [chats, setChats] = useState<Chat[]>([
    {
      id: 'c1',
      name: 'Karim B.',
      phone: '+212 612-345-678',
      brand: 'Luxe Cosmetics',
      lastMsg: 'Quelles sont les délais de livraison sur Casablanca ?',
      tsLabel: '10:30',
      unread: 2,
      status: 'En cours',
      tags: ['Confirmer'],
      assignedNumber: '+212 661-234567',
      city: 'Casablanca',
      source: 'TikTok',
    },
    {
      id: 'c2',
      name: 'Zineb A.',
      phone: '+212 661-222-333',
      brand: 'Zest Home',
      lastMsg: 'Je voudrais commander le pack promo',
      tsLabel: '09:45',
      unread: 0,
      status: 'Nouveau',
      tags: ['Serré'],
      assignedNumber: '+212 661-765432',
      city: 'Rabat',
      source: 'Facebook',
    },
    {
      id: 'c3',
      name: 'Youssef E.',
      phone: '+212 673-111-222',
      brand: 'Moda Casa',
      lastMsg: 'Merci beaucoup !',
      tsLabel: 'Hier',
      unread: 0,
      status: 'Livré',
      tags: [],
      assignedNumber: '+212 661-112233',
      city: 'Marrakech',
      source: 'WhatsApp',
    },
    {
      id: 'c4',
      name: 'Fatima Z.',
      phone: '+212 600-555-777',
      brand: 'Luxe Cosmetics',
      lastMsg: 'C’est urgent, je veux aujourd’hui.',
      tsLabel: 'Hier',
      unread: 3,
      status: 'En cours',
      tags: ['Urgent', 'Confirmer'],
      assignedNumber: '+212 661-234567',
      city: 'Casablanca',
      source: 'Instagram',
    },
  ]);

  const [messagesByChat, setMessagesByChat] = useState<Record<string, Msg[]>>({
    c1: [
      { id: 'm1', from: 'lead', text: "Bonjour, l'offre est toujours disponible ?", ts: Date.now() - 30 * 60_000 },
      { id: 'm2', from: 'agent', text: "Oui bien sûr. Je peux prendre vos infos pour la livraison.", ts: Date.now() - 25 * 60_000 },
      { id: 'm3', from: 'lead', text: "Quelles sont les délais de livraison sur Casablanca ?", ts: Date.now() - 22 * 60_000 },
    ],
    c2: [{ id: 'm1', from: 'lead', text: 'Je voudrais commander le pack promo', ts: Date.now() - 60 * 60_000 }],
    c3: [{ id: 'm1', from: 'lead', text: 'Merci beaucoup !', ts: Date.now() - 24 * 60 * 60_000 }],
    c4: [{ id: 'm1', from: 'lead', text: 'C’est urgent, je veux aujourd’hui.', ts: Date.now() - 23 * 60 * 60_000 }],
  });

  const selected = useMemo(() => chats.find((c) => c.id === selectedId) ?? null, [chats, selectedId]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return chats.filter((c) => {
      const matchesQ =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.phone.toLowerCase().includes(query) ||
        c.brand.toLowerCase().includes(query) ||
        c.lastMsg.toLowerCase().includes(query);
      const matchesTag = tag === 'Tous' ? true : c.tags.includes(tag);
      return matchesQ && matchesTag;
    });
  }, [chats, q, tag]);

  const msgs = selected ? messagesByChat[selected.id] ?? [] : [];

  const send = () => {
    if (!selected) return;
    const text = draft.trim();
    if (!text) return;
    const ts = Date.now();
    const m: Msg = { id: `m${Math.random().toString(16).slice(2, 9)}`, from: 'agent', text, ts };
    setMessagesByChat((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), m] }));
    setChats((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? { ...c, lastMsg: text, tsLabel: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), unread: 0 }
          : c,
      ),
    );
    setDraft('');
  };

  const setChatStatus = (next: ChatStatus) => {
    if (!selected) return;
    setChats((prev) => prev.map((c) => (c.id === selected.id ? { ...c, status: next } : c)));
    trackSession({
      name: 'audit.whatsapp.status_change',
      ts: Date.now(),
      meta: {
        chatId: selected.id,
        phone: selected.phone,
        brand: selected.brand,
        from: selected.status,
        to: next,
      },
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target;
      const isTyping =
        t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable);
      if (isTyping) return;
      if (!selected) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        setChatStatus('Confirmé');
      } else if (key === 'x') {
        e.preventDefault();
        setChatStatus('Annulé');
      } else if (key === 'r') {
        e.preventDefault();
        trackSession({
          name: 'audit.whatsapp.reminder_set',
          ts: Date.now(),
          meta: { chatId: selected.id, phone: selected.phone, brand: selected.brand, reminderAt },
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, reminderAt]);

  return (
    <div className="space-y-8 min-h-0 pb-4">
      {/* Fixed row height on large screens so the composer never gets clipped; scroll lives inside columns */}
      <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:min-h-0 lg:h-[min(780px,calc(100dvh-10rem))]">
          {/* Left: Conversations */}
          <aside className="lg:col-span-4 flex flex-col min-w-0 min-h-0 lg:h-full border-b lg:border-b-0 lg:border-r border-zinc-100/90 bg-zinc-50/30">
            <div className="p-5 sm:p-6 border-b border-zinc-100/90 space-y-4 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500 font-medium shadow-sm"
                  placeholder="Rechercher…"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
                {(['Tous', 'Confirmer', 'Serré', 'Urgent'] as Tag[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTag(t)}
                    className={cn(
                      'px-4 py-2 rounded-xl border text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors',
                      tag === t ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-zinc-100/80">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    'w-full text-left p-5 sm:p-6 flex gap-4 hover:bg-white/80 transition-colors relative',
                    selectedId === c.id && 'bg-primary-50/80',
                  )}
                >
                  <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-100 shadow-sm flex items-center justify-center font-black text-zinc-500 shrink-0">
                    {c.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-zinc-900 truncate">{c.name}</p>
                      <p className="text-[10px] font-bold text-zinc-400 shrink-0">{c.tsLabel}</p>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-bold truncate mt-0.5">
                      {c.brand} • {c.phone}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[12px] text-zinc-700 font-medium truncate">{c.lastMsg}</p>
                      {c.unread > 0 && (
                        <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusChip tone={toneForChatStatus(c.status)}>{c.status}</StatusChip>
                      {c.tags.includes('Urgent') && <StatusChip tone="danger">Urgent</StatusChip>}
                    </div>
                  </div>
                  {selectedId === c.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600" />}
                </button>
              ))}
            </div>
          </aside>

          {/* Center: Chat — column is a flex column with bounded height so the composer stays visible */}
          <section className="lg:col-span-8 flex flex-col min-w-0 min-h-[420px] lg:min-h-0 lg:h-full bg-white">
            {selected ? (
              <>
                <div className="px-5 sm:px-7 py-5 border-b border-zinc-100/90 shrink-0 bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-black text-zinc-900 truncate">{selected.name}</p>
                      <p className="text-xs font-bold text-zinc-500 truncate mt-1">
                        {selected.phone} • {selected.city} • {selected.assignedNumber}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setLeadOpen(true);
                        trackSession({
                          name: 'audit.whatsapp.lead_sheet.open',
                          ts: Date.now(),
                          meta: { chatId: selected.id, phone: selected.phone, brand: selected.brand, source: selected.source },
                        });
                      }}
                      className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 shrink-0"
                    >
                      Fiche lead
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-[140px] overflow-y-auto overscroll-contain px-5 sm:px-7 py-6 space-y-5 bg-gradient-to-b from-zinc-50/50 to-white">
                  {msgs.map((m) => {
                    const isAgent = m.from === 'agent';
                    return (
                      <div key={m.id} className={cn('flex gap-3 max-w-[min(92%,28rem)]', isAgent ? 'flex-row-reverse ml-auto' : '')}>
                        {!isAgent && (
                          <div className="w-8 h-8 rounded-xl bg-zinc-200 shrink-0 flex items-center justify-center text-[10px] font-black text-zinc-600">
                            {selected.name[0]}
                          </div>
                        )}
                        <div className="space-y-1 min-w-0">
                          <div
                            className={cn(
                              'px-4 py-3 rounded-2xl border shadow-sm',
                              isAgent
                                ? 'bg-primary-600 text-white border-primary-600/20 rounded-tr-none shadow-primary-100'
                                : 'bg-white text-zinc-800 border-zinc-100 rounded-tl-none',
                            )}
                          >
                            <p className="text-sm leading-relaxed break-words">{m.text}</p>
                          </div>
                          <div className={cn('flex items-center gap-1', isAgent ? 'justify-end' : '')}>
                            <span className="text-[10px] text-zinc-400 font-bold">
                              {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isAgent && <CheckCircle2 className="w-3 h-3 text-primary-500" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 sm:px-6 py-4 pb-5 border-t border-zinc-200/90 bg-white shrink-0 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] z-20">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <button
                      type="button"
                      className="p-3 rounded-2xl hover:bg-zinc-100 text-zinc-500 shrink-0 border border-transparent hover:border-zinc-200/80"
                      aria-label="Pièce jointe"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <div className="relative flex-1 min-w-[200px]">
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            send();
                          }
                        }}
                        className="w-full pl-5 pr-14 py-3.5 bg-zinc-50 border-2 border-zinc-200 rounded-2xl text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-300 font-medium shadow-inner"
                        placeholder="Tapez votre message…"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-zinc-200/70 text-zinc-500"
                        aria-label="Emoji"
                      >
                        <Smile className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" className="p-3 rounded-2xl hover:bg-zinc-100 text-zinc-500 border border-transparent hover:border-zinc-200/80" aria-label="Message vocal">
                        <Mic className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={send}
                        className="w-12 h-12 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-md shadow-primary-200/80 hover:bg-primary-700 transition-colors shrink-0"
                        aria-label="Envoyer"
                      >
                        <Send className="w-5 h-5 translate-x-0.5 -translate-y-0.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[280px]">
                <div className="w-20 h-20 rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-400">
                  <MessageSquare className="w-10 h-10" />
                </div>
                <p className="mt-6 text-base font-black text-zinc-900">Sélectionnez une conversation</p>
                <p className="mt-2 text-sm font-medium text-zinc-500 max-w-sm">Les messages et la zone de saisie s’affichent ici.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Drawer
        open={leadOpen && Boolean(selected)}
        onClose={() => setLeadOpen(false)}
        title="Fiche lead"
        subtitle={selected ? `${selected.name} • ${selected.brand} • ${selected.source} • ${selected.city}` : undefined}
        widthClassName="w-[560px]"
        footer={
          selected ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLeadOpen(false)}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
              >
                Fermer
              </button>
              <button
                onClick={() => {
                  if (!selected) return;
                  onCreateOrderFromLead({
                    brand: selected.brand,
                    source: selected.source,
                    customerName: selected.name,
                    phone: selected.phone,
                    city: selected.city,
                    notes: internalNote,
                  });
                  trackSession({
                    name: 'audit.whatsapp.create_order_click',
                    ts: Date.now(),
                    meta: { chatId: selected.id, phone: selected.phone, brand: selected.brand, source: selected.source },
                  });
                }}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
              >
                Créer commande
              </button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-7">
            <div className="card-muted p-5 space-y-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</p>
                <StatusChip tone={toneForChatStatus(selected.status)}>{selected.status}</StatusChip>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setChatStatus('Confirmé')}
                  className="py-2.5 rounded-xl bg-emerald-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                >
                  Confirmer (C)
                </button>
                <button
                  onClick={() => setChatStatus('Annulé')}
                  className="py-2.5 rounded-xl border border-rose-200 text-rose-700 font-black text-[11px] uppercase tracking-widest hover:bg-rose-50 transition-colors"
                >
                  Annuler (X)
                </button>
                <button
                  onClick={() => setChatStatus('En cours')}
                  className="col-span-2 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                >
                  Marquer “En cours”
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Rappels</p>
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-zinc-900">Relance</p>
                  <StatusChip tone="warning">
                    <Clock className="w-3 h-3" /> {reminderAt || '—'}
                  </StatusChip>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={reminderAt}
                    onChange={(e) => setReminderAt(e.target.value)}
                    className="w-28 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-700 outline-none"
                  />
                  <button
                    onClick={() => {
                      trackSession({
                        name: 'audit.whatsapp.reminder_set',
                        ts: Date.now(),
                        meta: { chatId: selected.id, phone: selected.phone, brand: selected.brand, reminderAt },
                      });
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-primary-700 transition-colors"
                  >
                    Définir (R)
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Notes internes</p>
              <textarea
                rows={5}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                placeholder="Notes confirmatrice, objections, upsell…"
              />
              <button
                onClick={() => {
                  trackSession({
                    name: 'audit.whatsapp.note_saved',
                    ts: Date.now(),
                    meta: { chatId: selected.id, phone: selected.phone, brand: selected.brand, noteLength: internalNote.trim().length },
                  });
                }}
                className="w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-700 font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-colors"
              >
                Enregistrer
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Infos</p>
              <div className="card-muted p-4 text-sm font-medium text-zinc-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-bold">Téléphone</span>
                  <span className="font-black text-zinc-900">{selected.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-bold">Numéro assigné</span>
                  <span className="font-black text-zinc-900">{selected.assignedNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 font-bold">Source</span>
                  <span className="font-black text-zinc-900">{selected.source}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-sm font-medium text-zinc-500">Aucun lead sélectionné.</div>
        )}
      </Drawer>
    </div>
  );
}

