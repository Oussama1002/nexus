import React, { useMemo, useState } from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { Drawer } from '../components/ui/Drawer';
import { StatusChip } from '../components/ui/StatusChip';
import { formatCurrency } from '../lib/utils';

export type DeliveryCompany = {
  id: string;
  name: string;
  contact: string;
  zones: string;
  avgCost: number;
  status: 'Actif' | 'Inactif';
  performance: number; // 0..100
};

export type Courier = {
  id: string;
  name: string;
  phone: string;
  companyId: string;
  deliveries: number;
  successRate: number; // 0..100
  status: 'Actif' | 'Inactif';
};

export type DeliveryPayment = {
  id: string;
  companyId: string;
  label: string;
  amount: number;
  state: 'Dû' | 'Payé' | 'En attente';
};

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: Parameters<typeof StatusChip>[0]['tone'] }) {
  return (
    <div className="card p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="text-2xl font-black text-zinc-900">{value}</p>
        <StatusChip tone={tone ?? 'neutral'} />
      </div>
    </div>
  );
}

export function DeliveryScreen({
  companies,
  couriers,
  payments,
}: {
  companies: DeliveryCompany[];
  couriers: Courier[];
  payments: DeliveryPayment[];
}) {
  const [tab, setTab] = useState<'Sociétés de livraison' | 'Livreurs' | 'Paiements livraison' | 'Statistiques'>('Sociétés de livraison');
  const [q, setQ] = useState('');
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null);
  const [openCourierId, setOpenCourierId] = useState<string | null>(null);

  const filteredCompanies = useMemo(() => {
    const s = q.trim().toLowerCase();
    return companies.filter((c) => {
      if (!s) return true;
      const blob = `${c.name} ${c.contact} ${c.zones} ${c.status}`.toLowerCase();
      return blob.includes(s);
    });
  }, [companies, q]);

  const filteredCouriers = useMemo(() => {
    const s = q.trim().toLowerCase();
    return couriers.filter((c) => {
      if (!s) return true;
      const blob = `${c.name} ${c.phone} ${companies.find((x) => x.id === c.companyId)?.name ?? ''} ${c.status}`.toLowerCase();
      return blob.includes(s);
    });
  }, [couriers, q, companies]);

  const selectedCompany = useMemo(() => companies.find((c) => c.id === openCompanyId) ?? null, [companies, openCompanyId]);
  const selectedCourier = useMemo(() => couriers.find((c) => c.id === openCourierId) ?? null, [couriers, openCourierId]);

  const kpis = useMemo(() => {
    const inProgress = 24; // placeholder (to bind to shipments)
    const delivered = 180;
    const returned = 22;
    const cancelled = 8;
    const deliveryRate = delivered ? Math.round((delivered / (delivered + returned + cancelled)) * 100) : 0;
    const avgDelay = 2.4;
    return { inProgress, delivered, returned, cancelled, deliveryRate, avgDelay };
  }, []);

  const paymentKpi = useMemo(() => {
    const due = payments.filter((p) => p.state === 'Dû').reduce((s, p) => s + p.amount, 0);
    const paid = payments.filter((p) => p.state === 'Payé').reduce((s, p) => s + p.amount, 0);
    const pending = payments.filter((p) => p.state === 'En attente').reduce((s, p) => s + p.amount, 0);
    return { due, paid, pending };
  }, [payments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livraison"
        subtitle="Gestion logistique: sociétés, livreurs, paiements et performance."
        right={
          <button
            onClick={() => alert('Créer: placeholder')}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Kpi label="Colis en cours" value={kpis.inProgress} />
        <Kpi label="Livrés" value={kpis.delivered} tone="success" />
        <Kpi label="Retournés" value={kpis.returned} tone="warning" />
        <Kpi label="Annulés" value={kpis.cancelled} tone="danger" />
        <Kpi label="Taux de livraison" value={`${kpis.deliveryRate}%`} tone={kpis.deliveryRate >= 85 ? 'success' : kpis.deliveryRate >= 70 ? 'warning' : 'danger'} />
        <Kpi label="Délai moyen" value={`${kpis.avgDelay} j`} />
      </div>

      <div className="card p-3 flex flex-wrap items-center gap-2">
        {(['Sociétés de livraison', 'Livreurs', 'Paiements livraison', 'Statistiques'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${tab === t ? 'bg-primary-50 text-primary-700' : 'hover:bg-zinc-50 text-zinc-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <FilterBar
        query={q}
        onQueryChange={setQ}
        right={
          tab === 'Paiements livraison' ? (
            <div className="flex items-center gap-2 text-sm font-black text-zinc-700">
              <CreditCard className="w-4 h-4 text-zinc-400" />
              Dus {formatCurrency(paymentKpi.due)} • Payés {formatCurrency(paymentKpi.paid)} • En attente {formatCurrency(paymentKpi.pending)}
            </div>
          ) : null
        }
      />

      {tab === 'Sociétés de livraison' && (
        <DataTable
          rows={filteredCompanies}
          columns={[
            { key: 'company', header: 'Société', cell: (c) => <button onClick={() => setOpenCompanyId(c.id)} className="font-black text-zinc-900 hover:underline">{c.name}</button> },
            { key: 'contact', header: 'Contact', cell: (c) => <span className="font-bold text-zinc-700">{c.contact || '—'}</span> },
            { key: 'zones', header: 'Zones', cell: (c) => <span className="font-bold text-zinc-700">{c.zones}</span> },
            { key: 'cost', header: 'Coût moyen', cell: (c) => <span className="font-black text-zinc-900">{formatCurrency(c.avgCost)}</span> },
            { key: 'status', header: 'Statut', cell: (c) => <StatusChip tone={c.status === 'Actif' ? 'success' : 'warning'}>{c.status}</StatusChip> },
            { key: 'perf', header: 'Performance', cell: (c) => <StatusChip tone={c.performance >= 80 ? 'success' : c.performance >= 65 ? 'warning' : 'danger'}>{c.performance}%</StatusChip> },
          ]}
          emptyTitle="Aucune société"
          emptyDescription="Ajoute une société de livraison."
        />
      )}

      {tab === 'Livreurs' && (
        <DataTable
          rows={filteredCouriers}
          columns={[
            { key: 'name', header: 'Nom', cell: (c) => <button onClick={() => setOpenCourierId(c.id)} className="font-black text-zinc-900 hover:underline">{c.name}</button> },
            { key: 'phone', header: 'Téléphone', cell: (c) => <span className="font-bold text-zinc-700">{c.phone}</span> },
            { key: 'company', header: 'Société', cell: (c) => <span className="font-bold text-zinc-700">{companies.find((x) => x.id === c.companyId)?.name ?? '—'}</span> },
            { key: 'del', header: 'Livraisons', cell: (c) => <span className="font-bold text-zinc-700">{c.deliveries}</span> },
            { key: 'rate', header: 'Taux de réussite', cell: (c) => <StatusChip tone={c.successRate >= 85 ? 'success' : c.successRate >= 70 ? 'warning' : 'danger'}>{c.successRate}%</StatusChip> },
            { key: 'status', header: 'Statut', cell: (c) => <StatusChip tone={c.status === 'Actif' ? 'success' : 'warning'}>{c.status}</StatusChip> },
          ]}
          emptyTitle="Aucun livreur"
          emptyDescription="Ajoute un livreur."
        />
      )}

      {tab === 'Paiements livraison' && (
        <DataTable
          rows={payments}
          columns={[
            { key: 'label', header: 'Paiement', cell: (p) => <span className="font-black text-zinc-900">{p.label}</span> },
            { key: 'company', header: 'Société', cell: (p) => <span className="font-bold text-zinc-700">{companies.find((x) => x.id === p.companyId)?.name ?? '—'}</span> },
            { key: 'amount', header: 'Montant', cell: (p) => <span className="font-black text-zinc-900">{formatCurrency(p.amount)}</span> },
            { key: 'state', header: 'État', cell: (p) => <StatusChip tone={p.state === 'Payé' ? 'success' : p.state === 'Dû' ? 'warning' : 'neutral'}>{p.state}</StatusChip> },
          ]}
          emptyTitle="Aucun paiement"
          emptyDescription="Aucun paiement enregistré."
        />
      )}

      {tab === 'Statistiques' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card p-6">
            <p className="text-sm font-black text-zinc-900">Statistiques</p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Placeholders de graphiques (livraison/retours/SLA/coûts).</p>
            <div className="mt-5 h-44 rounded-2xl bg-gradient-to-br from-zinc-50 to-white border border-zinc-200 flex items-center justify-center">
              <span className="text-xs font-bold text-zinc-400">Zone graphique</span>
            </div>
          </div>
          <div className="card p-6">
            <p className="text-sm font-black text-zinc-900">Performance</p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Comparaison sociétés / livreurs.</p>
            <div className="mt-5 h-44 rounded-2xl bg-gradient-to-br from-zinc-50 to-white border border-zinc-200 flex items-center justify-center">
              <span className="text-xs font-bold text-zinc-400">Zone graphique</span>
            </div>
          </div>
        </div>
      )}

      <Drawer
        open={Boolean(selectedCompany)}
        onClose={() => setOpenCompanyId(null)}
        title={selectedCompany ? selectedCompany.name : ''}
        subtitle={selectedCompany ? `${selectedCompany.status} • ${selectedCompany.zones}` : ''}
        footer={
          selectedCompany && (
            <div className="flex items-center justify-between gap-3">
              <button className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
                Éditer (placeholder)
              </button>
              <button className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700">
                Enregistrer (placeholder)
              </button>
            </div>
          )
        }
      >
        {selectedCompany && (
          <div className="space-y-5">
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Infos</p>
              <div className="mt-3 space-y-2 text-sm font-bold text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Contact</span>
                  <span className="text-zinc-900">{selectedCompany.contact}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Coût moyen</span>
                  <span className="text-zinc-900">{formatCurrency(selectedCompany.avgCost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Performance</span>
                  <span className="text-zinc-900">{selectedCompany.performance}%</span>
                </div>
              </div>
            </div>
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Paiements</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — reconciliation COD, bordereaux.</p>
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        open={Boolean(selectedCourier)}
        onClose={() => setOpenCourierId(null)}
        title={selectedCourier ? selectedCourier.name : ''}
        subtitle={selectedCourier ? `${selectedCourier.phone} • ${companies.find((x) => x.id === selectedCourier.companyId)?.name ?? '—'}` : ''}
      >
        {selectedCourier && (
          <div className="space-y-5">
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Infos</p>
              <div className="mt-3 space-y-2 text-sm font-bold text-zinc-700">
                <div className="flex items-center justify-between">
                  <span>Livraisons</span>
                  <span className="text-zinc-900">{selectedCourier.deliveries}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Taux de réussite</span>
                  <span className="text-zinc-900">{selectedCourier.successRate}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Statut</span>
                  <span className="text-zinc-900">{selectedCourier.status}</span>
                </div>
              </div>
            </div>
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-900">Statistiques</p>
              <p className="mt-2 text-sm font-medium text-zinc-600">Placeholder — retours, annulations, SLA.</p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

