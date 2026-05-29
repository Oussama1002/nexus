import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusChip } from '../components/ui/StatusChip';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';

type AcademyLesson = {
  id: number;
  title: string;
  category: string;
  content: string;
  media_url: string | null;
};

export function AcademyScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<AcademyLesson[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<Paginated<AcademyLesson>>(
      `academy/lessons${buildQuery({ per_page: 200, search: q.trim() || undefined, category: category || undefined })}`,
    );
    setLoading(false);
    if (!res.ok || !res.data) {
      toast.error(res.message);
      setRows([]);
      return;
    }
    setRows(res.data.data);
  }, [category, q, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))), [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brandna Academy"
        subtitle="Contenus de formation disponibles pour tous les roles."
      />

      <FilterBar
        query={q}
        onQueryChange={setQ}
        right={
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold"
          >
            <option value="">Toutes categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        }
      />

      {rows.length === 0 && !loading ? (
        <EmptyState title="Aucun contenu academy" description="Le manager peut ajouter des contenus RH depuis le module RH." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map((row) => (
            <article key={row.id} className="card p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-zinc-900">{row.title}</h3>
                <StatusChip tone="info">{row.category}</StatusChip>
              </div>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{row.content}</p>
              {row.media_url ? (
                <a href={row.media_url} target="_blank" rel="noreferrer" className="text-sm font-black text-primary-600 hover:underline">
                  Ouvrir ressource
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
