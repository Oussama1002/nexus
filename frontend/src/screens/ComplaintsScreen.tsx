import React, { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';

type Complaint = {
  id: number;
  customer_name: string;
  subject: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'open', label: 'Ouvert' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'resolved', label: 'Résolu' },
  { value: 'closed', label: 'Fermé' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'high', label: 'Haute' },
  { value: 'medium', label: 'Moyenne' },
  { value: 'low', label: 'Basse' },
];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-yellow-50 text-yellow-700',
  resolved: 'bg-green-50 text-green-700',
  closed: 'bg-zinc-100 text-zinc-600',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-700',
  medium: 'bg-orange-50 text-orange-700',
  low: 'bg-green-50 text-green-700',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

export function ComplaintsScreen() {
  const { activeBrandId } = useBrand();
  const { toast } = useToast();
  const [rows, setRows] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_handle: '',
    channel: 'instagram',
    category: 'produit',
    priority: 'P2',
    description: '',
  });

  const submitCreate = async () => {
    if (!form.customer_name.trim() || !form.description.trim()) {
      toast('error', 'Nom du client et description requis.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('complaints', {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || undefined,
        customer_handle: form.customer_handle || undefined,
        channel: form.channel,
        category: form.category,
        priority: form.priority,
        description: form.description,
      });
      if (!res.ok) { toast('error', res.message ?? 'Erreur.'); return; }
      toast('success', 'Réclamation créée.');
      setShowCreate(false);
      setForm({ customer_name: '', customer_phone: '', customer_handle: '', channel: 'instagram', category: 'produit', priority: 'P2', description: '' });
      setReloadTick((t) => t + 1);
    } finally { setSaving(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<Complaint>>(
          'complaints' + buildQuery({ per_page: 25, page, search: search || undefined, status: statusFilter || undefined, priority: priorityFilter || undefined })
        );
        if (cancelled) return;
        if (res.ok) {
          setRows(res.data.data);
          setTotal(res.data.total);
          setLastPage(res.data.last_page);
        } else {
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setLastPage(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [page, search, statusFilter, priorityFilter, activeBrandId, reloadTick]);

  const totalCount = total;
  const inProgressCount = rows.filter(r => r.status === 'in_progress').length;
  const resolvedCount = rows.filter(r => r.status === 'resolved').length;
  const resolutionRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Réclamations" subtitle="Suivi et traitement des réclamations clients">
        <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Nouvelle réclamation
        </button>
      </PageHeader>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle réclamation</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Nom du client *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Téléphone
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Handle / pseudo
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.customer_handle} onChange={(e) => setForm({ ...form, customer_handle: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Canal
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="tiktok">TikTok</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="telephone">Téléphone</option>
                  <option value="autre">Autre</option>
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Catégorie
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="produit">Produit</option>
                  <option value="livraison">Livraison</option>
                  <option value="service">Service client</option>
                  <option value="facturation">Facturation</option>
                  <option value="autre">Autre</option>
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Priorité
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="P1">P1 — Haute</option>
                  <option value="P2">P2 — Moyenne</option>
                  <option value="P3">P3 — Basse</option>
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Description *
                <textarea rows={4} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={submitCreate} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">{saving ? 'Envoi…' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{totalCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">En cours</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{inProgressCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Résolues</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{resolvedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Taux de résolution</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{resolutionRate}%</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
            placeholder="Rechercher…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
          value={priorityFilter}
          onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
        >
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!loading && rows.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={40} />} title="Aucune réclamation" description="Aucune réclamation trouvée pour les filtres sélectionnés." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">N°</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Sujet</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Priorité</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Assigné à</th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">Chargement…</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm font-medium">#{row.id}</td>
                  <td className="px-4 py-3 text-sm">{row.customer_name}</td>
                  <td className="px-4 py-3 text-sm">{row.subject}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLORS[row.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_COLORS[row.priority] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {PRIORITY_LABELS[row.priority] ?? row.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{row.assigned_to ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-zinc-500">{new Date(row.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">Page {page} sur {lastPage} — {total} résultat(s)</p>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary p-2" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-secondary p-2" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
