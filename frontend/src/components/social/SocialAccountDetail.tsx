import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Heart, MessageCircle, RefreshCw, Share2 } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

import * as api from '../../lib/api';

type Profile = {
  platform: string;
  name: string;
  handle: string;
  bio: string;
  category?: string;
  url: string;
  avatar: string | null;
  followers: number;
  likes?: number;
  talking_about?: number;
  follows?: number;
  media_count?: number;
  website?: string;
};

type Post = {
  id: string;
  caption: string;
  published_at: string | null;
  media_url: string | null;
  permalink: string | null;
  media_type: string;
  likes: number;
  comments: number;
  shares: number;
};

const MEDIA_LABELS: Record<string, string> = {
  IMAGE: 'Photo',
  VIDEO: 'Vidéo',
  CAROUSEL_ALBUM: 'Carrousel',
  POST: 'Publication',
};

function num(v: number | null | undefined): string {
  return v == null ? '—' : v.toLocaleString('fr-FR');
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-muted px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="text-xl font-black text-zinc-900">{value}</p>
    </div>
  );
}

/** Fiche d'un compte social : profil, abonnés et dernières publications. */
export function SocialAccountDetail({
  accountId,
  accountName,
  onBack,
}: {
  accountId: number;
  accountName: string;
  onBack: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<{ profile: Profile; posts: Post[]; warning: string | null }>(
      `social-accounts/${accountId}/insights?limit=24`,
    );
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setProfile(res.data?.profile ?? null);
    setPosts(res.data?.posts ?? []);
    setWarning(res.data?.warning ?? null);
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isInstagram = profile?.platform === 'instagram';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Compte social</p>
            <p className="text-lg font-black text-zinc-900">{profile?.name || accountName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-zinc-200 text-sm font-black text-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>
      )}

      {loading && !profile ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : profile ? (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-start gap-4">
              {profile.avatar ? (
                <img src={profile.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover border border-zinc-200" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-zinc-100 border border-zinc-200" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xl font-black text-zinc-900">{profile.name}</p>
                {profile.handle && <p className="text-sm font-bold text-zinc-500">@{profile.handle}</p>}
                {profile.category && <p className="text-xs font-semibold text-zinc-500 mt-0.5">{profile.category}</p>}
                {profile.bio && <p className="text-sm text-zinc-600 mt-2 whitespace-pre-line">{profile.bio}</p>}
                {profile.url && (
                  <a
                    href={profile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-black text-primary-600 hover:underline"
                  >
                    Ouvrir le profil <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <Stat label="Abonnés" value={num(profile.followers)} />
              {isInstagram ? (
                <>
                  <Stat label="Abonnements" value={num(profile.follows)} />
                  <Stat label="Publications" value={num(profile.media_count)} />
                </>
              ) : (
                <>
                  <Stat label="Mentions J’aime" value={num(profile.likes)} />
                  <Stat label="En parlent" value={num(profile.talking_about)} />
                </>
              )}
              <Stat label="Publications chargées" value={num(posts.length)} />
            </div>
          </div>

          {warning && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              {warning}
            </div>
          )}

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Dernières publications</p>
            {posts.length === 0 ? (
              <EmptyState title="Aucune publication" description="Meta n’a renvoyé aucune publication pour ce compte." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.map((post) => (
                  <div key={post.id} className="card overflow-hidden flex flex-col">
                    {post.media_url ? (
                      <img src={post.media_url} alt="" className="w-full h-44 object-cover" />
                    ) : (
                      <div className="w-full h-44 bg-zinc-100" />
                    )}
                    <div className="p-4 space-y-2 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                          {MEDIA_LABELS[post.media_type] ?? post.media_type}
                        </span>
                        {post.published_at && (
                          <span className="text-[11px] font-bold text-zinc-500">
                            {new Date(post.published_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                      {post.caption && <p className="text-sm text-zinc-700 line-clamp-3 flex-1">{post.caption}</p>}
                      <div className="flex items-center gap-4 text-xs font-black text-zinc-600 pt-1">
                        <span className="inline-flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" /> {num(post.likes)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" /> {num(post.comments)}
                        </span>
                        {post.shares > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Share2 className="w-3.5 h-3.5" /> {num(post.shares)}
                          </span>
                        )}
                      </div>
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-black text-primary-600 hover:underline"
                        >
                          Voir la publication <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        !error && <EmptyState title="Compte indisponible" description="Meta n’a renvoyé aucune information." />
      )}
    </div>
  );
}
