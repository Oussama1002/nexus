import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { ConfirmatriceStats } from '../components/confirmations/ConfirmatriceStats';
import { ReminderList, type Reminder } from '../components/confirmations/ReminderList';
import { UpsellRequests } from '../components/confirmations/UpsellRequests';
import { useBrand } from '../context/BrandContext';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import { trackSession } from '../lib/session';
import type { User } from '../types';

type WorkspaceSummary = {
  conversations_total: number;
  leads_open: number;
  leads_new: number;
  orders_confirmed: number;
  orders_cancelled: number;
  orders_pending: number;
  orders_total: number;
  reminders_due: number;
  upsells_open: number;
  satisfaction_rate: number;
  follow_up_rate: number;
  reminders: Reminder[];
};

export function ConfirmatriceSpaceScreen({
  viewerRole,
  workspaceUserId,
  selectedConfirmatriceName,
  confirmatriceOptions,
  noConfirmatriceInDirectory,
  usersDirectoryLoaded,
  onSelectConfirmatrice,
  onOpenWhatsApp,
  onOpenOrders,
  onOpenLeads,
  onCreateOrder,
  onNavigateToUsersAdmin,
  onCloseNoConfirmatriceModal,
}: {
  viewerRole: User['role'];
  workspaceUserId: string;
  selectedConfirmatriceName: string;
  confirmatriceOptions: { id: string; name: string }[];
  /** True when aucun utilisateur n’a le rôle confirmatrice (liste API vide). */
  noConfirmatriceInDirectory: boolean;
  /** Évite d’afficher la modal « aucune confirmatrice » avant la fin du GET /users. */
  usersDirectoryLoaded: boolean;
  onSelectConfirmatrice: (id: string) => void;
  onOpenWhatsApp: () => void;
  onOpenOrders: () => void;
  onOpenLeads: () => void;
  onCreateOrder: () => void;
  onNavigateToUsersAdmin: () => void;
  onCloseNoConfirmatriceModal: () => void;
}) {
  const isSelf = viewerRole === 'confirmatrice';
  const pageTitle = isSelf ? 'Votre espace' : 'Espace Confirmatrice';
  const pageSubtitle = isSelf
    ? 'Données liées à votre marque active et à vos assignations.'
    : `Supervision — ${selectedConfirmatriceName || '—'}.`;

  const { activeBrandId } = useBrand();
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!workspaceUserId || !activeBrandId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await api.get<WorkspaceSummary>(
      `confirmatrice-workspace/summary${buildQuery({ user_id: workspaceUserId })}`,
      { brandId: activeBrandId },
    );
    if (res.ok && res.data) {
      setSummary(res.data);
    } else {
      setSummary(null);
      setError(res.message);
    }
    setLoading(false);
  }, [workspaceUserId, activeBrandId]);

  useEffect(() => {
    if (noConfirmatriceInDirectory && !isSelf) return;
    void loadSummary();
  }, [loadSummary, noConfirmatriceInDirectory, isSelf]);

  const confirmationRate = useMemo(() => {
    if (!summary) return 0;
    const c = summary.orders_confirmed + summary.orders_cancelled;
    if (c <= 0) return 0;
    return (summary.orders_confirmed / c) * 100;
  }, [summary]);

  const showSupervisorSetupModal = usersDirectoryLoaded && !isSelf && noConfirmatriceInDirectory;

  if (!usersDirectoryLoaded && !isSelf) {
    return (
      <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement des utilisateurs…</div>
    );
  }

  if (showSupervisorSetupModal) {
    return (
      <>
        <Modal
          open
          title="Aucune confirmatrice"
          onClose={onCloseNoConfirmatriceModal}
          footer={
            <button
              type="button"
              onClick={() => {
                trackSession({ name: 'audit.confirmatrice.goto_users_admin', ts: Date.now() });
                onNavigateToUsersAdmin();
              }}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-black text-sm"
            >
              Créer une confirmatrice (Utilisateurs)
            </button>
          }
        >
          <p className="text-sm font-medium text-zinc-700">
            Il n’existe encore aucun compte avec le rôle <strong>confirmatrice</strong>. Créez d’abord une utilisatrice et
            assignez-lui ce rôle (et au moins une marque), puis revenez ici.
          </p>
        </Modal>
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">
          Espace indisponible tant qu’aucune confirmatrice n’est définie.
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        right={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {viewerRole === 'admin' && confirmatriceOptions.length > 0 && (
              <div className="flex flex-col gap-1 min-w-[200px]">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Confirmatrice</label>
                <select
                  value={workspaceUserId}
                  onChange={(e) => onSelectConfirmatrice(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-800 outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {confirmatriceOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  trackSession({ name: 'audit.confirmatrice.quick.open_whatsapp', ts: Date.now() });
                  onOpenWhatsApp();
                }}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Ouvrir WhatsApp
              </button>
              <button
                type="button"
                onClick={() => {
                  trackSession({ name: 'audit.confirmatrice.quick.create_order', ts: Date.now() });
                  onCreateOrder();
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-2xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
              >
                <ArrowUpRight className="w-4 h-4" /> Créer commande
              </button>
            </div>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>
      )}
      {loading && !summary && (
        <p className="text-sm font-bold text-zinc-500">Chargement des indicateurs…</p>
      )}

      {/* KPI cards — données API */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Conversations assignées</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{summary?.conversations_total ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Leads en cours</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{summary?.leads_open ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Commandes confirmées</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{summary?.orders_confirmed ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Commandes annulées</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{summary?.orders_cancelled ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Relances dues</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{summary?.reminders_due ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Upsells ouverts</p>
          <p className="mt-2 text-2xl font-black text-indigo-600">{summary?.upsells_open ?? 0}</p>
          <p className="mt-1 text-[10px] text-zinc-400">Non branché en base pour l’instant.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-6 xl:col-span-2">
          <div className="card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-zinc-900">Queues opérationnelles</p>
                <p className="mt-1 text-xs font-medium text-zinc-500">Compteurs pour la marque active.</p>
              </div>
              <div className="flex gap-2">
                {!isSelf && (
                  <button
                    type="button"
                    onClick={onOpenLeads}
                    className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50"
                  >
                    Mes leads
                  </button>
                )}
                <button type="button" onClick={onOpenOrders} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50">
                  Mes commandes
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card-muted p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Leads nouveaux (statut)</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">{summary?.leads_new ?? '—'}</p>
                <button
                  type="button"
                  onClick={onOpenWhatsApp}
                  className="mt-4 w-full py-2.5 rounded-xl bg-primary-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-primary-700 transition-colors"
                >
                  Ouvrir conversations
                </button>
              </div>
              <div className="card-muted p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Commandes en attente</p>
                <p className="mt-2 text-2xl font-black text-zinc-900">{summary?.orders_pending ?? '—'}</p>
                <button
                  type="button"
                  onClick={onOpenOrders}
                  className="mt-4 w-full py-2.5 rounded-xl border border-zinc-200 text-zinc-700 font-black text-[11px] uppercase tracking-widest hover:bg-zinc-50 transition-colors"
                >
                  Voir commandes
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ReminderList
              reminders={summary?.reminders ?? []}
              onOpen={() => {
                trackSession({ name: 'audit.confirmatrice.reminder.open', ts: Date.now() });
                onOpenWhatsApp();
              }}
            />

            <UpsellRequests
              items={[]}
              onOpen={() => {
                trackSession({ name: 'audit.confirmatrice.upsell.open', ts: Date.now() });
                onOpenWhatsApp();
              }}
            />
          </div>
        </div>

        <div className="space-y-6">
          <ConfirmatriceStats
            confirmationRate={confirmationRate}
            volume={summary?.orders_total ?? 0}
            confirmed={summary?.orders_confirmed ?? 0}
            cancelled={summary?.orders_cancelled ?? 0}
            avgHandleMins={null}
            satisfactionRate={summary?.satisfaction_rate ?? null}
            followUpRate={summary?.follow_up_rate ?? null}
          />

          <div className="card-muted p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Raccourcis</p>
            <p className="mt-2 text-sm font-medium text-zinc-700">
              {isSelf ? (
                <>
                  Utilisez <strong>Mes commandes</strong> et <strong>WhatsApp</strong> pour agir sur les enregistrements réels.
                </>
              ) : (
                <>
                  Utilisez les boutons <strong>Mes leads</strong>, <strong>Mes commandes</strong> et <strong>WhatsApp</strong> pour agir sur les enregistrements réels.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
