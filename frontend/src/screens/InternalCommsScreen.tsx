import React, { useEffect, useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type CommRow = {
  id: number;
  title: string;
  comm_type: string;
  content: string;
  requires_acknowledgment: boolean;
  requires_signature: boolean;
  target_audience: string;
  status: string;
  published_at: string | null;
  published_by?: { id: number; name: string } | null;
  receipts_count?: number;
  read_count?: number;
  acknowledged_count?: number;
};

const TYPES = [
  { value: 'note_service', label: 'Note de service' },
  { value: 'annonce', label: 'Annonce' },
  { value: 'reglement', label: 'Règlement' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'formation', label: 'Formation' },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-zinc-100 text-zinc-600' },
  publie: { label: 'Publié', cls: 'bg-emerald-50 text-emerald-700' },
  archive: { label: 'Archivé', cls: 'bg-zinc-100 text-zinc-500' },
};

export function InternalCommsScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<CommRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '', comm_type: 'note_service', content: '', attachment_url: '',
    requires_acknowledgment: false, requires_signature: false, target_audience: 'all',
  });

  const load = async () => {
    setLoading(true);
    const res = await api.get<Paginated<CommRow>>('hr/communications' + buildQuery({ per_page: 25, page }));
    setLoading(false);
    if (!res.ok) { toast.error(res.message); return; }
    setRows(res.data.data); setLastPage(res.data.last_page);
  };
  useEffect(() => { load(); }, [page]); // eslint-disable-line

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('Titre et contenu requis.'); return; }
    const res = await api.post('hr/communications', {
      title: form.title, comm_type: form.comm_type, content: form.content,
      attachment_url: form.attachment_url || undefined,
      requires_acknowledgment: form.requires_acknowledgment,
      requires_signature: form.requires_signature,
      target_audience: form.target_audience,
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Communication créée.'); setShowCreate(false);
    setForm({ title: '', comm_type: 'note_service', content: '', attachment_url: '', requires_acknowledgment: false, requires_signature: false, target_audience: 'all' });
    load();
  };

  const publish = async (id: number) => {
    if (!confirm('Publier cette communication ? Elle sera envoyée aux destinataires.')) return;
    const res = await api.post(`hr/communications/${id}/publish`, {});
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Publiée.'); load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications internes"
        subtitle="Notes de service et annonces"
        right={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle
          </button>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucune communication" description="Créez votre première note de service." />
      ) : (
        <>
          <div className="grid gap-3">
            {rows.map((r) => {
              const s = STATUS[r.status] ?? { label: r.status, cls: 'bg-zinc-100 text-zinc-600' };
              const total = r.receipts_count ?? 0;
              return (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-zinc-900">{r.title}</h3>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${s.cls}`}>{s.label}</span>
                        <span className="text-[10px] uppercase text-zinc-400 font-bold">{r.comm_type}</span>
                      </div>
                      {r.published_at && <p className="text-xs text-zinc-500 mt-1">Publiée le {new Date(r.published_at).toLocaleDateString('fr-FR')}{r.published_by ? ` par ${r.published_by.name}` : ''}</p>}
                    </div>
                    {r.status === 'brouillon' && (
                      <button onClick={() => publish(r.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-black">
                        <Send className="w-3.5 h-3.5" /> Publier
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 whitespace-pre-wrap line-clamp-3">{r.content}</p>
                  {r.status === 'publie' && total > 0 && (
                    <div className="flex gap-4 mt-3 pt-3 border-t border-zinc-100 text-xs">
                      <span className="text-zinc-500"><b className="text-zinc-800">{r.read_count ?? 0}</b>/{total} lus</span>
                      {r.requires_acknowledgment && <span className="text-zinc-500"><b className="text-zinc-800">{r.acknowledged_count ?? 0}</b>/{total} accusés</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-500">Page {page} sur {lastPage}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold disabled:opacity-40">Précédent</button>
              <button disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-sm font-bold disabled:opacity-40">Suivant</button>
            </div>
          </div>
        </>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle communication</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Titre *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Type
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.comm_type} onChange={(e) => setForm({ ...form, comm_type: e.target.value })}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Audience
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })}>
                  <option value="all">Toute l'entreprise</option>
                  <option value="departments">Départements spécifiques</option>
                  <option value="specific">Employés spécifiques</option>
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Contenu *
                <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Pièce jointe (URL)
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.attachment_url} onChange={(e) => setForm({ ...form, attachment_url: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                <input type="checkbox" checked={form.requires_acknowledgment} onChange={(e) => setForm({ ...form, requires_acknowledgment: e.target.checked })} />
                Accusé de réception requis
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
                <input type="checkbox" checked={form.requires_signature} onChange={(e) => setForm({ ...form, requires_signature: e.target.checked })} />
                Signature requise
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Créer brouillon</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
