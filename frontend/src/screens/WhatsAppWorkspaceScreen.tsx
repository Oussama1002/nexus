import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MessageSquare, Paperclip, Search, Send, Smile } from 'lucide-react';
import { StatusChip } from '../components/ui/StatusChip';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';
import type { OrderDraft } from '../domain/orders';
import { trackSession } from '../lib/session';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';

type ApiConversation = {
  id: number;
  status: string;
  channel: string;
  brand_id?: number;
  last_message_at: string | null;
  is_waiting_agent_reply?: boolean;
  waiting_agent_reply_minutes?: number;
  needs_reply_alert?: boolean;
  customer?: { full_name: string; phone: string } | null;
  lead?: { id: number } | null;
  brand?: { id: number; name: string } | null;
};

type ApiMessage = {
  id: number;
  direction: 'inbound' | 'outbound';
  content: string | null;
  sent_at: string | null;
  sender?: { name: string } | null;
};

type ApiCustomer = { id: number; full_name: string; phone: string };

const MANDATORY_CONVERSATION_STATUSES = ['en_cours_traitement', 'pas_de_reponse', 'vu_non_repondu', 'confirme', 'a_suivre', 'livre'] as const;
const ON_READ_ALERT_MINUTES = 5;

const CONVERSATION_STATUS_OPTIONS = [
  { value: 'en_cours_traitement', label: 'En cours de traitement' },
  { value: 'pas_de_reponse', label: 'Pas de reponse' },
  { value: 'vu_non_repondu', label: 'Vu non repondu' },
  { value: 'confirme', label: 'Confirme' },
  { value: 'a_suivre', label: 'A suivre' },
  { value: 'livre', label: 'Livre' },
] as const;

function isMandatoryStatus(status: string): boolean {
  return MANDATORY_CONVERSATION_STATUSES.includes(status as (typeof MANDATORY_CONVERSATION_STATUSES)[number]);
}

export function WhatsAppWorkspaceScreen({
  onCreateOrderFromLead,
}: {
  onCreateOrderFromLead: (draft: Partial<OrderDraft>) => void;
}) {
  const { activeBrandId, activeBrand } = useBrand();
  const { user, hasPermission, roleSlugs } = useAuth();
  const toast = useToast();

  const isConfirmatrice = roleSlugs.includes('confirmatrice');
  const canViewConversations = hasPermission('conversations.view') || isConfirmatrice;
  const canCreateConversations = hasPermission('conversations.create') || isConfirmatrice;

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [openedAtByConversation, setOpenedAtByConversation] = useState<Record<number, number>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [newOpen, setNewOpen] = useState(false);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [newCustomerId, setNewCustomerId] = useState('');

  const loadConversations = useCallback(async () => {
    if (!activeBrandId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await api.get<LaravelPaginator<ApiConversation>>('conversations?per_page=100&all_brands=1');
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setConversations([]);
      return;
    }
    setConversations(isPaginator<ApiConversation>(res.data) ? res.data.data : []);
  }, [activeBrandId, toast]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(
    async (cid: number) => {
      setMsgLoading(true);
      const res = await api.get<LaravelPaginator<ApiMessage>>(`conversations/${cid}/messages?per_page=100`);
      setMsgLoading(false);
      if (!res.ok) {
        toast.error(res.message);
        setMessages([]);
        return;
      }
      setMessages(isPaginator<ApiMessage>(res.data) ? res.data.data : []);
    },
    [toast],
  );

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeBrandId || !newOpen) return;
      const res = await api.get<LaravelPaginator<ApiCustomer>>('customers?per_page=200');
      if (cancelled) return;
      if (res.ok && isPaginator<ApiCustomer>(res.data)) setCustomers(res.data.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrandId, newOpen]);

  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);
  const selectedOpenedAt = selectedId ? openedAtByConversation[selectedId] ?? null : null;
  const onReadMinutes = selectedOpenedAt ? Math.floor((nowTick - selectedOpenedAt) / 60000) : 0;
  const showOnReadAlert = Boolean(selected?.is_waiting_agent_reply) && onReadMinutes >= ON_READ_ALERT_MINUTES;

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return conversations.filter((c) => {
      const name = c.customer?.full_name ?? `Conversation #${c.id}`;
      const phone = c.customer?.phone ?? '';
      if (!s) return true;
      return name.toLowerCase().includes(s) || phone.toLowerCase().includes(s);
    });
  }, [conversations, q]);

  function handleSelectConversation(nextId: number) {
    if (selected && selected.id !== nextId && !isMandatoryStatus(selected.status)) {
      toast.error('Vous devez choisir un statut obligatoire avant de quitter cette conversation.');
      return;
    }
    setSelectedId(nextId);
    setOpenedAtByConversation((prev) => ({ ...prev, [nextId]: Date.now() }));
  }

  async function updateConversationStatus(nextStatus: string) {
    if (!selectedId) return;
    setStatusSaving(true);
    const res = await api.patch<ApiConversation>(`conversations/${selectedId}`, { status: nextStatus });
    setStatusSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, status: nextStatus } : c)));
    toast.success('Statut conversation mis a jour.');
  }

  async function send() {
    if (!selectedId || !draft.trim()) return;
    const res = await api.post(`conversations/${selectedId}/messages`, {
      direction: 'outbound',
      content: draft.trim(),
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setDraft('');
    await loadMessages(selectedId);
    await loadConversations();
  }

  async function createConversation() {
    if (!newCustomerId) return;
    const res = await api.post<ApiConversation>('conversations', {
      customer_id: Number(newCustomerId),
      channel: 'whatsapp',
      status: 'open',
      assigned_user_id: user ? Number(user.id) : null,
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Conversation créée.');
    setNewOpen(false);
    setNewCustomerId('');
    await loadConversations();
  }

  if (!activeBrandId) {
    return <EmptyState title="Marque requise" description="Choisissez une marque pour charger les conversations." />;
  }

  if (!canViewConversations) {
    return <EmptyState title="Accès refusé" description="Permission conversations.view requise." />;
  }

  return (
    <div className="space-y-8 min-h-0 pb-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900">Conversations</h1>
          <p className="text-sm font-medium text-zinc-500 mt-1">Marque active: {activeBrand.name}</p>
          {isConfirmatrice ? (
            <p className="text-xs font-semibold text-zinc-500 mt-2 max-w-xl">
              Répondez aux clients depuis cette interface ; l’application WhatsApp sur téléphone n’est pas utilisée.
            </p>
          ) : null}
        </div>
        {canCreateConversations ? (
          <button type="button" onClick={() => setNewOpen(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700">
            Nouvelle conversation
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:min-h-0 lg:h-[min(780px,calc(100dvh-10rem))]">
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
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-zinc-100/80">
              {loading ? (
                <div className="p-8 text-center text-sm font-bold text-zinc-500">Chargement…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm font-bold text-zinc-500">Aucune conversation</div>
              ) : (
                filtered.map((c) => {
                  const name = c.customer?.full_name ?? `Conversation #${c.id}`;
                  const phone = c.customer?.phone ?? '';
                  const ts = c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectConversation(c.id)}
                      className={cn(
                        'w-full text-left p-5 sm:p-6 flex gap-4 hover:bg-white/80 transition-colors relative',
                        selectedId === c.id && 'bg-primary-50/80',
                      )}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-100 shadow-sm flex items-center justify-center font-black text-zinc-500 shrink-0">
                        {name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-black text-zinc-900 truncate">{name}</p>
                          <p className="text-[10px] font-bold text-zinc-400 shrink-0">{ts}</p>
                        </div>
                        <p className="text-[11px] text-zinc-500 font-bold truncate mt-0.5">{phone}</p>
                        <div className="mt-2 flex items-center gap-2">
                          {c.needs_reply_alert ? <StatusChip tone="warning">Alerte reponse</StatusChip> : null}
                          {!isMandatoryStatus(c.status) ? <StatusChip tone="danger">Statut requis</StatusChip> : null}
                        </div>
                      </div>
                      {selectedId === c.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="lg:col-span-8 flex flex-col min-w-0 min-h-[420px] lg:min-h-0 lg:h-full bg-white">
            {selected ? (
              <>
                <div className="px-5 sm:px-7 py-5 border-b border-zinc-100/90 shrink-0 bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-black text-zinc-900 truncate">{selected.customer?.full_name ?? `Conversation #${selected.id}`}</p>
                      <p className="text-xs font-bold text-zinc-500 truncate mt-1">{selected.customer?.phone ?? ''}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusChip tone={isMandatoryStatus(selected.status) ? 'success' : 'danger'}>
                          {isMandatoryStatus(selected.status) ? 'Statut valide' : 'Statut obligatoire'}
                        </StatusChip>
                        {selected.needs_reply_alert ? <StatusChip tone="warning">Reponse en retard</StatusChip> : null}
                        {showOnReadAlert ? <StatusChip tone="warning">Client en read trop longtemps</StatusChip> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={selected.status}
                        disabled={statusSaving}
                        onChange={(e) => void updateConversationStatus(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-black uppercase tracking-wide bg-white"
                      >
                        <option value="open">-- Choisir statut --</option>
                        {!['open', ...CONVERSATION_STATUS_OPTIONS.map((o) => o.value)].includes(selected.status) ? (
                          <option value={selected.status}>{selected.status}</option>
                        ) : null}
                        {CONVERSATION_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {selected.lead && (
                        <button
                          type="button"
                          onClick={() => {
                            onCreateOrderFromLead({
                              leadId: selected.lead!.id,
                              customerName: selected.customer?.full_name ?? '',
                              phone: selected.customer?.phone ?? '',
                              source: 'WhatsApp',
                            });
                            trackSession({ name: 'audit.whatsapp.order_prefill', ts: Date.now(), meta: { conversationId: selected.id } });
                          }}
                          className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 shrink-0"
                        >
                          Vers commande
                        </button>
                      )}
                    </div>
                  </div>
                  {selected.is_waiting_agent_reply ? (
                    <p className="text-xs font-bold text-amber-700 mt-3">
                      Client en attente depuis {selected.waiting_agent_reply_minutes ?? 0} min sans reponse agent.
                    </p>
                  ) : null}
                </div>

                <div className="flex-1 min-h-[140px] overflow-y-auto overscroll-contain px-5 sm:px-7 py-6 space-y-5 bg-gradient-to-b from-zinc-50/50 to-white">
                  {msgLoading ? (
                    <p className="text-sm font-bold text-zinc-500">Chargement messages…</p>
                  ) : (
                    messages.map((m) => {
                      const isAgent = m.direction === 'outbound';
                      const ts = m.sent_at ? new Date(m.sent_at).getTime() : Date.now();
                      return (
                        <div key={m.id} className={cn('flex gap-3 max-w-[min(92%,28rem)]', isAgent ? 'flex-row-reverse ml-auto' : '')}>
                          {!isAgent && (
                            <div className="w-8 h-8 rounded-xl bg-zinc-200 shrink-0 flex items-center justify-center text-[10px] font-black text-zinc-600">
                              {(selected.customer?.full_name ?? '?')[0]}
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
                              <p className="text-sm leading-relaxed break-words">{m.content ?? '—'}</p>
                            </div>
                            <div className={cn('flex items-center gap-1', isAgent ? 'justify-end' : '')}>
                              <span className="text-[10px] text-zinc-400 font-bold">
                                {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isAgent && <CheckCircle2 className="w-3 h-3 text-primary-500" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {canCreateConversations && (
                  <div className="p-4 border-t border-zinc-100 bg-white shrink-0">
                    <div className="flex items-end gap-2">
                      <button type="button" className="p-3 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50" aria-label="emoji">
                        <Smile className="w-5 h-5" />
                      </button>
                      <button type="button" className="p-3 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50" aria-label="attach">
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' || e.shiftKey) return;
                          e.preventDefault();
                          void send();
                        }}
                        rows={2}
                        className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                        placeholder="Message…"
                      />
                      <button
                        type="button"
                        onClick={() => void send()}
                        className="p-3 rounded-2xl bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-100"
                        aria-label="send"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-10 gap-3">
                <MessageSquare className="w-10 h-10 opacity-40" />
                <p className="text-sm font-black">Sélectionnez une conversation</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nouvelle conversation"
        subtitle="Liée à un client existant."
        footer={
          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => setNewOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700">
              Annuler
            </button>
            <button type="button" disabled={!newCustomerId} onClick={() => void createConversation()} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black disabled:opacity-50">
              Créer
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Client</label>
          <select value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-zinc-800">
            <option value="">— Choisir —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} — {c.phone}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
}
