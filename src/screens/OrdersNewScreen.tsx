import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { formatCurrency } from '../lib/utils';
import type { OrderBrand, OrderDraft, OrderLine, OrderSource } from '../domain/orders';
import { trackSession } from '../lib/session';

export function OrdersNewScreen({
  onBackToList,
  initialDraft,
  onCreate,
  brand,
}: {
  onBackToList: () => void;
  initialDraft?: Partial<OrderDraft>;
  onCreate: (draft: OrderDraft) => void;
  brand: OrderBrand;
}) {
  const [source, setSource] = useState<OrderSource>('WhatsApp');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('+212 ');
  const [city, setCity] = useState('Casablanca');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<OrderLine[]>([{ id: 'l1', name: 'Pack Sérum Vitamine C', qty: 1, price: 450 }]);

  useEffect(() => {
    if (!initialDraft) return;
    if (initialDraft.source) setSource(initialDraft.source);
    if (typeof initialDraft.customerName === 'string') setCustomerName(initialDraft.customerName);
    if (typeof initialDraft.phone === 'string') setPhone(initialDraft.phone);
    if (typeof initialDraft.city === 'string') setCity(initialDraft.city);
    if (typeof initialDraft.address === 'string') setAddress(initialDraft.address);
    if (typeof initialDraft.notes === 'string') setNotes(initialDraft.notes);
    if (initialDraft.items && initialDraft.items.length > 0) setLines(initialDraft.items);
  }, [initialDraft]);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const shipping = 35;
    const total = subtotal + shipping;
    return { subtotal, shipping, total };
  }, [lines]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouvelle commande"
        subtitle="Saisie rapide pour confirmatrices & opérations."
        right={
          <div className="flex items-center gap-3">
            <button onClick={onBackToList} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
              Retour liste
            </button>
            <button className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
              Enregistrer brouillon
            </button>
            <button
              onClick={() => {
                const draft: OrderDraft = {
                  brand,
                  source,
                  customerName: customerName.trim(),
                  phone: phone.trim(),
                  city: city.trim(),
                  address: address.trim(),
                  notes: notes.trim(),
                  items: lines,
                };
                onCreate(draft);
                trackSession({
                  name: 'audit.order.create',
                  ts: Date.now(),
                  meta: {
                    brand: draft.brand,
                    source: draft.source,
                    city: draft.city,
                    hasNotes: Boolean(draft.notes),
                    itemsCount: draft.items.length,
                  },
                });
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors"
            >
              Confirmer
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="card p-6 space-y-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Client</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nom</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Téléphone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Ville</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Adresse</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Produits</p>
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { id: `l${Math.random().toString(16).slice(2, 8)}`, name: 'Nouveau produit', qty: 1, price: 0 },
                  ])
                }
                className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((l) => (
                <div key={l.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end card-muted p-4">
                  <div className="md:col-span-6 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Produit</label>
                    <input
                      value={l.name}
                      onChange={(e) => setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Qté</label>
                    <input
                      type="number"
                      value={l.qty}
                      onChange={(e) => setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, qty: Number(e.target.value) } : x)))}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Prix</label>
                    <input
                      type="number"
                      value={l.price}
                      onChange={(e) => setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, price: Number(e.target.value) } : x)))}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="md:col-span-1 flex md:justify-end">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((x) => x.id !== l.id))}
                      className="p-3 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50"
                      aria-label="Remove line"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Notes</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Notes confirmatrice, instructions livraison…"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Contexte</p>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Marque</label>
                <div className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-800">
                  {brand}
                </div>
                <p className="text-[11px] font-medium text-zinc-500">Marque active (session).</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value as any)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none">
                  <option>WhatsApp</option>
                  <option>Facebook</option>
                  <option>TikTok</option>
                  <option>Instagram</option>
                  <option>Google</option>
                  <option>Autre</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Totaux</p>
            <div className="space-y-2 text-sm font-bold text-zinc-700">
              <div className="flex items-center justify-between">
                <span>Sous-total</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Livraison</span>
                <span>{formatCurrency(totals.shipping)}</span>
              </div>
              <div className="h-px bg-zinc-100 my-3" />
              <div className="flex items-center justify-between text-zinc-900 text-base font-black">
                <span>Total</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

