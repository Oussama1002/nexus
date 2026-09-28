import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import * as api from '../../lib/api';
import { isPaginator, type LaravelPaginator } from '../../lib/apiTypes';

export type DispatchTarget = {
  orderId: number;
  orderRef?: string;
  recipientName: string;
  phone: string;
  city: string;
  address: string;
  /** Montant à encaisser à la livraison (0 si déjà payée). */
  codAmount: number;
  deliveryFee?: number;
};

/**
 * « Envoyer à la livraison » : choix du transporteur, puis création de
 * l'expédition dans le CRM et envoi chez le transporteur (Ameex, Sendit…).
 */
export function CarrierDispatchModal({
  target,
  onClose,
  onSent,
}: {
  target: DispatchTarget | null;
  onClose: () => void;
  onSent?: () => void;
}) {
  const toast = useToast();
  const [carriers, setCarriers] = useState<{ id: number; name: string }[]>([]);
  const [carrierId, setCarrierId] = useState('');
  // Modifiables : Ameex refuse un colis sans ville ni montant à encaisser.
  const [cod, setCod] = useState('0');
  const [city, setCity] = useState('');
  const [sending, setSending] = useState(false);
  // L'erreur reste visible dans la popup, en plus du toast.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setCod(String(target.codAmount ?? 0));
    setCity(target.city ?? '');
    let cancelled = false;
    (async () => {
      const res = await api.get<LaravelPaginator<{ id: number; name: string }>>('delivery-companies?per_page=100');
      if (cancelled) return;
      if (res.ok && isPaginator<{ id: number; name: string }>(res.data)) {
        setCarriers(res.data.data);
        setCarrierId((prev) => prev || String(res.data.data[0]?.id ?? ''));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  const send = async () => {
    if (!target || !carrierId) return;
    if (!city.trim()) {
      setError('La ville de livraison est obligatoire : le transporteur la refuse sans elle.');
      return;
    }
    setSending(true);
    setError(null);

    const payload = {
      order_id: target.orderId,
      delivery_company_id: Number(carrierId),
      recipient_name: target.recipientName,
      recipient_phone: target.phone,
      recipient_city: city.trim(),
      recipient_address: target.address || city.trim(),
      cod_amount: Number(cod) || 0,
      delivery_fee: target.deliveryFee ?? 0,
      send_to_carrier: true,
    };

    let res = await api.post('shipments', payload);

    // Une commande « en attente » ne peut pas être expédiée : on la confirme
    // puis on réessaie, l'envoi en livraison valant confirmation.
    if (!res.ok && /confirmed or prepared|confirmée/i.test(res.message)) {
      const confirmRes = await api.patch(`orders/${target.orderId}/status`, { status: 'confirmed' });
      if (!confirmRes.ok) {
        setSending(false);
        setError(confirmRes.message);
        toast.error(confirmRes.message);
        return;
      }
      res = await api.post('shipments', payload);
    }

    setSending(false);
    if (!res.ok) {
      setError(res.message);
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    onSent?.();
    onClose();
  };

  if (!target) return null;

  return (
    <Modal
      open
      title="Envoyer à la livraison"
      subtitle={target.orderRef ? `Commande ${target.orderRef} — ${target.recipientName}` : target.recipientName}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-300 font-black text-sm text-zinc-900">
            Plus tard
          </button>
          <button
            type="button"
            disabled={sending || !carrierId}
            onClick={() => void send()}
            className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm disabled:opacity-50"
          >
            {sending ? 'Envoi…' : 'Envoyer au transporteur'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {error}
          </div>
        )}
        <label className="block text-sm font-bold text-zinc-900">
          Transporteur
          <select
            value={carrierId}
            onChange={(e) => setCarrierId(e.target.value)}
            className="mt-1.5 w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900"
          >
            {carriers.length === 0 && <option value="">Aucun transporteur configuré</option>}
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-bold text-zinc-900">
          Ville de livraison
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Casablanca"
            className="mt-1.5 w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900"
          />
          {!city.trim() && (
            <span className="mt-1 block text-[11px] font-semibold text-amber-700">
              Obligatoire : le transporteur ne livre que les villes de son réseau.
            </span>
          )}
        </label>

        <label className="block text-sm font-bold text-zinc-900">
          À encaisser à la livraison (MAD)
          <input
            type="number"
            min="0"
            step="0.01"
            value={cod}
            onChange={(e) => setCod(e.target.value)}
            className="mt-1.5 w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900"
          />
          {Number(cod) <= 0 && (
            <span className="mt-1 block text-[11px] font-semibold text-amber-700">
              Ameex refuse un colis sans montant à encaisser. Laissez 0 uniquement si la commande est
              déjà payée et sera envoyée autrement.
            </span>
          )}
        </label>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 space-y-1">
          <p><span className="font-bold">Destinataire :</span> {target.recipientName} · {target.phone}</p>
          <p><span className="font-bold">Adresse :</span> {target.address || '—'}</p>
        </div>

        <p className="text-xs text-zinc-500">
          La commande est confirmée si besoin, l’expédition est créée dans le CRM puis envoyée au
          transporteur. « Plus tard » garde la commande telle quelle : vous pourrez l’envoyer depuis la
          liste des commandes.
        </p>
      </div>
    </Modal>
  );
}
