import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import * as api from '../../lib/api';
import { useToast } from '../../context/ToastContext';

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
  const { toast } = useToast();
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

  const openModal = () => {
    setForm(initial());
    setOpen(true);
  };

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
