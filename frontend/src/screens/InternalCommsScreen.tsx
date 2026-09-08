import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Search, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { resolvePublicAssetUrl } from '../lib/publicAssetUrl';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type Thread = {
  user_id: number;
  user_name: string;
  user_email: string;
  user_avatar: string;
  last_message: string;
  last_message_at: string;
  last_direction: 'sent' | 'received';
  unread: number;
};

type ChatMessage = {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
};

type UserTarget = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
};

/**
 * Communications internes — full-page internal messaging inbox.
 * Same underlying /internal-chat/* API as the header modal but rendered
 * as a two-pane workspace (threads left, active conversation right).
 */
export function InternalCommsScreen() {
  const { user: authUser } = useAuth();
  const myId = authUser?.id ?? 0;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [allUsers, setAllUsers] = useState<UserTarget[]>([]);
  const [activePeer, setActivePeer] = useState<UserTarget | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [search, setSearch] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await api.get<Thread[]>('internal-chat/threads');
    if (res.ok && Array.isArray(res.data)) setThreads(res.data);
    setLoadingThreads(false);
  }, []);

  const loadAllUsers = useCallback(async () => {
    const res = await api.get<Paginated<UserTarget>>('users' + buildQuery({ per_page: 200 }));
    if (res.ok && res.data && Array.isArray(res.data.data)) {
      setAllUsers(res.data.data.filter((u) => u.id !== myId));
    }
  }, [myId]);

  const loadMessages = useCallback(async (peerId: number) => {
    const res = await api.get<ChatMessage[]>(`internal-chat/${peerId}/messages`);
    if (res.ok && Array.isArray(res.data)) setMessages(res.data);
  }, []);

  useEffect(() => { void loadThreads(); void loadAllUsers(); }, [loadThreads, loadAllUsers]);

  // Poll active conversation every 3s so new messages arrive without reload.
  useEffect(() => {
    if (!activePeer) return;
    const timer = setInterval(() => { void loadMessages(activePeer.id); }, 3000);
    return () => clearInterval(timer);
  }, [activePeer, loadMessages]);

  // Poll the thread list every 15s to catch new conversations initiated by others.
  useEffect(() => {
    const timer = setInterval(() => { void loadThreads(); }, 15000);
    return () => clearInterval(timer);
  }, [loadThreads]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const openThread = (peer: UserTarget) => {
    setActivePeer(peer);
    setMessages([]);
    setDraft('');
    void loadMessages(peer.id);
    // Optimistically clear the unread badge on the thread list
    setThreads((prev) => prev.map((t) => t.user_id === peer.id ? { ...t, unread: 0 } : t));
  };

  const sendMessage = async () => {
    if (!activePeer || !draft.trim()) return;
    setSending(true);
    const res = await api.post<ChatMessage>(`internal-chat/${activePeer.id}/messages`, { body: draft.trim() });
    setSending(false);
    if (res.ok && res.data) {
      setMessages((prev) => [...prev, res.data!]);
      setDraft('');
      void loadThreads();
    }
  };

  // Merge threads + users so people never chatted with are still reachable
  const listItems = useMemo(() => {
    const seen = new Set(threads.map((t) => t.user_id));
    const others: Thread[] = allUsers
      .filter((u) => !seen.has(u.id))
      .map((u) => ({
        user_id: u.id, user_name: u.name, user_email: u.email,
        user_avatar: u.avatar_url ?? '', last_message: '', last_message_at: '',
        last_direction: 'received', unread: 0,
      }));
    const combined = [...threads, ...others];
    const q = search.trim().toLowerCase();
    if (!q) return combined;
    return combined.filter((t) => t.user_name.toLowerCase().includes(q) || t.user_email.toLowerCase().includes(q));
  }, [threads, allUsers, search]);

  const totalUnread = useMemo(() => threads.reduce((s, t) => s + t.unread, 0), [threads]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Communications internes"
        subtitle={totalUnread > 0 ? `${totalUnread} message${totalUnread > 1 ? 's' : ''} non lu${totalUnread > 1 ? 's' : ''}` : 'Vos conversations internes'}
      />

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden flex" style={{ height: 'calc(100vh - 220px)', minHeight: 520 }}>
        {/* ─── Left pane: threads ─── */}
        <aside className={`w-full md:w-80 shrink-0 border-r border-zinc-100 flex flex-col ${activePeer ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-zinc-100 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 text-sm bg-zinc-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingThreads ? (
              <div className="p-6 text-center text-sm text-zinc-400">Chargement…</div>
            ) : listItems.length === 0 ? (
              <EmptyState title="Aucun utilisateur" description="Aucune personne à contacter." />
            ) : (
              <div className="divide-y divide-zinc-50">
                {listItems.map((t) => {
                  const isActive = activePeer?.id === t.user_id;
                  const hasHistory = !!t.last_message_at;
                  return (
                    <button
                      key={t.user_id}
                      type="button"
                      onClick={() => openThread({ id: t.user_id, name: t.user_name, email: t.user_email, avatar_url: t.user_avatar })}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${
                        isActive ? 'bg-primary-50' : 'hover:bg-zinc-50'
                      }`}
                    >
                      {t.user_avatar ? (
                        <img src={resolvePublicAssetUrl(t.user_avatar)} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-zinc-200 text-zinc-600 font-black text-xs flex items-center justify-center shrink-0">
                          {t.user_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-zinc-900 truncate">{t.user_name}</p>
                          {hasHistory && (
                            <span className="text-[10px] text-zinc-400 shrink-0">
                              {new Date(t.last_message_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {hasHistory
                            ? (t.last_direction === 'sent' ? 'Vous : ' : '') + t.last_message
                            : <span className="italic text-zinc-400">Aucun message</span>}
                        </p>
                      </div>
                      {t.unread > 0 && (
                        <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[10px] font-black flex items-center justify-center">
                          {t.unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ─── Right pane: active conversation ─── */}
        <section className={`flex-1 flex flex-col ${activePeer ? 'flex' : 'hidden md:flex'}`}>
          {!activePeer ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-400 p-8">
              <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-bold">Sélectionnez une conversation</p>
              <p className="text-xs mt-1">Choisissez une personne à gauche pour afficher les messages.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePeer(null)}
                  className="md:hidden p-1 rounded-lg hover:bg-zinc-100"
                >
                  <ArrowLeft className="w-4 h-4 text-zinc-500" />
                </button>
                {activePeer.avatar_url ? (
                  <img src={resolvePublicAssetUrl(activePeer.avatar_url)} alt="" className="w-8 h-8 rounded-xl object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 font-black text-[10px] flex items-center justify-center">
                    {activePeer.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-zinc-900 truncate">{activePeer.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{activePeer.email}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-zinc-50/40">
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-zinc-400 py-8">Aucun message. Envoyez le premier.</p>
                ) : (
                  messages.map((m) => {
                    const isMine = m.sender_id === myId;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                            isMine
                              ? 'bg-primary-600 text-white rounded-br-md'
                              : 'bg-white text-zinc-900 rounded-bl-md border border-zinc-100'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-zinc-400'}`}>
                            {new Date(m.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
                className="px-5 py-3 border-t border-zinc-100 shrink-0 flex items-center gap-2"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Écrire un message…"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="p-2.5 rounded-xl bg-primary-600 text-white disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
