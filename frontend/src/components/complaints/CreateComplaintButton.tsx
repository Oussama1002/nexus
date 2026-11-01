import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Check } from 'lucide-react';
import * as api from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import type { LaravelPaginator } from '../../lib/apiTypes';

type CustomerOpt = { id: number; full_name: string; phone?: string | null };

/**
 * Small icon button that opens a "Nouvelle réclamation" form pre-filled
 * with context from the surrounding module (order, customer, conversation…).
 *
 * Meant to be dropped anywhere a user might want to raise a réclamation
 * without navigating away — row actions, detail drawers, conversation headers.
 */
export type ComplaintPreset = {
  customer_name?: string;
  customer_phone?: string;
  customer_handle?: string;
  channel?: 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'email' | 'telephone' | 'autre' | string;
  category?: 'produit' | 'livraison' | 'service' | 'facturation' | 'autre' | string;
  priority?: 'P1' | 'P2' | 'P3';
  description?: string;
  /** Free-text tag written into the description prefix (e.g. "Commande #123"). */
  source_label?: string;
};

export function CreateComplaintButton({
  preset,
  size = 'icon',
  className,
  onCreated,
  title = 'Créer une réclamation',
}: {
  preset?: ComplaintPreset;
  size?: 'icon' | 'button';
  className?: string;
  onCreated?: () => void;
  title?: string;
}) {
  const { showToast: toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const initial = () => ({
    customer_name: preset?.customer_name ?? '',
    customer_phone: preset?.customer_phone ?? '',
    customer_handle: preset?.customer_handle ?? '',
    channel: preset?.channel ?? 'telephone',
    category: preset?.category ?? 'produit',
    priority: preset?.priority ?? 'P2',
    description: preset?.description ?? (preset?.source_label ? `${preset.source_label} — ` : ''),
  });
  const [form, setForm] = useState(initial);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [custOpen, setCustOpen] = useState(false);
  const custRef = useRef<HTMLDivElement>(null);

  const loadCustomers = async () => {
    if (customers.length) return;
    const res = await api.get<LaravelPaginator<CustomerOpt>>('customers?per_page=200');
    if (res.ok && res.data?.data) setCustomers(res.data.data);
  };

  const openModal = () => {
    setForm(initial());
    setOpen(true);
    void loadCustomers();
  };

  // Ferme la liste client au clic en dehors.
  useEffect(() => {
    if (!custOpen) return;
    const onDown = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setCustOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [custOpen]);

  const pickCustomer = (c: CustomerOpt) => {
    setForm((f) => ({
      ...f,
      customer_name: c.full_name,
      customer_phone: c.phone ?? f.customer_phone,
    }));
    setCustOpen(false);
  };

  const custQuery = form.customer_name.trim().toLowerCase();
  const filteredCustomers = custQuery
    ? customers.filter((c) => c.full_name.toLowerCase().includes(custQuery))
    : customers;
  const exactMatch = customers.some((c) => c.full_name.toLowerCase() === custQuery);

  const submit = async () => {
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
      setOpen(false);
      onCreated?.();
    } finally { setSaving(false); }
  };

  return (
    <>
      {size === 'icon' ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openModal(); }}
          className={
            className ??
            'p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors'
          }
          title={title}
        >
          <AlertTriangle size={15} />
        </button>
      ) : (
        <button
          type="button"
          onClick={openModal}
          className={
            className ??
            'inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-black hover:bg-red-100'
          }
        >
          <AlertTriangle size={16} /> {title}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-zinc-900">Nouvelle réclamation</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 text-sm font-bold text-zinc-700">Nom du client *
                <div ref={custRef} className="relative mt-1">
                  <input
                    className="w-full px-3 py-2 pr-9 rounded-xl border border-zinc-200 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                    value={form.customer_name}
                    placeholder="Choisir un client ou saisir un nouveau nom"
                    onFocus={() => setCustOpen(true)}
                    onChange={(e) => { setForm((f) => ({ ...f, customer_name: e.target.value })); setCustOpen(true); }}
                  />
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none"
                  />
                  {custOpen && (
                    <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg py-1">
                      {custQuery && !exactMatch && (
                        <div className="px-3 py-2 text-xs font-bold text-primary-700 bg-primary-50/60">
                          Nouveau client : « {form.customer_name.trim()} »
                        </div>
                      )}
                      {filteredCustomers.map((c) => {
                        const selected = c.full_name.toLowerCase() === custQuery;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pickCustomer(c)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-50"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-bold text-zinc-900 truncate">{c.full_name}</span>
                              {c.phone && <span className="block text-xs font-medium text-zinc-500">{c.phone}</span>}
                            </span>
                            {selected && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
                          </button>
                        );
                      })}
                      {filteredCustomers.length === 0 && !custQuery && (
                        <p className="px-3 py-2 text-xs font-medium text-zinc-500">Aucun client enregistré.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
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
                <select className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as any })}>
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
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Annuler</button>
              <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">{saving ? 'Envoi…' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
