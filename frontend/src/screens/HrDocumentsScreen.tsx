import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type HrDocument = {
  id: number;
  title: string;
  type: string;
  employee_name: string;
  status: string;
  created_at: string;
  expires_at: string | null;
};

const TYPE_COLORS: Record<string, string> = {
  Contrat: 'bg-blue-50 text-blue-700',
  Attestation: 'bg-violet-50 text-violet-700',
  Avenant: 'bg-amber-50 text-amber-700',
  Autre: 'bg-zinc-100 text-zinc-600',
};

const STATUS_COLORS: Record<string, string> = {
  'Signé': 'bg-emerald-50 text-emerald-700',
  'En attente': 'bg-amber-50 text-amber-700',
  'Expiré': 'bg-red-50 text-red-700',
};

export function HrDocumentsScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<HrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await api.get<Paginated<HrDocument>>(
        'hr-documents' + buildQuery({ per_page: 25, page, search: search || undefined, type: typeFilter || undefined, status: statusFilter || undefined }),
      );
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.message);
        setRows([]);
        return;
      }
      setRows(res.data.data);
      setTotal(res.data.total);
      setLastPage(res.data.last_page);
    })();
    return () => { cancelled = true; };
  }, [page, search, typeFilter, statusFilter, toast]);

  const stats = useMemo(() => {
    const contrats = rows.filter((r) => r.type === 'Contrat').length;
    const attestations = rows.filter((r) => r.type === 'Attestation').length;
    const enAttente = rows.filter((r) => r.status === 'En attente').length;
    return { total, contrats, attestations, enAttente };
  }, [rows, total]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents RH"
        subtitle="Contrats, attestations et documents administratifs"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total documents</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.total}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Contrats</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.contrats}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Attestations</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.attestations}</p></div>
        <div className="card p-4"><p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En attente signature</p><p className="text-2xl font-black text-zinc-900 mt-1">{stats.enAttente}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les types</option>
          <option value="Contrat">Contrat</option>
          <option value="Attestation">Attestation</option>
          <option value="Avenant">Avenant</option>
          <option value="Autre">Autre</option>
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">Tous les statuts</option>
          <option value="Signé">Signé</option>
          <option value="En attente">En attente</option>
          <option value="Expiré">Expiré</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun document trouvé" description="Les documents RH apparaîtront ici." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date création</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Expiration</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.title}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${TYPE_COLORS[r.type] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.employee_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[r.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm text-zinc-700">{r.expires_at ? new Date(r.expires_at).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Page {page} sur {lastPage} — {total} résultats</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold disabled:opacity-40">Précédent</button>
              <button disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold disabled:opacity-40">Suivant</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
