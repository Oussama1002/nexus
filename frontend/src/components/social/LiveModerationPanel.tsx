import React, { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Heart, MessageCircle, RefreshCw } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { PostCommentsPanel } from './PostCommentsPanel';
import * as api from '../../lib/api';

type Account = { id: number; platform: string; account_name: string };

type Post = {
  id: string;
  caption: string;
  published_at: string | null;
  media_url: string | null;
  permalink: string | null;
  likes: number;
  comments: number;
};

/**
 * Modération en direct : les vraies publications des comptes connectés et
 * leurs commentaires, au lieu d'un journal saisi après coup.
 */
export function LiveModerationPanel({ canModerate }: { canModerate: boolean }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api.get<{ data: Account[] }>('social-accounts?per_page=100');
      if (cancelled) return;
      const rows = res.ok && Array.isArray(res.data?.data) ? res.data.data : [];
      setAccounts(rows);
      setAccountId((prev) => prev ?? rows[0]?.id ?? null);
      if (rows.length === 0) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPosts = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    setOpenPost(null);
    const res = await api.get<{ posts: Post[]; warning: string | null }>(
      `social-accounts/${accountId}/insights?limit=12`,
    );
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      setPosts([]);
      return;
    }
    setPosts(res.data?.posts ?? []);
    if (res.data?.warning) setError(res.data.warning);
  }, [accountId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  if (accounts.length === 0 && !loading) {
    return (
      <EmptyState
        title="Aucun compte social"
        description="Importez vos Pages et comptes Instagram depuis Comptes sociaux pour modérer ici."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={accountId ?? ''}
          onChange={(e) => setAccountId(Number(e.target.value))}
          className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-900"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_name} · {a.platform === 'instagram' ? 'Instagram' : 'Facebook'}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void loadPosts()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : posts.length === 0 ? (
        <EmptyState title="Aucune publication" description="Ce compte n’a pas de publication récente." />
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} className="card p-4">
              <div className="flex items-start gap-3">
                {post.media_url ? (
                  <img src={post.media_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-zinc-200 shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-zinc-100 border border-zinc-200 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  {post.caption && <p className="text-sm text-zinc-800 line-clamp-2">{post.caption}</p>}
                  <p className="text-[11px] font-semibold text-zinc-500 mt-1">
                    {post.published_at ? new Date(post.published_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                  </p>
                  <div className="flex items-center gap-4 text-xs font-black text-zinc-600 mt-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" /> {post.likes}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenPost(openPost === post.id ? null : post.id)}
                      className="inline-flex items-center gap-1 hover:text-primary-600"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> {post.comments} commentaire{post.comments > 1 ? 's' : ''}
                    </button>
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary-600 hover:underline"
                      >
                        Ouvrir <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {openPost === post.id && accountId && (
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <PostCommentsPanel accountId={accountId} postId={post.id} canModerate={canModerate} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
