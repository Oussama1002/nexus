import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusChip } from '../components/ui/StatusChip';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { useAuth } from '../context/AuthContext';

type ClientOverview = {
  widgets: string[];
  kpis: {
    orders: { total: number; confirmed: number; cancelled: number; in_progress: number };
    delivery: { total: number; delivered: number; returned: number; in_progress: number };
    ads: { spend: number; revenue: number; leads: number; roas: number | null };
  };
  timeline: { id: number; action: string; at: string; actor: string }[];
};

type AccessRow = {
  user: { id: number; name: string; email: string };
  enabled_widgets: string[];
};

type AccessPayload = {
  allowed_widgets: string[];
  rows: AccessRow[];
};

const WIDGET_LABELS: Record<string, string> = {
  orders_overview: 'Vue commandes',
  delivery_overview: 'Vue livraison',
  ads_overview: 'Vue publicités',
  activity_timeline: 'Timeline activité',
};

function hasWidget(widgets: string[], key: string): boolean {
  return widgets.includes(key);
}

export function ClientPortalScreen() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('client_portal.manage');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  const [access, setAccess] = useState<AccessPayload | null>(null);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const res = await api.get<ClientOverview>('client-portal/overview');
    setLoading(false);
    if (!res.ok) {
      toast.error(res.message);
      setOverview(null);
      return;
    }
    setOverview(res.data ?? null);
  }, [toast]);

  const loadAccess = useCallback(async () => {
    if (!canManage) return;
    const res = await api.get<AccessPayload>('client-portal/access');
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setAccess(res.data ?? null);
  }, [canManage, toast]);

  useEffect(() => {
    void loadOverview();
    void loadAccess();
  }, [loadOverview, loadAccess]);

  const widgets = overview?.widgets ?? [];

  const cards = useMemo(() => {
    if (!overview) return [];
    return [
      { key: 'orders_overview', title: 'Commandes total', value: String(overview.kpis.orders.total) },
      { key: 'orders_overview', title: 'Commandes confirmées', value: String(overview.kpis.orders.confirmed) },
      { key: 'orders_overview', title: 'Commandes annulées', value: String(overview.kpis.orders.cancelled) },
      { key: 'delivery_overview', title: 'Livraisons en cours', value: String(overview.kpis.delivery.in_progress) },
      { key: 'delivery_overview', title: 'Livraisons délivrées', value: String(overview.kpis.delivery.delivered) },
      { key: 'ads_overview', title: 'Ad spend', value: overview.kpis.ads.spend.toFixed(2) },
      { key: 'ads_overview', title: 'Revenue ads', value: overview.kpis.ads.revenue.toFixed(2) },
      { key: 'ads_overview', title: 'ROAS', value: overview.kpis.ads.roas != null ? String(overview.kpis.ads.roas) : '—' },
    ].filter((c) => hasWidget(widgets, c.key));
  }, [overview, widgets]);

  async function saveRow(row: AccessRow) {
    setSavingUserId(row.user.id);
    const res = await api.put(`client-portal/access/${row.user.id}`, {
      enabled_widgets: row.enabled_widgets,
    });
    setSavingUserId(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(`Accès mis à jour pour ${row.user.name}.`);
    await loadAccess();
  }

  function toggleWidget(row: AccessRow, widget: string) {
    if (!access) return;
    const nextRows = access.rows.map((r) => {
      if (r.user.id !== row.user.id) return r;
      const has = r.enabled_widgets.includes(widget);
      const next = has ? r.enabled_widgets.filter((w) => w !== widget) : [...r.enabled_widgets, widget];
      return { ...r, enabled_widgets: next };
    });
    setAccess({ ...access, rows: nextRows });
  }

  if (loading) {
    return <div className="card p-6 text-sm font-bold text-zinc-600">Chargement du dashboard client…</div>;
  }

  if (!overview) {
    return <EmptyState title="Aucune donnée" description="Le dashboard client n’est pas disponible pour cette marque." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Espace Client (Dashboard externe)"
        subtitle="Vue limitée propriétaire de marque — aucun accès WhatsApp ni données internes sensibles."
      />

      <div className="card p-4">
        <p className="text-xs font-black uppercase text-zinc-500 mb-2">Widgets activés pour ce client</p>
        <div className="flex flex-wrap gap-2">
          {widgets.map((w) => (
            <StatusChip key={w} tone="info">{WIDGET_LABELS[w] ?? w}</StatusChip>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={`${c.key}-${c.title}`} className="card p-4">
            <p className="text-[10px] font-black uppercase text-zinc-400">{c.title}</p>
            <p className="text-xl font-black mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {hasWidget(widgets, 'activity_timeline') ? (
        <div className="card p-5">
          <p className="text-sm font-black text-zinc-900 mb-3">Activité récente</p>
          <div className="space-y-2">
            {overview.timeline.map((item) => (
              <div key={item.id} className="card-muted p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-zinc-800">{item.action}</div>
                <div className="text-xs text-zinc-500">{item.actor}</div>
                <div className="text-xs text-zinc-500">{new Date(item.at).toLocaleString()}</div>
              </div>
            ))}
            {overview.timeline.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucune activité à afficher.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {canManage && access ? (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-black text-zinc-900">Contrôle accès client (agence)</p>
          {access.rows.map((row) => (
            <div key={row.user.id} className="card-muted p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-zinc-900">{row.user.name}</p>
                  <p className="text-xs text-zinc-500">{row.user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void saveRow(row)}
                  disabled={savingUserId === row.user.id}
                  className="px-3 py-1.5 rounded-xl bg-primary-600 text-white text-xs font-black disabled:opacity-50"
                >
                  {savingUserId === row.user.id ? 'Enregistrement…' : 'Sauver'}
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {access.allowed_widgets.map((w) => (
                  <label key={w} className="inline-flex items-center gap-2 text-xs font-bold text-zinc-700">
                    <input
                      type="checkbox"
                      checked={row.enabled_widgets.includes(w)}
                      onChange={() => toggleWidget(row, w)}
                    />
                    {WIDGET_LABELS[w] ?? w}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
