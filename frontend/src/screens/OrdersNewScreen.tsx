import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Search, User } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { formatCurrency } from '../lib/utils';
import type { OrderBrand, OrderDraft, OrderLine, OrderSource } from '../domain/orders';
import { trackSession } from '../lib/session';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';

type ApiProduct = {
  id: number;
  name: string;
  sku: string;
  price: string;
};

type ApiCustomer = {
  id: number;
  full_name: string;
  phone: string;
  city: string | null;
  address: string | null;
};

const DRAFT_KEY = 'nexus.orderDraft';

export function OrdersNewScreen({
  onBackToList,
  initialDraft,
  activeBrandName,
}: {
  onBackToList: () => void;
  initialDraft?: Partial<OrderDraft>;
  activeBrandName: string;
}) {
  const { activeBrandId } = useBrand();
  const { user } = useAuth();
  const toast = useToast();
  const draftLineSeq = useRef(0);

  const [saving, setSaving] = useState(false);
  const [errLines, setErrLines] = useState<string[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerBoxRef = useRef<HTMLDivElement>(null);

  const [source, setSource] = useState<OrderSource>('WhatsApp');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('+212 ');
  const [city, setCity] = useState('Casablanca');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState<number | undefined>(undefined);
  const [leadId, setLeadId] = useState<number | undefined>(undefined);

  const [lines, setLines] = useState<OrderLine[]>([{ id: 'l1', name: 'Produit', qty: 1, price: 0, productId: undefined }]);
  const [paymentMethod, setPaymentMethod] = useState<'prepaid' | 'cod' | 'transfer'>('prepaid');
  const [bankTransferDeclaredPaid, setBankTransferDeclaredPaid] = useState(false);
  const [bankTransferReference, setBankTransferReference] = useState('');

  useEffect(() => {
    let raw: Partial<OrderDraft> | null = initialDraft ?? null;
    try {
      const s = sessionStorage.getItem(DRAFT_KEY);
      if (s) {
        raw = { ...raw, ...JSON.parse(s) };
        sessionStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // ignore
    }
    if (!raw) return;
    if (raw.source) setSource(raw.source);
    if (typeof raw.customerName === 'string') setCustomerName(raw.customerName);
    if (typeof raw.phone === 'string') setPhone(raw.phone);
    if (typeof raw.city === 'string') setCity(raw.city);
    if (typeof raw.address === 'string') setAddress(raw.address);
    if (typeof raw.notes === 'string') setNotes(raw.notes);
    if (raw.items && raw.items.length > 0) setLines(raw.items);
    if (typeof raw.customerId === 'number') setCustomerId(raw.customerId);
    if (typeof raw.leadId === 'number') setLeadId(raw.leadId);
  }, [initialDraft]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeBrandId) return;
      const [pRes, cRes] = await Promise.all([
        api.get<LaravelPaginator<ApiProduct>>('products?per_page=100'),
        api.get<LaravelPaginator<ApiCustomer>>('customers?per_page=200&status=all'),
      ]);
      if (cancelled) return;
      if (pRes.ok && isPaginator<ApiProduct>(pRes.data)) setProducts(pRes.data.data);
      if (cRes.ok && isPaginator<ApiCustomer>(cRes.data)) setCustomers(cRes.data.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrandId]);

  // Close customer dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!customerName.trim()) return customers;
    const q = customerName.trim().toLowerCase();
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.city ?? '').toLowerCase().includes(q),
    );
  }, [customers, customerName]);

  const selectCustomer = useCallback(
    (c: ApiCustomer) => {
      setCustomerId(c.id);
      setCustomerName(c.full_name);
      setPhone(c.phone);
      setCity(c.city ?? '');
      setAddress(c.address ?? '');
      setShowCustomerDropdown(false);
    },
    [],
  );

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const shipping = 35;
    const total = subtotal + shipping;
    return { subtotal, shipping, total };
  }, [lines]);

  async function submit() {
    setErrLines([]);
    if (!activeBrandId) {
      toast.error('Marque active requise.');
      return;
    }
    if (!customerName.trim() || !phone.trim()) {
      toast.error('Nom et téléphone client requis.');
      return;
    }
    if (paymentMethod === 'transfer' && bankTransferDeclaredPaid && !bankTransferReference.trim()) {
      toast.error('Référence virement requise quand la commande est marquée déjà payée.');
      return;
    }
    setSaving(true);
    let cid = customerId;
    if (!cid) {
      const cRes = await api.post<{ id: number }>('customers', {
        full_name: customerName.trim(),
        phone: phone.trim(),
        city: city.trim() || null,
        address: address.trim() || null,
        status: 'active',
      });
      if (!cRes.ok) {
        setSaving(false);
        const rawErr = 'errors' in cRes ? cRes.errors : {};
        const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
        setErrLines(fe.length ? fe : [cRes.message]);
        toast.error(cRes.message);
        return;
      }
      cid = (cRes.data as { id: number }).id;
    }

    const orderPayload = {
      customer_id: cid,
      lead_id: leadId ?? null,
      assigned_user_id: user ? Number(user.id) : null,
      source,
      status: 'pending',
      payment_method: paymentMethod,
      payment_state: 'unpaid',
      bank_transfer_declared_paid: paymentMethod === 'transfer' ? bankTransferDeclaredPaid : false,
      bank_transfer_reference: paymentMethod === 'transfer' ? (bankTransferReference.trim() || null) : null,
      shipping_fee: totals.shipping,
      discount: 0,
      shipping_address: address.trim() || null,
      notes: notes.trim() || null,
      lines: lines.map((l) => ({
        product_id: l.productId ?? null,
        product_name: l.name,
        quantity: l.qty,
        unit_price: l.price,
      })),
    };

    let oRes = await api.post('orders', orderPayload);
    if (!oRes.ok && oRes.message && oRes.message.includes('doublon')) {
      const confirmed = window.confirm(oRes.message + '\n\nVoulez-vous créer la commande quand même ?');
      if (!confirmed) {
        setSaving(false);
        return;
      }
      oRes = await api.post('orders', { ...orderPayload, skip_duplicate_check: true });
    }
    setSaving(false);
    if (!oRes.ok) {
      const rawErr = 'errors' in oRes ? oRes.errors : {};
      const fe = flattenFieldErrors(rawErr as Record<string, unknown>);
      setErrLines(fe.length ? fe : [oRes.message]);
      toast.error(oRes.message);
      return;
    }
    toast.success('Commande créée.');
    trackSession({
      name: 'audit.order.create',
      ts: Date.now(),
      meta: { brand: activeBrandName, source, city, itemsCount: lines.length },
    });
    onBackToList();
  }

  const brand: OrderBrand = activeBrandName;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nouvelle commande"
        subtitle="Création via API (client + commande)."
        right={
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBackToList} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
              Retour liste
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Envoi…' : 'Créer commande'}
            </button>
          </div>
        }
      />

      {errLines.length > 0 && (
        <div className="card border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 space-y-1">
          {errLines.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="card p-6 space-y-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Client</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 relative" ref={customerBoxRef}>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nom</label>
                <div className="relative">
                  <input
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setCustomerId(undefined); // clear linked customer on free-type
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Tapez pour chercher un client…"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500 pr-10"
                  />
                  {customerId ? (
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  ) : (
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  )}
                </div>
                {customerId && (
                  <p className="text-[11px] text-emerald-600 font-bold">Client existant sélectionné</p>
                )}
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                    {filteredCustomers.slice(0, 30).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors border-b border-zinc-100 last:border-b-0"
                      >
                        <span className="font-bold text-sm text-zinc-800">{c.full_name}</span>
                        <span className="ml-2 text-xs text-zinc-500">{c.phone}</span>
                        {c.city && <span className="ml-2 text-xs text-zinc-400">— {c.city}</span>}
                      </button>
                    ))}
                  </div>
                )}
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
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Paiement</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'prepaid' | 'cod' | 'transfer')}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-800 outline-none"
                >
                  <option value="prepaid">Prépayé</option>
                  <option value="cod">COD (contre remboursement)</option>
                  <option value="transfer">Virement bancaire</option>
                </select>
              </div>
              {paymentMethod === 'transfer' && (
                <>
                  <div className="space-y-2 md:col-span-2">
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-zinc-700">
                      <input
                        type="checkbox"
                        checked={bankTransferDeclaredPaid}
                        onChange={(e) => setBankTransferDeclaredPaid(e.target.checked)}
                      />
                      Déjà payé par virement
                    </label>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Référence virement</label>
                    <input
                      value={bankTransferReference}
                      onChange={(e) => setBankTransferReference(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Ex: TRF-2026-05-12345"
                    />
                    <p className="text-[11px] text-zinc-500">Utilisée par l’automatisation pour vérifier la réception du virement.</p>
                  </div>
                </>
              )}
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
                    {
                      id: `line-${++draftLineSeq.current}`,
                      name: 'Nouveau produit',
                      qty: 1,
                      price: 0,
                      productId: undefined,
                    },
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
                  <div className="md:col-span-12 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Catalogue (optionnel)</label>
                    <select
                      value={l.productId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          setLines((prev) => prev.map((x) => (x.id === l.id ? { ...x, productId: undefined } : x)));
                          return;
                        }
                        const p = products.find((x) => x.id === Number(v));
                        if (!p) return;
                        setLines((prev) =>
                          prev.map((x) => (x.id === l.id ? { ...x, productId: p.id, name: p.name, price: Number(p.price) } : x)),
                        );
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-zinc-200 font-bold text-zinc-700 outline-none"
                    >
                      <option value="">— Saisie manuelle —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-6 space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Libellé ligne</label>
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
                <div className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-black text-zinc-800">{brand}</div>
                <p className="text-[11px] font-medium text-zinc-500">Marque active (session).</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value as OrderSource)} className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 font-bold text-zinc-700 outline-none">
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
