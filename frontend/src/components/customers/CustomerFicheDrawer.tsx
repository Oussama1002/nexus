import React, { useEffect, useState } from 'react';
import { Archive, Pencil } from 'lucide-react';
import { Drawer } from '../ui/Drawer';
import { formatCurrency } from '../../lib/utils';
import * as api from '../../lib/api';
import {
  CLIENT_SOURCE_OPTIONS,
  CLIENT_TYPE_OPTIONS,
  INTEREST_LEVEL_OPTIONS,
  LANGUAGE_OPTIONS,
  LIFECYCLE_OPTIONS,
  PAYMENT_PREF_OPTIONS,
  labelFromOptions,
} from '../../lib/customerFormConstants';

export type CrmStats = {
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
  last_contact_at: string | null;
  returns_count: number;
  cancellations_count: number;
  complaints_count: number;
  customer_score: number;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 space-y-3">
      <h3 className="text-[11px] font-black uppercase tracking-widest text-primary-700">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,38%)_1fr] gap-x-3 gap-y-0.5 text-sm border-b border-zinc-100/90 pb-2 last:border-0">
      <span className="text-zinc-500 font-bold">{label}</span>
      <span className="text-zinc-900 font-medium break-words">{value ?? '—'}</span>
    </div>
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

type DetailPayload = {
  customer: Record<string, unknown> & {
    assigned_user?: { name?: string; email?: string } | null;
    origin_lead?: { id?: number; source?: string; status?: string } | null;
    brand?: { name?: string } | null;
  };
  crm_stats: CrmStats;
};

type Props = {
  customerId: number | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  canUpdate: boolean;
  onArchive?: (id: number) => void;
};

export function CustomerFicheDrawer({ customerId, open, onClose, onEdit, canUpdate, onArchive }: Props) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!open || !customerId) {
      setData(null);
      return;
    }
    let c = false;
    setLoading(true);
    (async () => {
      const res = await api.get<DetailPayload>(`customers/${customerId}`);
      if (c) return;
      setLoading(false);
      if (res.ok && res.data) setData(res.data as DetailPayload);
      else setData(null);
    })();
    return () => {
      c = true;
    };
  }, [open, customerId]);

  const cust = data?.customer;
  const stats = data?.crm_stats;

  return (
    <Drawer
      open={open && customerId !== null}
      onClose={onClose}
      widthClassName="w-[min(100vw,640px)]"
      title={cust ? (cust.full_name as string) : 'Fiche client'}
      subtitle={cust ? `${cust.phone as string}` : undefined}
    >
      {loading && <p className="text-sm font-bold text-zinc-500">Chargement…</p>}
      {!loading && !cust && <p className="text-sm text-zinc-600">Impossible de charger le client.</p>}
      {cust && stats && (
        <div className="space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
          {canUpdate && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-black inline-flex items-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" /> Modifier la fiche
              </button>
              {onArchive && customerId && (cust.lifecycle_status as string) !== 'inactive' && (
                <button
                  type="button"
                  disabled={archiving}
                  onClick={async () => {
                    setArchiving(true);
                    const res = await api.put(`customers/${customerId}`, { lifecycle_status: 'inactive' });
                    setArchiving(false);
                    if (res.ok) {
                      onArchive(customerId);
                      onClose();
                    }
                  }}
                  className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 text-xs font-black inline-flex items-center gap-2 hover:bg-zinc-50"
                >
                  <Archive className="w-3.5 h-3.5" /> {archiving ? 'Archivage…' : 'Archiver client'}
                </button>
              )}
            </div>
          )}

          <Section title="Identité">
            <Row label="Nom complet" value={cust.full_name as string} />
            <Row label="Téléphone principal" value={cust.phone as string} />
            <Row label="Téléphone secondaire" value={cust.phone_secondary as string} />
            <Row label="Email" value={cust.email as string} />
            <Row label="Ville" value={cust.city as string} />
            <Row label="Quartier" value={cust.neighborhood as string} />
            <Row label="Adresse complète" value={cust.address as string} />
          </Section>

          <Section title="Informations commerciales">
            <Row label="Marque liée" value={(cust.brand as { name?: string } | undefined)?.name} />
            <Row
              label="Source client"
              value={labelFromOptions(CLIENT_SOURCE_OPTIONS as unknown as { value: string; label: string }[], cust.client_source as string)}
            />
            <Row
              label="Statut client"
              value={labelFromOptions(LIFECYCLE_OPTIONS as unknown as { value: string; label: string }[], (cust.lifecycle_status as string) || (cust.status as string))}
            />
            <Row
              label="Type client"
              value={labelFromOptions(CLIENT_TYPE_OPTIONS as unknown as { value: string; label: string }[], cust.client_type as string)}
            />
            <Row
              label="Niveau d’intérêt"
              value={labelFromOptions(INTEREST_LEVEL_OPTIONS as unknown as { value: string; label: string }[], cust.interest_level as string)}
            />
          </Section>

          <Section title="Livraison">
            <Row label="Ville livraison" value={cust.delivery_city as string} />
            <Row label="Adresse livraison par défaut" value={cust.delivery_address as string} />
            <Row label="Point de repère" value={cust.delivery_landmark as string} />
            <Row label="Zone / région" value={cust.delivery_zone as string} />
            <Row
              label="Frais livraison par défaut"
              value={
                cust.default_shipping_fee != null && cust.default_shipping_fee !== ''
                  ? formatCurrency(parseFloat(String(cust.default_shipping_fee)))
                  : '—'
              }
            />
          </Section>

          <Section title="Historique CRM">
            <Row label="Nombre de commandes" value={String(stats.orders_count)} />
            <Row label="Total dépensé" value={formatCurrency(stats.total_spent)} />
            <Row label="Dernière commande" value={fmtDate(stats.last_order_at)} />
            <Row label="Dernier contact" value={fmtDate(stats.last_contact_at)} />
            <Row
              label="Lead d’origine"
              value={
                cust.origin_lead ? `#${cust.origin_lead.id} · ${cust.origin_lead.source ?? ''} (${cust.origin_lead.status ?? ''})` : '—'
              }
            />
            <Row
              label="Confirmatrice assignée"
              value={
                cust.assigned_user ? `${cust.assigned_user.name ?? ''}${cust.assigned_user.email ? ` · ${cust.assigned_user.email}` : ''}` : '—'
              }
            />
            <Row label="Notes internes" value={<span className="whitespace-pre-wrap">{cust.internal_notes as string}</span>} />
          </Section>

          <Section title="Préférences">
            <Row label="Produits préférés" value={<span className="whitespace-pre-wrap">{cust.preferred_products as string}</span>} />
            <Row label="Taille / couleur préférée" value={cust.preferred_variant as string} />
            <Row
              label="Langue préférée"
              value={labelFromOptions(LANGUAGE_OPTIONS as unknown as { value: string; label: string }[], cust.preferred_language as string)}
            />
            <Row
              label="Préférence de paiement"
              value={labelFromOptions(PAYMENT_PREF_OPTIONS as unknown as { value: string; label: string }[], cust.preferred_payment as string)}
            />
          </Section>

          <Section title="Risque / qualité">
            <Row label="Nombre de retours" value={String(stats.returns_count)} />
            <Row label="Nombre d’annulations" value={String(stats.cancellations_count)} />
            <Row label="Réclamations" value={String(stats.complaints_count)} />
            <Row label="Score client" value={String(stats.customer_score)} />
            <Row label="Motif blacklist" value={<span className="whitespace-pre-wrap">{cust.blacklist_reason as string}</span>} />
          </Section>
        </div>
      )}
    </Drawer>
  );
}
