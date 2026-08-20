import React, { useEffect, useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { buildQuery, type Paginated } from '../lib/pagination';

type DocRow = {
  id: number;
  employee?: { id: number; full_name: string; department: string | null };
  title: string;
  document_type: string;
  file_url: string;
  expiry_date: string | null;
  is_signed: boolean;
  uploaded_by?: { id: number; name: string } | null;
  created_at: string;
};

type EmpOpt = { id: number; full_name: string };

const DOC_TYPES = [
  { value: 'contrat', label: 'Contrat' },
  { value: 'avenant', label: 'Avenant' },
  { value: 'attestation', label: 'Attestation' },
  { value: 'cin', label: 'CIN' },
  { value: 'cnss', label: 'CNSS' },
  { value: 'rib', label: 'RIB' },
  { value: 'diplome', label: 'Diplôme' },
  { value: 'autre', label: 'Autre' },
];

const isExpiringSoon = (date: string | null) => {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const days = (d.getTime() - now.getTime()) / (86400 * 1000);
  return days >= 0 && days <= 60;
};

export function HrDocumentsScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    employee_id: '', title: '', document_type: 'contrat', file_url: '',
    expiry_date: '', notes: '',
  });

  const load = async () => {
    setLoading(true);
    const res = await api.get<Paginated<DocRow>>('hr/hr-documents' + buildQuery({
      per_page: 25, page,
      document_type: typeFilter || undefined,
      expiring_soon: expiringOnly ? 1 : undefined,
    }));
    setLoading(false);
    if (!res.ok) { toast.error(res.message); return; }
    setRows(res.data.data); setLastPage(res.data.last_page);
  };
  useEffect(() => { load(); }, [page, typeFilter, expiringOnly]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      const res = await api.get<Paginated<EmpOpt>>('hr' + buildQuery({ per_page: 100 }));
      if (res.ok) setEmployees(res.data.data.map((e: any) => ({ id: e.id, full_name: e.full_name })));
    })();
  }, []);

  const save = async () => {
    if (!form.employee_id || !form.title.trim() || !form.file_url.trim()) {
      toast.error('Employé, titre et fichier requis.'); return;
    }
    const res = await api.post('hr/hr-documents', {
      employee_id: Number(form.employee_id),
      title: form.title, document_type: form.document_type,
      file_url: form.file_url,
      expiry_date: form.expiry_date || undefined,
      notes: form.notes || undefined,
    });
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Document ajouté.'); setShowCreate(false);
    setForm({ employee_id: '', title: '', document_type: 'contrat', file_url: '', expiry_date: '', notes: '' });
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents RH"
        subtitle="Contrats, attestations et pièces justificatives"
        right={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">Tous les types</option>
          {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm font-bold text-zinc-700">
          <input type="checkbox" checked={expiringOnly} onChange={(e) => { setExpiringOnly(e.target.checked); setPage(1); }} />
          Expiration proche (60 j)
        </label>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : rows.length === 0 ? (
        <EmptyState title="Aucun document" description="Ajoutez le premier document RH." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Employé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Expiration</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Ajouté</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Fichier</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-bold text-zinc-900">{r.employee?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-800">{r.title}</td>
                    <td className="px-4 py-3 text-xs uppercase text-zinc-600">{r.document_type}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.expiry_date ? (
                        <span className={`inline-flex items-center gap-1 ${isExpiringSoon(r.expiry_date) ? 'text-amber-700 font-bold' : 'text-zinc-600'}`}>
                          {isExpiringSoon(r.expiry_date) && <AlertTriangle className="w-3.5 h-3.5" />}
                          {new Date(r.expiry_date).toLocaleDateString('fr-FR')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {new Date(r.created_at).toLocaleDateString('fr-FR')}<br />
                      {r.uploaded_by?.name ?? ''}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <a href={r.file_url} target="_blank" rel="noreferrer" className="text-primary-600 font-bold">Ouvrir</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-xl font-black text-zinc-900">Ajouter un document</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-sm font-bold text-zinc-700">Employé *
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                  <option value="">— sélectionner —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Titre *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-bold text-zinc-700">Type
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.document_type} onChange={(e) => setForm({ ...form, document_type: e.target.value })}>
                  {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-zinc-700">Expiration
                <input type="date" className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">URL du fichier *
                <input className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} />
              </label>
              <label className="col-span-2 text-sm font-bold text-zinc-700">Notes
                <textarea className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={save} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black">Ajouter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
