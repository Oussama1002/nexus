import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, MessageSquare, Phone, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import { ConfirmatriceStats } from '../components/confirmations/ConfirmatriceStats';
import { ReminderList, type Reminder } from '../components/confirmations/ReminderList';
import { UpsellRequests } from '../components/confirmations/UpsellRequests';
import { FollowUpScheduleManager } from '../components/confirmations/FollowUpScheduleManager';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  level?: Level | null;
};

type Level = { name: string; badge: string; color: string; min_confirmed: number };

type TodayReminder = {
  id: number;
  order_number: string;
  status: string;
  customer_name: string | null;
  phone: string | null;
  city: string | null;
  product: string | null;
  due_date: string | null;
  follow_up_note: string | null;
};

type FollowUp = {
  id: number;
  sequence: number;
  due_at: string | null;
  customer_name: string | null;
  phone: string | null;
  city: string | null;
  order_number: string | null;
};

const FOLLOW_UP_RESULTS = [
  { value: 'satisfait', label: 'Satisfait' },
  { value: 'insatisfait', label: 'Insatisfait' },
  { value: 'pas_de_reponse', label: 'Pas de réponse' },
  { value: 'a_rappeler', label: 'À rappeler' },
  { value: 'autre', label: 'Autre' },
];

const FOLLOW_UP_OPPORTUNITIES = [
  { value: 'aucune', label: 'Aucune' },
  { value: 'autre_produit', label: 'Intéressé par un autre produit' },
  { value: 'offre_envoyee', label: 'Offre envoyée' },
  { value: 'nouvelle_commande', label: 'Nouvelle commande' },
];

type DailyReport = {
  period: string;
  messages_received: number;
  orders_total: number;
  orders_confirmed: number;
  orders_pending: number;
  orders_cancelled: number;
  orders_scheduled: number;
  orders_postponed: number;
  orders_shipped: number;
  orders_delivered: number;
  orders_returned: number;
  double_confirmation_pending: number;
  double_confirmation_done: number;
  upsell_amount: number;
  confirmation_rate: number;
  by_origin: { origin: string; count: number }[];
  calls_made: number;
  calls_answered: number;
  people_called: number;
  reachability_rate: number;
  calls_available: boolean;
};

const CALL_OUTCOMES = [
  { value: 'answered', label: 'Décroché' },
  { value: 'no_answer', label: 'Pas de réponse' },
  { value: 'busy', label: 'Occupé' },
  { value: 'invalid', label: 'Numéro invalide' },
];

const REPORT_PERIODS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'last_month', label: 'Mois précédent' },
  { value: 'custom', label: 'Personnalisée' },
];

type PerfSettings = { threshold_improve: number; threshold_good: number; alert_window_days: number };
const DEFAULT_PERF: PerfSettings = { threshold_improve: 8, threshold_good: 12, alert_window_days: 7 };

/**
 * Statut de performance (spec §6.7/6.8). Seuils configurables par l'admin
 * (défauts GO-CENTER : < 8 % danger, 8–12 % à améliorer, ≥ 12 % objectif).
 */
function performanceStatus(rate: number, s: PerfSettings): { label: string; cls: string } {
  if (rate >= s.threshold_good) return { label: 'Objectif atteint', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (rate >= s.threshold_improve) return { label: 'À améliorer', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { label: 'Danger, formation requise', cls: 'bg-rose-100 text-rose-800 border-rose-300' };
}

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
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canEditPerf = hasPermission('settings.update');
  const [perfSaving, setPerfSaving] = useState(false);
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayReminders, setDayReminders] = useState<TodayReminder[]>([]);
  const [reminderBusy, setReminderBusy] = useState<number | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  // Suivi en cours de saisie (modal).
  const [activeFollowUp, setActiveFollowUp] = useState<FollowUp | null>(null);
  const [fuResult, setFuResult] = useState('satisfait');
  const [fuOpportunity, setFuOpportunity] = useState('aucune');
  const [fuUpsell, setFuUpsell] = useState('');
  const [fuNotes, setFuNotes] = useState('');
  const [fuSaving, setFuSaving] = useState(false);
  const [report, setReport] = useState<DailyReport | null>(null);
  // Journalisation d'un appel (spec §6.7).
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callPhone, setCallPhone] = useState('');
  const [callOrderId, setCallOrderId] = useState<number | null>(null);
  const [callOutcome, setCallOutcome] = useState('answered');
  const [callNotes, setCallNotes] = useState('');
  const [callSaving, setCallSaving] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [perf, setPerf] = useState<PerfSettings>(DEFAULT_PERF);
  const [levelsCfg, setLevelsCfg] = useState<Level[]>([]);
  const [levelsSaving, setLevelsSaving] = useState(false);

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

  const loadDayReminders = useCallback(async () => {
    if (!workspaceUserId || !activeBrandId) {
      setDayReminders([]);
      return;
    }
    const res = await api.get<{ items: TodayReminder[] }>(
      `orders/today-reminders${buildQuery({ user_id: workspaceUserId })}`,
      { brandId: activeBrandId },
    );
    setDayReminders(res.ok && res.data ? res.data.items : []);
  }, [workspaceUserId, activeBrandId]);

  const markReminderHandled = useCallback(async (orderId: number) => {
    setReminderBusy(orderId);
    const res = await api.patch(`orders/${orderId}/reminder-handled`, {}, { brandId: activeBrandId });
    setReminderBusy(null);
    if (res.ok) {
      setDayReminders((prev) => prev.filter((r) => r.id !== orderId));
    }
  }, [activeBrandId]);

  const loadFollowUps = useCallback(async () => {
    if (!workspaceUserId || !activeBrandId) {
      setFollowUps([]);
      return;
    }
    const res = await api.get<{ items: FollowUp[] }>(
      `customer-follow-ups${buildQuery({ user_id: workspaceUserId })}`,
      { brandId: activeBrandId },
    );
    setFollowUps(res.ok && res.data ? res.data.items : []);
  }, [workspaceUserId, activeBrandId]);

  const openFollowUp = useCallback((f: FollowUp) => {
    setActiveFollowUp(f);
    setFuResult('satisfait');
    setFuOpportunity('aucune');
    setFuUpsell('');
    setFuNotes('');
  }, []);

  const submitFollowUp = useCallback(async () => {
    if (!activeFollowUp) return;
    setFuSaving(true);
    const res = await api.patch(`customer-follow-ups/${activeFollowUp.id}`, {
      result: fuResult,
      opportunity: fuOpportunity,
      upsell_amount: fuUpsell.trim() ? Number(fuUpsell) : null,
      notes: fuNotes.trim() || null,
    }, { brandId: activeBrandId });
    setFuSaving(false);
    if (res.ok) {
      toast.success(res.message);
      setFollowUps((prev) => prev.filter((x) => x.id !== activeFollowUp.id));
      setActiveFollowUp(null);
      void loadFollowUps();
    } else {
      toast.error(res.message);
    }
  }, [activeFollowUp, fuResult, fuOpportunity, fuUpsell, fuNotes, activeBrandId, loadFollowUps, toast]);

  const loadReport = useCallback(async () => {
    if (!workspaceUserId || !activeBrandId) {
      setReport(null);
      return;
    }
    // En mode personnalisé, on attend que la date de début soit saisie.
    if (reportPeriod === 'custom' && !customFrom) {
      return;
    }
    const params: Record<string, string> = { user_id: workspaceUserId, period: reportPeriod };
    if (reportPeriod === 'custom') {
      params.from = customFrom;
      if (customTo) params.to = customTo;
    }
    const res = await api.get<DailyReport>(
      `confirmatrice-workspace/daily-report${buildQuery(params)}`,
      { brandId: activeBrandId },
    );
    setReport(res.ok && res.data ? res.data : null);
  }, [workspaceUserId, activeBrandId, reportPeriod, customFrom, customTo]);

  const openCallModal = useCallback((prefill?: { phone?: string | null; orderId?: number | null }) => {
    setCallPhone(prefill?.phone ?? '');
    setCallOrderId(prefill?.orderId ?? null);
    setCallOutcome('answered');
    setCallNotes('');
    setCallModalOpen(true);
  }, []);

  const submitCall = useCallback(async () => {
    setCallSaving(true);
    const res = await api.post('confirmatrice-workspace/calls', {
      outcome: callOutcome,
      phone: callPhone.trim() || null,
      order_id: callOrderId,
      notes: callNotes.trim() || null,
    }, { brandId: activeBrandId });
    setCallSaving(false);
    if (res.ok) {
      toast.success(res.message);
      setCallModalOpen(false);
      void loadReport();
    } else {
      toast.error(res.message);
    }
  }, [callOutcome, callPhone, callOrderId, callNotes, activeBrandId, loadReport, toast]);

  useEffect(() => {
    void (async () => {
      const res = await api.get<PerfSettings & { levels?: Level[] }>('confirmatrice-settings');
      if (res.ok && res.data) {
        setPerf({ threshold_improve: res.data.threshold_improve, threshold_good: res.data.threshold_good, alert_window_days: res.data.alert_window_days });
        if (Array.isArray(res.data.levels)) setLevelsCfg(res.data.levels);
      }
    })();
  }, []);

  useEffect(() => {
    if (noConfirmatriceInDirectory && !isSelf) return;
    void loadSummary();
    void loadDayReminders();
    void loadFollowUps();
    void loadReport();
  }, [loadSummary, loadDayReminders, loadFollowUps, loadReport, noConfirmatriceInDirectory, isSelf]);

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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full sm:w-auto">
            {viewerRole === 'admin' && confirmatriceOptions.length > 0 && (
              <div className="flex flex-col gap-1 min-w-[200px]">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Confirmatrice</label>
                <select
                  value={workspaceUserId}
                  onChange={(e) => onSelectConfirmatrice(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-800 outline-none focus:ring-2 focus:ring-primary-500"
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
                className="h-10 px-4 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Ouvrir WhatsApp
              </button>
              <button
                type="button"
                onClick={() => {
                  trackSession({ name: 'audit.confirmatrice.quick.create_order', ts: Date.now() });
                  onCreateOrder();
                }}
                className="h-10 px-4 bg-primary-600 text-white rounded-xl text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 transition-colors inline-flex items-center gap-2"
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Conversations assignées</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{summary?.conversations_total ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Leads en cours</p>
          <p className="mt-2 text-2xl font-black text-zinc-900">{summary?.leads_open ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Commandes confirmées</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">{summary?.orders_confirmed ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Commandes annulées</p>
          <p className="mt-2 text-2xl font-black text-rose-600">{summary?.orders_cancelled ?? '—'}</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Relances dues</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{summary?.reminders_due ?? '—'}</p>
        </div>
        {/* Carte « Upsells ouverts » masquée : indicateur non branché (spec §A.5).
            À réafficher une fois branché sur les demandes d'upsell réelles (Partie B §6.6). */}
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
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Leads nouveaux (statut)</p>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Commandes en attente</p>
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

          <div className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-zinc-900">À faire aujourd’hui</p>
                <p className="mt-1 text-xs font-medium text-zinc-500">Commandes programmées / reportées arrivant à échéance.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black">{dayReminders.length}</span>
            </div>
            {dayReminders.length === 0 ? (
              <p className="mt-4 text-sm font-medium text-zinc-500">Aucun rappel pour aujourd’hui.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {dayReminders.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 truncate">
                        {r.customer_name ?? '—'}
                        <span className="ml-2 text-[11px] font-black uppercase text-zinc-400">{r.order_number}</span>
                      </p>
                      <p className="text-[11px] font-medium text-zinc-500 truncate">
                        {[r.phone, r.city, r.product].filter(Boolean).join(' • ') || '—'}
                        {r.due_date && <span className="ml-2 text-amber-700 font-bold">échéance {new Date(r.due_date).toLocaleDateString('fr-FR')}</span>}
                      </p>
                      {r.follow_up_note && <p className="text-[11px] font-semibold text-amber-700 italic truncate">📝 {r.follow_up_note}</p>}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {isSelf && (
                        <button
                          type="button"
                          title="Journaliser un appel"
                          onClick={() => openCallModal({ phone: r.phone, orderId: r.id })}
                          className="p-2 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={reminderBusy === r.id}
                        onClick={() => void markReminderHandled(r.id)}
                        className="px-3 py-2 rounded-lg bg-primary-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-primary-700 disabled:opacity-50"
                      >
                        {reminderBusy === r.id ? '…' : 'Marquer traité'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-zinc-900">Fidélisation — suivis à faire</p>
                <p className="mt-1 text-xs font-medium text-zinc-500">Rappels post-livraison arrivant à échéance.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">{followUps.length}</span>
            </div>
            {followUps.length === 0 ? (
              <p className="mt-4 text-sm font-medium text-zinc-500">Aucun suivi de fidélisation à faire aujourd’hui.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {followUps.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 truncate">
                        {f.customer_name ?? '—'}
                        <span className="ml-2 text-[11px] font-black uppercase text-emerald-700">Suivi #{f.sequence}</span>
                      </p>
                      <p className="text-[11px] font-medium text-zinc-500 truncate">
                        {[f.phone, f.city, f.order_number].filter(Boolean).join(' • ') || '—'}
                        {f.due_at && <span className="ml-2 text-emerald-700 font-bold">échéance {new Date(f.due_at).toLocaleDateString('fr-FR')}</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openFollowUp(f)}
                      className="shrink-0 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700"
                    >
                      Enregistrer
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">Raccourcis</p>
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

      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-black text-zinc-900">Rapport quotidien</p>
              {summary?.level && (
                <span
                  className="px-2.5 py-1 rounded-full border text-[11px] font-black"
                  style={{ color: summary.level.color, borderColor: summary.level.color + '55', backgroundColor: summary.level.color + '14' }}
                >
                  {summary.level.badge} {summary.level.name}
                </span>
              )}
              {report && (
                <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${performanceStatus(report.confirmation_rate, perf).cls}`}>
                  {performanceStatus(report.confirmation_rate, perf).label}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-medium text-zinc-500">Calculé automatiquement sur les commandes de l’agente.</p>
            {isSelf && (
              <button
                type="button"
                onClick={() => openCallModal()}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50"
              >
                <Phone className="w-4 h-4" /> Journaliser un appel
              </button>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-1.5 justify-end">
              {REPORT_PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setReportPeriod(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black border transition-colors ${
                    reportPeriod === p.value ? 'bg-primary-600 text-white border-primary-700' : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {reportPeriod === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold" />
                <span className="text-xs text-zinc-400">→</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-bold" />
              </div>
            )}
          </div>
        </div>

        {!report ? (
          <p className="mt-4 text-sm font-medium text-zinc-500">Aucune donnée pour cette période.</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {[
                { l: 'Messages reçus', v: report.messages_received },
                { l: 'Confirmées', v: report.orders_confirmed },
                { l: 'En attente', v: report.orders_pending },
                { l: 'Refus / annulées', v: report.orders_cancelled },
                { l: 'Programmées', v: report.orders_scheduled },
                { l: 'Reportées', v: report.orders_postponed },
                { l: 'Expédiées', v: report.orders_shipped },
                { l: 'Livrées', v: report.orders_delivered },
                { l: 'Retours', v: report.orders_returned },
                { l: '2ᵉ conf. à faire', v: report.double_confirmation_pending },
                { l: '2ᵉ conf. faite', v: report.double_confirmation_done },
                { l: 'Taux de confirmation', v: `${report.confirmation_rate}%` },
                { l: 'Appels effectués', v: report.calls_made },
                { l: 'Personnes appelées', v: report.people_called },
                { l: 'Appels décrochés', v: report.calls_answered },
                { l: 'Taux de joignabilité', v: `${report.reachability_rate}%` },
              ].map((k) => (
                <div key={k.l} className="card-muted p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{k.l}</p>
                  <p className="mt-1 text-xl font-black text-zinc-900">{k.v}</p>
                </div>
              ))}
            </div>

            {report.by_origin.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Répartition par origine</p>
                <div className="flex flex-wrap gap-2">
                  {report.by_origin.map((o) => (
                    <span key={o.origin} className="px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-sm font-bold text-zinc-700">
                      {o.origin} <span className="text-primary-700">· {o.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isSelf && (
              <p className="mt-4 text-[11px] font-medium text-zinc-400">
                Les indicateurs d’appels proviennent de vos appels journalisés. Utilisez « Journaliser un appel » après chaque appel.
              </p>
            )}
          </>
        )}
      </div>

      {canEditPerf && (
        <div className="card p-6">
          <p className="text-sm font-black text-zinc-900">Réglages performance (admin)</p>
          <p className="mt-1 text-xs font-medium text-zinc-500">Seuils du statut et fenêtre de l’alerte de baisse (défauts GO-CENTER).</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-700">Seuil « À améliorer » (%)
              <input type="number" min={0} max={100} value={perf.threshold_improve}
                onChange={(e) => setPerf((p) => ({ ...p, threshold_improve: Number(e.target.value) }))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-700">Seuil « Objectif atteint » (%)
              <input type="number" min={0} max={100} value={perf.threshold_good}
                onChange={(e) => setPerf((p) => ({ ...p, threshold_good: Number(e.target.value) }))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-700">Fenêtre alerte (jours)
              <input type="number" min={1} max={90} value={perf.alert_window_days}
                onChange={(e) => setPerf((p) => ({ ...p, alert_window_days: Number(e.target.value) }))}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
            </label>
          </div>
          <button
            type="button"
            disabled={perfSaving}
            onClick={async () => {
              setPerfSaving(true);
              const res = await api.put<PerfSettings>('confirmatrice-settings', {
                threshold_improve: perf.threshold_improve,
                threshold_good: perf.threshold_good,
                alert_window_days: perf.alert_window_days,
              });
              setPerfSaving(false);
              if (res.ok && res.data) { setPerf(res.data); toast.success('Réglages enregistrés.'); }
              else toast.error(res.message);
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black hover:bg-primary-700 disabled:opacity-50"
          >
            {perfSaving ? 'Enregistrement…' : 'Enregistrer les réglages'}
          </button>
        </div>
      )}

      {canEditPerf && (
        <div className="card p-6 space-y-4">
          <div>
            <p className="text-sm font-black text-zinc-900">Niveaux & badges (admin)</p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Progression par nombre de commandes confirmées. Le badge du plus haut niveau atteint s’affiche dans l’espace de l’agente.</p>
          </div>
          <div className="space-y-2">
            {levelsCfg.map((lv, i) => (
              <div key={i} className="grid grid-cols-[2.5rem_1fr_6rem_5rem_2.5rem] gap-2 items-center">
                <input value={lv.badge} onChange={(e) => setLevelsCfg((p) => p.map((x, j) => j === i ? { ...x, badge: e.target.value } : x))} maxLength={4} placeholder="🥉" className="px-2 py-2 rounded-lg border border-zinc-200 text-center" />
                <input value={lv.name} onChange={(e) => setLevelsCfg((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Nom du niveau" className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-bold" />
                <input type="number" min={0} value={lv.min_confirmed} onChange={(e) => setLevelsCfg((p) => p.map((x, j) => j === i ? { ...x, min_confirmed: Number(e.target.value) } : x))} className="px-2 py-2 rounded-lg border border-zinc-200 text-sm" title="Commandes confirmées minimum" />
                <input type="color" value={lv.color} onChange={(e) => setLevelsCfg((p) => p.map((x, j) => j === i ? { ...x, color: e.target.value } : x))} className="h-9 w-full rounded-lg border border-zinc-200" />
                <button type="button" onClick={() => setLevelsCfg((p) => p.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <p className="text-[10px] font-bold text-zinc-400">Badge · Nom · Confirmées min · Couleur</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setLevelsCfg((p) => [...p, { name: 'Nouveau niveau', badge: '⭐', color: '#64748b', min_confirmed: 0 }])} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Ajouter un niveau
            </button>
            <button
              type="button"
              disabled={levelsSaving || levelsCfg.length === 0}
              onClick={async () => {
                setLevelsSaving(true);
                const res = await api.put<PerfSettings & { levels?: Level[] }>('confirmatrice-settings/levels', { levels: levelsCfg });
                setLevelsSaving(false);
                if (res.ok && res.data?.levels) { setLevelsCfg(res.data.levels); toast.success('Niveaux enregistrés.'); void loadSummary(); }
                else toast.error(res.message);
              }}
              className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black hover:bg-primary-700 disabled:opacity-50"
            >
              {levelsSaving ? 'Enregistrement…' : 'Enregistrer les niveaux'}
            </button>
          </div>
        </div>
      )}

      {canEditPerf && <FollowUpScheduleManager />}

      <Modal
        open={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        title="Journaliser un appel"
        subtitle="Enregistre l’appel et son résultat pour le rapport quotidien."
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setCallModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
              Annuler
            </button>
            <button
              type="button"
              disabled={callSaving || (!callPhone.trim())}
              onClick={() => void submitCall()}
              className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black hover:bg-primary-700 disabled:opacity-50"
            >
              {callSaving ? 'Enregistrement…' : 'Journaliser'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase text-zinc-700">Numéro appelé
            <input type="tel" value={callPhone} onChange={(e) => setCallPhone(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" placeholder="06 12 34 56 78" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-700">Résultat
            <select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold">
              {CALL_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-black uppercase text-zinc-700">Notes
            <textarea value={callNotes} onChange={(e) => setCallNotes(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm resize-none" placeholder="Compte-rendu de l’appel…" />
          </label>
        </div>
      </Modal>

      <Modal
        open={activeFollowUp !== null}
        onClose={() => setActiveFollowUp(null)}
        title="Enregistrer le suivi"
        subtitle={activeFollowUp ? `${activeFollowUp.customer_name ?? ''} — suivi #${activeFollowUp.sequence}` : ''}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setActiveFollowUp(null)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50">
              Fermer
            </button>
            <button
              type="button"
              disabled={fuSaving}
              onClick={() => void submitFollowUp()}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 disabled:opacity-50"
            >
              {fuSaving ? 'Enregistrement…' : 'Enregistrer & programmer le suivant'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-700">Résultat
              <select value={fuResult} onChange={(e) => setFuResult(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold">
                {FOLLOW_UP_RESULTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block text-xs font-black uppercase text-zinc-700">Opportunité
              <select value={fuOpportunity} onChange={(e) => setFuOpportunity(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-bold">
                {FOLLOW_UP_OPPORTUNITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-xs font-black uppercase text-zinc-700">Vente additionnelle (MAD)
            <input type="number" min={0} value={fuUpsell} onChange={(e) => setFuUpsell(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" placeholder="0.00" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-700">Notes
            <textarea value={fuNotes} onChange={(e) => setFuNotes(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm resize-none" placeholder="Compte-rendu du suivi…" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
