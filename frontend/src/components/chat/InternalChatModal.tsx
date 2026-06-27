import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolvePublicAssetUrl } from '../../lib/publicAssetUrl';
import * as api from '../../lib/api';

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

export function InternalChatModal({
  open,
  onClose,
  initialPeer,
  allUsers,
}: {
  open: boolean;
  onClose: () => void;
  initialPeer?: UserTarget | null;
  allUsers?: UserTarget[];
}) {
  const { user: authUser } = useAuth();
  const myId = authUser?.id ?? 0;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activePeer, setActivePeer] = useState<UserTarget | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await api.get<Thread[]>('internal-chat/threads');
    if (res.ok && Array.isArray(res.data)) setThreads(res.data);
  }, []);

  const loadMessages = useCallback(async (peerId: number) => {
    const res = await api.get<ChatMessage[]>(`internal-chat/${peerId}/messages`);
    if (res.ok && Array.isArray(res.data)) setMessages(res.data);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadThreads();
    if (initialPeer) {
      setActivePeer(initialPeer);
      void loadMessages(initialPeer.id);
    }
  }, [open, initialPeer, loadThreads, loadMessages]);

  useEffect(() => {
    if (!open || !activePeer) return;
    const timer = setInterval(() => { void loadMessages(activePeer.id); }, 3000);
    return () => clearInterval(timer);
  }, [open, activePeer, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function openThread(peer: UserTarget) {
    setActivePeer(peer);
    setMessages([]);
    setDraft('');
    void loadMessages(peer.id);
  }

  async function sendMessage() {
    if (!activePeer || !draft.trim()) return;
    setLoading(true);
    const res = await api.post<ChatMessage>(`internal-chat/${activePeer.id}/messages`, { body: draft.trim() });
    setLoading(false);
    if (res.ok && res.data) {
      setMessages((prev) => [...prev, res.data!]);
      setDraft('');
      void loadThreads();
    }
  }

  if (!open) return null;

  const availableUsers = (allUsers ?? []).filter((u) => u.id !== myId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 shrink-0">
          {activePeer && (
            <button type="button" onClick={() => { setActivePeer(null); setMessages([]); void loadThreads(); }} className="p-1 rounded-lg hover:bg-zinc-100">
              <ArrowLeft className="w-4 h-4 text-zinc-500" />
            </button>
          )}
          <MessageCircle className="w-5 h-5 text-primary-600" />
          <h2 className="text-sm font-black text-zinc-900 flex-1">
            {activePeer ? activePeer.name : 'Messagerie interne'}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {!activePeer ? (
          /* Thread list + new conversation */
          <div className="flex-1 overflow-y-auto">
            {availableUsers.length > 0 && threads.length === 0 && (
              <div className="px-5 pt-4 pb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Démarrer une conversation</p>
              </div>
            )}
            {threads.length > 0 && (
              <div className="divide-y divide-zinc-100">
                {threads.map((t) => (
                  <button
                    key={t.user_id}
                    type="button"
                    onClick={() => openThread({ id: t.user_id, name: t.user_name, email: t.user_email, avatar_url: t.user_avatar })}
                    className="w-full text-left px-5 py-3 hover:bg-zinc-50 flex items-center gap-3"
                  >
                    {t.user_avatar ? (
                      <img src={resolvePublicAssetUrl(t.user_avatar)} alt="" className="w-9 h-9 rounded-xl object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 font-black text-xs flex items-center justify-center">
                        {t.user_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-zinc-900 truncate">{t.user_name}</p>
                        <span className="text-[10px] text-zinc-400 shrink-0 ml-2">
                          {new Date(t.last_message_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {t.last_direction === 'sent' ? 'Vous : ' : ''}{t.last_message}
                      </p>
                    </div>
                    {t.unread > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-black flex items-center justify-center">
                        {t.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {/* Users without existing thread */}
            {availableUsers.filter((u) => !threads.some((t) => t.user_id === u.id)).length > 0 && (
              <div className="px-5 pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                  {threads.length > 0 ? 'Autres utilisateurs' : 'Utilisateurs'}
                </p>
                <div className="space-y-1">
                  {availableUsers
                    .filter((u) => !threads.some((t) => t.user_id === u.id))
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => openThread(u)}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-50 flex items-center gap-3"
                      >
                        {u.avatar_url ? (
                          <img src={resolvePublicAssetUrl(u.avatar_url)} alt="" className="w-8 h-8 rounded-xl object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-xl bg-zinc-100 text-zinc-600 font-black text-[10px] flex items-center justify-center">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{u.name}</p>
                          <p className="text-[11px] text-zinc-500">{u.email}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Chat view */
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-sm text-zinc-400 py-8">Aucun message. Dites bonjour !</p>
              )}
              {messages.map((m) => {
                const isMine = m.sender_id === myId;
                return (
                  <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                        isMine
                          ? 'bg-primary-600 text-white rounded-br-md'
                          : 'bg-zinc-100 text-zinc-900 rounded-bl-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-zinc-400'}`}>
                        {new Date(m.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="px-5 py-3 border-t border-zinc-100 shrink-0">
              <form
                onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
                className="flex items-center gap-2"
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
                  disabled={loading || !draft.trim()}
                  className="p-2.5 rounded-xl bg-primary-600 text-white disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
