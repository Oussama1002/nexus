import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Send, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import * as api from '../../lib/api';

type Comment = {
  id: string;
  author: string;
  message: string;
  created_at: string | null;
  likes: number;
  hidden: boolean;
};

/**
 * Commentaires d'une publication : répondre au nom de la Page, masquer,
 * réafficher ou supprimer.
 */
export function PostCommentsPanel({
  accountId,
  postId,
  canModerate,
}: {
  accountId: number;
  postId: string;
  canModerate: boolean;
}) {
  const toast = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<Comment[]>(`social-accounts/${accountId}/posts/${encodeURIComponent(postId)}/comments`);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setComments(Array.isArray(res.data) ? res.data : []);
  }, [accountId, postId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendReply(commentId: string) {
    if (!replyText.trim()) return;
    setBusy(true);
    const res = await api.post(`social-accounts/${accountId}/comments/${encodeURIComponent(commentId)}/reply`, {
      message: replyText.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    setReplyTo(null);
    setReplyText('');
    await load();
  }

  async function moderate(commentId: string, action: 'hide' | 'unhide' | 'delete') {
    if (action === 'delete' && !window.confirm('Supprimer définitivement ce commentaire ?')) return;
    setBusy(true);
    const res = await api.post(`social-accounts/${accountId}/comments/${encodeURIComponent(commentId)}/moderate`, { action });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    await load();
  }

  if (loading) {
    return <p className="text-xs font-semibold text-zinc-500 px-1 py-2">Chargement des commentaires…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
        {error}
      </div>
    );
  }

  if (comments.length === 0) {
    return <p className="text-xs font-semibold text-zinc-400 px-1 py-2">Aucun commentaire.</p>;
  }

  return (
    <div className="space-y-2">
      {comments.map((c) => (
        <div key={c.id} className={`rounded-xl border px-3 py-2 ${c.hidden ? 'border-zinc-200 bg-zinc-50 opacity-70' : 'border-zinc-200 bg-white'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-black text-zinc-900">
                {c.author || 'Anonyme'}
                {c.hidden && <span className="ml-2 text-[10px] font-bold text-zinc-500">masqué</span>}
              </p>
              <p className="text-xs text-zinc-700 whitespace-pre-wrap">{c.message}</p>
              <p className="text-[10px] font-semibold text-zinc-400">
                {c.created_at ? new Date(c.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                {c.likes > 0 ? ` · ${c.likes} J’aime` : ''}
              </p>
            </div>
            {canModerate && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Répondre"
                  onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText(''); }}
                  className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={c.hidden ? 'Réafficher' : 'Masquer'}
                  onClick={() => void moderate(c.id, c.hidden ? 'unhide' : 'hide')}
                  disabled={busy}
                  className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                >
                  {c.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  title="Supprimer"
                  onClick={() => void moderate(c.id, 'delete')}
                  disabled={busy}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {replyTo === c.id && (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Votre réponse…"
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => void sendReply(c.id)}
                disabled={busy || !replyText.trim()}
                className="px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-black disabled:opacity-50 inline-flex items-center gap-1"
              >
                {busy && <Loader2 className="w-3 h-3 animate-spin" />} Répondre
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
