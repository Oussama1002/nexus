import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { formatCurrency } from '../lib/utils';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';

type DashboardPayload = {
  total_shipments: number;
  pending_shipments: number;
  in_transit_shipments: number;
  delivered_shipments: number;
  returned_shipments: number;
  failed_shipments: number;
  delivery_rate: number;
  return_rate: number;
  cod_pending_amount: number;
  cod_received_amount: number;
  cod_reconciled_amount: number;
  average_delivery_days: number | null;
  shipments_by_company: { delivery_company_id: number | null; count: number }[];
  shipments_by_city: { city_label: string | null; c: number }[];
  delayed_shipments: number;
  revenue?: number;
};

type CarrierOpt = { id: number; name: string; code?: string };

export function DeliveryDashboardScreen() {
  const { activeBrandId } = useBrand();
  const toast = useToast();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [carriers, setCarriers] = useState<CarrierOpt[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [carrierId, setCarrierId] = useState<string>('');

  const loadCarriers = useCallback(async () => {
    const res = await api.get<LaravelPaginator<CarrierOpt>>('delivery-companies?per_page=100');
    if (res.ok && isPaginator<CarrierOpt>(res.data)) setCarriers(res.data.data);
  }, []);

  useEffect(() => {
    void loadCarriers();
  }, [loadCarriers]);

  const load = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (dateFrom) qs.set('date_from', dateFrom);
    if (dateTo) qs.set('date_to', dateTo);
    if (carrierId) qs.set('delivery_company_id', carrierId);
    const res = await api.get<DashboardPayload>(`delivery/dashboard?${qs}`);
    setLoading(false);
    if (res.ok && res.data) setData(res.data as DashboardPayload);
    else if (!res.ok) toast.error(res.message);
  }, [activeBrandId, carrierId, dateFrom, dateTo, toast]);

  const selectedCarrierName = useMemo(() => {
    if (!carrierId) return 'Tous';
    return carriers.find((c) => String(c.id) === carrierId)?.name ?? 'Transporteur';
  }, [carrierId, carriers]);

  const syncOneCarrier = useCallback(async (endpoint: string, label: string) => {
    let startPage = 1;
    let imported = 0;
    let updated = 0;
    let total = 0;

    while (true) {
      const body: Record<string, unknown> = { start_page: startPage, max_pages: 50 };
      const res = await api.post<{
        imported: number;
        updated: number;
        events: number;
        total: number;
        has_more?: boolean;
        next_page?: number;
      }>(endpoint, body);

      if (!res.ok) {
        return { ok: false, message: res.message || `Échec sync ${label}`, imported, updated, total };
      }

      const payload = res.data;
      if (payload) {
        imported += payload.imported ?? 0;
        updated += payload.updated ?? 0;
        total += payload.total ?? 0;
      }

      if (!payload?.has_more) break;
      startPage = payload.next_page ?? startPage + 5;
    }

    return { ok: true, imported, updated, total, message: '' };
  }, []);

  const syncCarrier = useCallback(async () => {
    if (!activeBrandId) return;
    setSyncing(true);
    setSyncProgress('');

    try {
      const results: string[] = [];
      let totalImported = 0;
      let totalUpdated = 0;
      let totalCount = 0;

      setSyncProgress('Sync Ameex…');
      const ameex = await syncOneCarrier('delivery/ameex/sync', 'Ameex');
      if (ameex.ok) {
        totalImported += ameex.imported;
        totalUpdated += ameex.updated;
        totalCount += ameex.total;
        if (ameex.total > 0) results.push(`Ameex: ${ameex.total} colis`);
      } else if (ameex.message && !ameex.message.includes('introuvable')) {
        results.push(`Ameex: ${ameex.message}`);
      }

      setSyncProgress('Sync Sendit…');
      const sendit = await syncOneCarrier('delivery/sendit/sync', 'Sendit');
      if (sendit.ok) {
        totalImported += sendit.imported;
        totalUpdated += sendit.updated;
        totalCount += sendit.total;
        if (sendit.total > 0) results.push(`Sendit: ${sendit.total} colis`);
      } else if (sendit.message && !sendit.message.includes('introuvable')) {
        results.push(`Sendit: ${sendit.message}`);
      }

      if (totalCount > 0) {
        toast.success(
          `Synchronisé : ${totalCount} colis (${totalImported} nouveaux, ${totalUpdated} mis à jour). ${results.join(' | ')}`,
        );
      } else if (results.length > 0) {
        toast.error(results.join(' | '));
      } else {
        toast.success('Synchronisation terminée — aucun nouveau colis.');
      }

      await load();
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  }, [activeBrandId, syncOneCarrier, load, toast]);

  useEffect(() => {
    if (!activeBrandId) return;
    void load();
  }, [activeBrandId, dateFrom, dateTo, carrierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const carrierNameById = useMemo(() => new Map(carriers.map((c) => [c.id, c.name])), [carriers]);

  const cards = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Expéditions totales', value: String(data.total_shipments) },
      { label: 'En attente / créées', value: String(data.pending_shipments) },
      { label: 'En transit', value: String(data.in_transit_shipments) },
      { label: 'Livrées', value: String(data.delivered_shipments) },
      { label: 'Retours', value: String(data.returned_shipments) },
      { label: 'Échecs', value: String(data.failed_shipments) },
      { label: 'Taux livraison', value: `${data.delivery_rate}%` },
      { label: 'Taux retour', value: `${data.return_rate}%` },
      { label: "Chiffre d'affaires", value: formatCurrency(data.revenue ?? 0) },
      { label: 'COD en attente', value: formatCurrency(data.cod_pending_amount) },
      { label: 'COD reçu', value: formatCurrency(data.cod_received_amount ?? 0) },
      { label: 'COD réconcilié', value: formatCurrency(data.cod_reconciled_amount) },
      {
        label: 'Délai moyen (j)',
        value: data.average_delivery_days !== null ? String(data.average_delivery_days) : '—',
      },
      { label: 'Retards (>7j)', value: String(data.delayed_shipments) },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livraison — tableau de bord"
        subtitle="Volume, COD, performance transporteurs et zones."
        right={
          <button
            type="button"
            onClick={() => void syncCarrier()}
            disabled={syncing}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex gap-2 items-center disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? (syncProgress || 'Sync…') : `Sync ${selectedCarrierName}`}
          </button>
        }
      />

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-400">Du</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-400">Au</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-400">Transporteur</label>
          <select
            value={carrierId}
            onChange={(e) => setCarrierId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold min-w-[180px]"
          >
            <option value="">Tous</option>
            {carriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : !data ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Impossible de charger le tableau de bord. Vérifiez vos droits (permission « livraison — tableau de bord ») ou reconnectez-vous.
        </div>
      ) : (
        <>
          {data.total_shipments === 0 && !syncing && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-700">
              <p className="font-bold text-zinc-900">Aucun colis importé</p>
              <p className="mt-1">Cliquez sur « Sync » pour importer vos colis et actions depuis le transporteur sélectionné.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {cards.map((c) => (
              <div key={c.label} className="card p-4 border border-zinc-100">
                <p className="text-[10px] font-black uppercase text-zinc-400">{c.label}</p>
                <p className="text-xl font-black text-zinc-900 mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          {data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-4 border border-zinc-100">
                <p className="text-xs font-black uppercase text-zinc-400 mb-3">Par transporteur</p>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {data.shipments_by_company.length === 0 && <p className="text-sm text-zinc-500">Aucune donnée.</p>}
                  {data.shipments_by_company.map((row, i) => (
                    <div key={i} className="flex justify-between text-sm border-b border-zinc-50 pb-2">
                      <span className="font-bold text-zinc-700">
                        {row.delivery_company_id
                          ? carrierNameById.get(row.delivery_company_id) ?? `Transporteur #${row.delivery_company_id}`
                          : '—'}
                      </span>
                      <span className="font-black">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-4 border border-zinc-100">
                <p className="text-xs font-black uppercase text-zinc-400 mb-3">Par ville</p>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {data.shipments_by_city.length === 0 && <p className="text-sm text-zinc-500">Aucune donnée.</p>}
                  {data.shipments_by_city.map((row, i) => (
                    <div key={i} className="flex justify-between text-sm border-b border-zinc-50 pb-2">
                      <span className="font-bold text-zinc-700">{row.city_label ?? '—'}</span>
                      <span className="font-black">{row.c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
