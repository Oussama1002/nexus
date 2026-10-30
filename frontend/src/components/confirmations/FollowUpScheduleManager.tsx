import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import * as api from '../../lib/api';
import { useToast } from '../../context/ToastContext';

type ScheduleRow = {
  id: number;
  product_id: number | null;
  product_name: string | null;
  offsets: number[];
  repeat_every_days: number | null;
  is_active: boolean;
};

type Payload = { schedules: ScheduleRow[]; default: { offsets: number[]; repeat_every_days: number | null } };

function parseOffsets(input: string): number[] {
  return input
    .split(/[,\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

/** Gestion du calendrier de fidélisation par marque/produit (spec §6.6). */
export function FollowUpScheduleManager() {
  const toast = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // Formulaire d'ajout/édition d'un calendrier.
  const [formProduct, setFormProduct] = useState<string>(''); // '' = défaut marque
  const [formOffsets, setFormOffsets] = useState('');
  const [formRepeat, setFormRepeat] = useState('');

  const load = useCallback(async () => {
    const res = await api.get<Payload>('follow-up-schedules');
    if (res.ok && res.data) setData(res.data);
  }, []);

  useEffect(() => {
    void load();
    void (async () => {
      const res = await api.get<{ data?: { id: number; name: string }[] } | { id: number; name: string }[]>('products?per_page=200');
      if (!res.ok) return;
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setProducts(rows as { id: number; name: string }[]);
    })();
  }, [load]);

  // Pré-remplit le formulaire selon le produit sélectionné (ou le défaut marque).
  useEffect(() => {
    if (!data) return;
    const pid = formProduct ? Number(formProduct) : null;
    const existing = data.schedules.find((s) => (s.product_id ?? null) === pid);
    const base = existing ?? (pid === null ? { offsets: data.default.offsets, repeat_every_days: data.default.repeat_every_days } : null);
    setFormOffsets(base ? base.offsets.join(', ') : '');
    setFormRepeat(base?.repeat_every_days != null ? String(base.repeat_every_days) : '');
  }, [formProduct, data]);

  const overrides = useMemo(() => (data?.schedules ?? []).filter((s) => s.product_id !== null), [data]);
  const brandDefault = useMemo(() => (data?.schedules ?? []).find((s) => s.product_id === null) ?? null, [data]);

  const save = useCallback(async () => {
    const offsets = parseOffsets(formOffsets);
    if (offsets.length === 0) {
      toast.error('Indiquez au moins un délai (ex. 7, 14, 21).');
      return;
    }
    setSaving(true);
    const res = await api.put('follow-up-schedules', {
      product_id: formProduct ? Number(formProduct) : null,
      offsets,
      repeat_every_days: formRepeat.trim() ? Number(formRepeat) : null,
      is_active: true,
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Calendrier enregistré.');
    await load();
  }, [formOffsets, formRepeat, formProduct, toast, load]);

  const remove = useCallback(async (id: number) => {
    const res = await api.del(`follow-up-schedules/${id}`);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Calendrier supprimé.');
    await load();
  }, [toast, load]);

  return (
    <div className="card p-6 space-y-4">
      <div>
        <p className="text-sm font-black text-zinc-900">Calendrier de fidélisation (admin)</p>
        <p className="mt-1 text-xs font-medium text-zinc-500">
          Délais des rappels après livraison, en jours. Par défaut : {data?.default.offsets.join(', ') ?? '—'}
          {data?.default.repeat_every_days ? `, puis tous les ${data.default.repeat_every_days} j` : ''}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3">
        <label className="block text-xs font-black uppercase text-zinc-700">Cible
          <select value={formProduct} onChange={(e) => setFormProduct(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold">
            <option value="">Défaut de la marque</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-black uppercase text-zinc-700">Reprogrammer tous les (jours)
          <input value={formRepeat} onChange={(e) => setFormRepeat(e.target.value)} placeholder="ex. 30 (vide = stop)" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
        </label>
      </div>
      <label className="block text-xs font-black uppercase text-zinc-700">Délais (jours après livraison, séparés par des virgules)
        <input value={formOffsets} onChange={(e) => setFormOffsets(e.target.value)} placeholder="7, 14, 21, 28, 35, 42, 57, 72" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
      </label>
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black hover:bg-primary-700 disabled:opacity-50"
      >
        {saving ? 'Enregistrement…' : (formProduct ? 'Enregistrer le calendrier produit' : 'Enregistrer le calendrier marque')}
      </button>

      {(brandDefault || overrides.length > 0) && (
        <div className="pt-2 border-t border-zinc-100 space-y-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Calendriers définis</p>
          {brandDefault && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2 text-sm">
              <span className="font-bold text-zinc-800">Marque (défaut) — {brandDefault.offsets.join(', ')}{brandDefault.repeat_every_days ? ` · +${brandDefault.repeat_every_days}j` : ''}</span>
              <button type="button" onClick={() => void remove(brandDefault.id)} className="text-zinc-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          )}
          {overrides.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2 text-sm">
              <span className="font-bold text-zinc-800">{o.product_name ?? `Produit #${o.product_id}`} — {o.offsets.join(', ')}{o.repeat_every_days ? ` · +${o.repeat_every_days}j` : ''}</span>
              <button type="button" onClick={() => void remove(o.id)} className="text-zinc-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
