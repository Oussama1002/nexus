import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, Search, ArrowLeft, Plus, Users, X, User, RefreshCw, Paperclip, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  read_at: string | null;
  created_at: string;
};

type UserTarget = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
};

type GroupConv = {
  conversation_id: number;
  title: string;
  type: 'group' | 'dm';
  member_count: number;
  last_message: string;
  last_message_at: string;
  last_direction: 'sent' | 'received';
  unread: number;
};

type GroupMessage = {
  id: number;
  sender_id: number;
  sender_name?: string;
  sender_avatar?: string | null;
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  attachment_size?: number | null;
  created_at: string;
};

/** A selected chat can be either a DM (with a UserTarget) or a group. */
type ActiveChat =
  | { kind: 'dm'; peer: UserTarget }
  | { kind: 'group'; conv: GroupConv };

/**
 * Communications internes — full-page internal messaging inbox.
 * Same underlying /internal-chat/* API as the header modal but rendered
 * as a two-pane workspace (threads left, active conversation right).
 */
export function InternalCommsScreen() {
  const { user: authUser } = useAuth();
  const toast = useToast();
  const myId = authUser?.id ?? 0;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [groups, setGroups] = useState<GroupConv[]>([]);
  const [allUsers, setAllUsers] = useState<UserTarget[]>([]);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await api.get<Thread[]>('internal-chat/threads');
    if (res.ok && Array.isArray(res.data)) setThreads(res.data);
    setLoadingThreads(false);
  }, []);

  const loadGroups = useCallback(async () => {
    const res = await api.get<GroupConv[]>('internal-chat/conversations');
    if (res.ok && Array.isArray(res.data)) setGroups(res.data);
  }, []);

  const loadAllUsers = useCallback(async () => {
    const res = await api.get<Paginated<UserTarget>>('users' + buildQuery({ per_page: 200 }));
    if (res.ok && res.data && Array.isArray(res.data.data)) {
      setAllUsers(res.data.data.filter((u) => u.id !== myId));
    }
  }, [myId]);

  const loadDmMessages = useCallback(async (peerId: number) => {
    const res = await api.get<ChatMessage[]>(`internal-chat/${peerId}/messages`);
    if (res.ok && Array.isArray(res.data)) setMessages(res.data);
  }, []);

  const loadGroupMessages = useCallback(async (cid: number) => {
    const res = await api.get<GroupMessage[]>(`internal-chat/conversations/${cid}/messages`);
    if (res.ok && Array.isArray(res.data)) setGroupMessages(res.data);
  }, []);

  useEffect(() => { void loadThreads(); void loadGroups(); void loadAllUsers(); }, [loadThreads, loadGroups, loadAllUsers]);

  // Poll active conversation every 3s so new messages arrive without reload.
  useEffect(() => {
    if (!activeChat) return;
    const timer = setInterval(() => {
      if (activeChat.kind === 'dm') void loadDmMessages(activeChat.peer.id);
      else void loadGroupMessages(activeChat.conv.conversation_id);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeChat, loadDmMessages, loadGroupMessages]);

  // Poll the thread list every 5s so groups created by others appear quickly.
  useEffect(() => {
    const timer = setInterval(() => { void loadThreads(); void loadGroups(); }, 5000);
    return () => clearInterval(timer);
  }, [loadThreads, loadGroups]);

  // Refresh immediately when the tab regains focus (covers the case where a
  // teammate created a group while you were on another tab).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadThreads();
        void loadGroups();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadThreads, loadGroups]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, groupMessages]);

  const openDm = (peer: UserTarget) => {
    setActiveChat({ kind: 'dm', peer });
    setMessages([]); setGroupMessages([]); setDraft('');
    void loadDmMessages(peer.id);
    setThreads((prev) => prev.map((t) => t.user_id === peer.id ? { ...t, unread: 0 } : t));
  };

  const openGroup = (conv: GroupConv) => {
    setActiveChat({ kind: 'group', conv });
    setMessages([]); setGroupMessages([]); setDraft('');
    void loadGroupMessages(conv.conversation_id);
    setGroups((prev) => prev.map((g) => g.conversation_id === conv.conversation_id ? { ...g, unread: 0 } : g));
  };

  /** Upload the pending file, if any, then return its attachment payload. */
  const uploadIfNeeded = async (): Promise<{
    attachment_url?: string; attachment_name?: string; attachment_mime?: string; attachment_size?: number;
  } | null> => {
    if (!pendingFile) return {};
    setUploading(true);
    const fd = new FormData();
    fd.append('file', pendingFile);
    const res = await api.post<{ url: string; name: string; mime: string; size: number }>('internal-chat/upload', fd as any);
    setUploading(false);
    if (!res.ok || !res.data) {
      toast.error(res.message || 'Échec du téléversement.');
      return null;
    }
    return {
      attachment_url: res.data.url,
      attachment_name: res.data.name,
      attachment_mime: res.data.mime,
      attachment_size: res.data.size,
    };
  };

  const sendMessage = async () => {
    if (!activeChat) return;
    if (!draft.trim() && !pendingFile) return;
    setSending(true);
    const attachment = await uploadIfNeeded();
    if (attachment === null) { setSending(false); return; }
    const payload: any = { body: draft.trim(), ...attachment };
    if (activeChat.kind === 'dm') {
      const res = await api.post<ChatMessage>(`internal-chat/${activeChat.peer.id}/messages`, payload);
      setSending(false);
      if (res.ok && res.data) {
        setMessages((prev) => [...prev, res.data!]);
        setDraft(''); setPendingFile(null);
        void loadThreads();
      } else if (!res.ok) toast.error(res.message);
    } else {
      const cid = activeChat.conv.conversation_id;
      const res = await api.post<GroupMessage>(`internal-chat/conversations/${cid}/messages`, payload);
      setSending(false);
      if (res.ok && res.data) {
        setGroupMessages((prev) => [...prev, { ...res.data!, sender_name: authUser?.name, sender_avatar: authUser?.avatar_url }]);
        setDraft(''); setPendingFile(null);
        void loadGroups();
      } else if (!res.ok) toast.error(res.message);
    }
  };

  const handleGroupCreated = (cid: number, title: string) => {
    setShowNewGroup(false);
    void loadGroups();
    openGroup({ conversation_id: cid, title, type: 'group', member_count: 0, last_message: '', last_message_at: new Date().toISOString(), last_direction: 'sent', unread: 0 });
  };

  // Combined list: existing DM threads (with history), then group conversations
  const listItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const dmMatch = (t: Thread) => !q || t.user_name.toLowerCase().includes(q) || t.user_email.toLowerCase().includes(q);
    const gMatch = (g: GroupConv) => !q || (g.title ?? '').toLowerCase().includes(q);
    return {
      groups: groups.filter(gMatch),
      threads: threads.filter(dmMatch),
    };
  }, [threads, groups, search]);

  const totalUnread = useMemo(
    () => threads.reduce((s, t) => s + t.unread, 0) + groups.reduce((s, g) => s + g.unread, 0),
    [threads, groups],
  );

  const isActive = (i: ActiveChat | null, kind: 'dm' | 'group', id: number) => {
    if (!i || i.kind !== kind) return false;
    if (i.kind === 'dm') return i.peer.id === id;
    return i.conv.conversation_id === id;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Communications internes"
        subtitle={totalUnread > 0 ? `${totalUnread} message${totalUnread > 1 ? 's' : ''} non lu${totalUnread > 1 ? 's' : ''}` : 'Vos conversations internes'}
      />

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden flex" style={{ height: 'calc(100vh - 220px)', minHeight: 520 }}>
        {/* ─── Left pane: threads ─── */}
        <aside className={`w-full md:w-80 shrink-0 border-r border-zinc-100 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3 border-b border-zinc-100 shrink-0 space-y-2">
            {/* Nouvelle conversation menu + refresh */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <button
                  onClick={() => setShowNewMenu((v) => !v)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary-600 text-white text-sm font-black hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" /> Nouvelle conversation
                </button>
                {showNewMenu && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
                    <button
                      onClick={() => { setShowNewMenu(false); setShowNewDm(true); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 inline-flex items-center gap-2"
                    >
                      <User className="w-4 h-4 text-zinc-500" /> Avec un utilisateur
                    </button>
                    <button
                      onClick={() => { setShowNewMenu(false); setShowNewGroup(true); }}
                      className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 inline-flex items-center gap-2 border-t border-zinc-100"
                    >
                      <Users className="w-4 h-4 text-zinc-500" /> Nouveau groupe
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => { void loadThreads(); void loadGroups(); }}
                title="Actualiser"
                className="shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

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
            ) : listItems.threads.length === 0 && listItems.groups.length === 0 ? (
              <EmptyState title="Aucune conversation" description="Utilisez « Nouvelle conversation » pour démarrer un échange ou un groupe." />
            ) : (
              <>
                {listItems.groups.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">Groupes</p>
                    <div className="divide-y divide-zinc-50">
                      {listItems.groups.map((g) => {
                        const active = isActive(activeChat, 'group', g.conversation_id);
                        return (
                          <button
                            key={`g${g.conversation_id}`}
                            type="button"
                            onClick={() => openGroup(g)}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${active ? 'bg-primary-50' : 'hover:bg-zinc-50'}`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                              <Users className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-black text-zinc-900 truncate">{g.title}</p>
                                {g.last_message_at && (
                                  <span className="text-[10px] text-zinc-400 shrink-0">
                                    {new Date(g.last_message_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500 truncate mt-0.5">
                                {g.last_message
                                  ? (g.last_direction === 'sent' ? 'Vous : ' : '') + g.last_message
                                  : <span className="italic text-zinc-400">{g.member_count} membre{g.member_count > 1 ? 's' : ''}</span>}
                              </p>
                            </div>
                            {g.unread > 0 && (
                              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[10px] font-black flex items-center justify-center">
                                {g.unread}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {listItems.threads.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">Conversations directes</p>
                    <div className="divide-y divide-zinc-50">
                      {listItems.threads.map((t) => {
                        const active = isActive(activeChat, 'dm', t.user_id);
                        return (
                          <button
                            key={`d${t.user_id}`}
                            type="button"
                            onClick={() => openDm({ id: t.user_id, name: t.user_name, email: t.user_email, avatar_url: t.user_avatar })}
                            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition ${active ? 'bg-primary-50' : 'hover:bg-zinc-50'}`}
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
                                {t.last_message_at && (
                                  <span className="text-[10px] text-zinc-400 shrink-0">
                                    {new Date(t.last_message_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-500 truncate mt-0.5">
                                {(t.last_direction === 'sent' ? 'Vous : ' : '') + t.last_message}
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
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* ─── Right pane: active conversation ─── */}
        <section className={`flex-1 flex flex-col ${activeChat ? 'flex' : 'hidden md:flex'}`}>
          {!activeChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-400 p-8">
              <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-bold">Sélectionnez une conversation</p>
              <p className="text-xs mt-1">Choisissez une conversation à gauche ou créez-en une nouvelle.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveChat(null)}
                  className="md:hidden p-1 rounded-lg hover:bg-zinc-100"
                >
                  <ArrowLeft className="w-4 h-4 text-zinc-500" />
                </button>
                {activeChat.kind === 'dm' ? (
                  <>
                    {activeChat.peer.avatar_url ? (
                      <img src={resolvePublicAssetUrl(activeChat.peer.avatar_url)} alt="" className="w-8 h-8 rounded-xl object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 font-black text-[10px] flex items-center justify-center">
                        {activeChat.peer.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-zinc-900 truncate">{activeChat.peer.name}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{activeChat.peer.email}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-zinc-900 truncate">{activeChat.conv.title}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{activeChat.conv.member_count} membre{activeChat.conv.member_count > 1 ? 's' : ''}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-zinc-50/40">
                {activeChat.kind === 'dm' ? (
                  messages.length === 0 ? (
                    <p className="text-center text-sm text-zinc-400 py-8">Aucun message. Envoyez le premier.</p>
                  ) : (
                    messages.map((m) => {
                      const isMine = m.sender_id === myId;
                      return (
                        <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                            isMine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white text-zinc-900 rounded-bl-md border border-zinc-100'
                          }`}>
                            {m.attachment_url && <AttachmentPreview m={m} mine={isMine} />}
                            {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                            <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-zinc-400'}`}>
                              {new Date(m.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  groupMessages.length === 0 ? (
                    <p className="text-center text-sm text-zinc-400 py-8">Aucun message dans ce groupe.</p>
                  ) : (
                    groupMessages.map((m) => {
                      const isMine = m.sender_id === myId;
                      return (
                        <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] ${isMine ? '' : ''}`}>
                            {!isMine && m.sender_name && (
                              <p className="text-[10px] font-bold text-zinc-500 mb-0.5 ml-1">{m.sender_name}</p>
                            )}
                            <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                              isMine ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white text-zinc-900 rounded-bl-md border border-zinc-100'
                            }`}>
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                              <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-zinc-400'}`}>
                                {new Date(m.created_at).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
                className="border-t border-zinc-100 shrink-0"
              >
                {pendingFile && (
                  <div className="px-5 pt-3 flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs">
                      {pendingFile.type.startsWith('image/')
                        ? <ImageIcon className="w-4 h-4 text-primary-600" />
                        : <FileText className="w-4 h-4 text-primary-600" />}
                      <span className="font-bold truncate flex-1">{pendingFile.name}</span>
                      <span className="text-zinc-500">{formatBytes(pendingFile.size)}</span>
                    </div>
                    <button type="button" onClick={() => setPendingFile(null)} className="p-1 rounded-lg hover:bg-zinc-100">
                      <X className="w-4 h-4 text-zinc-500" />
                    </button>
                  </div>
                )}
                <div className="px-5 py-3 flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 15 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 15 Mo).'); e.target.value = ''; return; }
                      setPendingFile(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Joindre un fichier ou une image"
                    className="p-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Écrire un message…"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={sending || uploading || (!draft.trim() && !pendingFile)}
                    className="p-2.5 rounded-xl bg-primary-600 text-white disabled:opacity-40"
                    title={uploading ? 'Téléversement…' : 'Envoyer'}
                  >
                    {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      {showNewDm && (
        <PickUserModal
          users={allUsers}
          onClose={() => setShowNewDm(false)}
          onPick={(u) => { setShowNewDm(false); openDm(u); }}
        />
      )}
      {showNewGroup && (
        <NewGroupModal
          users={allUsers}
          onClose={() => setShowNewGroup(false)}
          onCreated={handleGroupCreated}
        />
      )}
    </div>
  );
}

// ═══════════════ Modals ═══════════════

function PickUserModal({ users, onClose, onPick }: { users: UserTarget[]; onClose: () => void; onPick: (u: UserTarget) => void }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? users.filter((u) => u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)) : users;
  }, [users, q]);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-zinc-900">Nouvelle conversation</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4" /></button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un utilisateur…"
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
        />
        <div className="flex-1 overflow-y-auto -mx-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">Aucun utilisateur.</p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {filtered.map((u) => (
                <button key={u.id} onClick={() => onPick(u)}
                  className="w-full text-left px-2 py-2.5 flex items-center gap-3 hover:bg-zinc-50 rounded-lg">
                  {u.avatar_url ? (
                    <img src={resolvePublicAssetUrl(u.avatar_url)} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-zinc-200 text-zinc-600 font-black text-[10px] flex items-center justify-center">
                      {u.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{u.name}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewGroupModal({ users, onClose, onCreated }: { users: UserTarget[]; onClose: () => void; onCreated: (cid: number, title: string) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? users.filter((u) => u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)) : users;
  }, [users, q]);

  const toggle = (id: number) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const submit = async () => {
    if (!title.trim()) { toast.error('Titre du groupe requis.'); return; }
    if (picked.size < 1) { toast.error('Choisissez au moins un membre.'); return; }
    setSaving(true);
    const res = await api.post<{ conversation_id: number; title: string }>('internal-chat/conversations', {
      title: title.trim(),
      user_ids: Array.from(picked),
    });
    setSaving(false);
    if (!res.ok || !res.data) { toast.error(res.message || 'Erreur.'); return; }
    toast.success('Groupe créé.');
    onCreated(res.data.conversation_id, res.data.title);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-zinc-900 inline-flex items-center gap-2"><Users className="w-4 h-4" /> Nouveau groupe</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4" /></button>
        </div>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nom du groupe *"
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher des membres…"
          className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
        />
        <div className="text-xs font-bold text-zinc-500">{picked.size} sélectionné{picked.size > 1 ? 's' : ''}</div>
        <div className="flex-1 overflow-y-auto -mx-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-6">Aucun utilisateur.</p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {filtered.map((u) => {
                const on = picked.has(u.id);
                return (
                  <label key={u.id}
                    className={`w-full text-left px-2 py-2.5 flex items-center gap-3 hover:bg-zinc-50 rounded-lg cursor-pointer ${on ? 'bg-primary-50' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(u.id)} className="rounded" />
                    {u.avatar_url ? (
                      <img src={resolvePublicAssetUrl(u.avatar_url)} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-zinc-200 text-zinc-600 font-black text-[10px] flex items-center justify-center">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{u.name}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{u.email}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
          <button onClick={submit} disabled={saving || !title.trim() || picked.size === 0}
            className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-40">
            {saving ? '…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Renders an attachment inline: images as thumbnails, everything else as a download link. */
function AttachmentPreview({ m, mine }: { m: { attachment_url?: string | null; attachment_name?: string | null; attachment_mime?: string | null; attachment_size?: number | null }; mine: boolean }) {
  if (!m.attachment_url) return null;
  const url = resolvePublicAssetUrl(m.attachment_url);
  const isImage = (m.attachment_mime ?? '').startsWith('image/');
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mb-2">
        <img
          src={url}
          alt={m.attachment_name ?? 'image'}
          className="rounded-lg max-h-64 w-auto object-cover"
        />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={m.attachment_name ?? undefined}
      className={`mb-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${
        mine ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
      }`}
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[180px]">{m.attachment_name ?? 'Fichier'}</span>
      {m.attachment_size ? <span className={`text-[10px] ${mine ? 'text-white/70' : 'text-zinc-500'}`}>{formatBytes(m.attachment_size)}</span> : null}
      <Download className="w-3.5 h-3.5 opacity-60" />
    </a>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}
