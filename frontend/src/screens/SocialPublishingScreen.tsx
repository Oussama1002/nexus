import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { pathForView } from '../lib/appPaths';
import {
  ClipboardCheck, FileText, Users, Shield, AlertTriangle,
  Plus, Search, ChevronLeft, ChevronRight, Loader2, Check, X,
  Archive, Flag, Eye, BookOpen, Send, CheckCircle, XCircle,
  Calendar, Clock, ExternalLink, MessageSquare, ArrowLeft,
  Link as LinkIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CmTab = 'journee' | 'publications' | 'influenceurs' | 'moderation' | 'reclamations';

type DailySummary = {
  checklist_completion_percent: number;
  moderation_actions_today: number;
  pending_signals: number;
  publications_today: number;
};

type ChecklistItem = {
  id: number;
  label: string;
  category: string;
  is_completed: boolean;
};

type Checklist = {
  id: number;
  work_date: string;
  status: string;
  rejection_reason: string | null;
  validated_by: number | null;
  notes: string | null;
  cm_user?: { id: number; name: string };
  items: ChecklistItem[];
};

type Signal = {
  id: number;
  influencer?: { id: number; full_name: string };
  influencer_id: number;
  signal_type: string;
  severity: string;
  description: string;
  status: string;
  created_at: string;
};

type ContentCalendarEntry = {
  id: number;
  title: string;
  platform: string;
  content_type: string;
  planned_at: string;
  published_at: string | null;
  published_url: string | null;
  not_published_reason: string | null;
  status: string;
  caption: string | null;
  description: string | null;
  attachments_json: string[] | null;
  social_account?: { id: number; platform: string; account_name: string } | null;
  assignee?: { id: number; name: string } | null;
  validated_by_user?: { id: number; name: string } | null;
};

type InfluencerContentLog = {
  id: number;
  influencer?: { id: number; full_name: string };
  influencer_id: number;
  content_type: string;
  platform: string;
  content_url: string;
  published_at: string;
  notes: string;
  is_archived: boolean;
};

type ModerationAction = {
  id: number;
  platform: string;
  action_type: string;
  description: string;
  social_account?: { id: number; platform: string; account_name: string };
  social_account_id: number;
  screenshot_url: string;
  created_at: string;
};

type CallCenterComplaint = {
  id: number;
  reference: string;
  customer_name: string;
  customer_phone: string | null;
  brand?: { id: number; name: string };
  priority: string;
  status: string;
  category: string;
  channel: string;
  description: string;
  source_user?: { id: number; name: string } | null;
  assigned_user?: { id: number; name: string } | null;
  resolution_notes: string | null;
  created_at: string;
  thread_entries?: ThreadEntry[];
};

type ThreadEntry = {
  id: number;
  author_user_id: number;
  author?: { id: number; name: string };
  entry_type: string;
  content: string;
  created_at: string;
};

type Influencer = { id: number; full_name: string };
type SocialAccount = { id: number; platform: string; account_name: string };

type ComplaintForm = {
  customer_name: string;
  customer_phone: string;
  customer_handle: string;
  channel: string;
  category: string;
  priority: string;
  description: string;
};

const emptyComplaintForm: ComplaintForm = {
  customer_name: '', customer_phone: '', customer_handle: '',
  channel: '', category: '', priority: '', description: '',
};

const checklistStatusColor: Record<string, string> = {
  en_cours: 'bg-blue-50 text-blue-700',
  soumis: 'bg-yellow-50 text-yellow-700',
  'validé': 'bg-emerald-50 text-emerald-700',
  valide: 'bg-emerald-50 text-emerald-700',
  'rejeté': 'bg-red-50 text-red-700',
  rejete: 'bg-red-50 text-red-700',
};

const checklistStatusLabel: Record<string, string> = {
  en_cours: 'En cours',
  soumis: 'Soumis',
  'validé': 'Validé',
  valide: 'Validé',
  'rejeté': 'Rejeté',
  rejete: 'Rejeté',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const today = () => new Date().toISOString().slice(0, 10);

const tabs: { key: CmTab; label: string; icon: typeof ClipboardCheck }[] = [
  { key: 'journee', label: 'Ma journée', icon: ClipboardCheck },
  { key: 'publications', label: 'Publications', icon: FileText },
  { key: 'influenceurs', label: 'Suivi influenceurs', icon: Users },
  { key: 'moderation', label: 'Modération', icon: Shield },
  { key: 'reclamations', label: 'Mes réclamations', icon: AlertTriangle },
];

const pubStatusColor: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  brouillon: 'bg-zinc-100 text-zinc-600',
  planned: 'bg-blue-50 text-blue-700',
  in_production: 'bg-yellow-50 text-yellow-700',
  review: 'bg-orange-50 text-orange-700',
  approved: 'bg-emerald-50 text-emerald-700',
  published: 'bg-primary-50 text-primary-700',
  cancelled: 'bg-red-50 text-red-700',
};

const pubStatusLabel: Record<string, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  in_production: 'En production',
  review: 'En revue',
  approved: 'Approuvé',
  published: 'Publié',
  cancelled: 'Annulé',
};

const platformColor: Record<string, string> = {
  facebook: 'bg-blue-50 text-blue-700',
  instagram: 'bg-pink-50 text-pink-700',
  tiktok: 'bg-zinc-900 text-white',
  twitter: 'bg-sky-50 text-sky-700',
  linkedin: 'bg-indigo-50 text-indigo-700',
  youtube: 'bg-red-50 text-red-700',
};

const actionTypeColor: Record<string, string> = {
  'commentaire_supprimé': 'bg-red-100 text-red-700',
  'commentaire_masqué': 'bg-yellow-50 text-yellow-700',
  'message_envoyé': 'bg-blue-50 text-blue-700',
  'avis_signalé': 'bg-orange-50 text-orange-700',
  ban_utilisateur: 'bg-red-200 text-red-900',
  autre: 'bg-zinc-100 text-zinc-600',
};

const severityColor: Record<string, string> = {
  faible: 'bg-zinc-100 text-zinc-600',
  moyen: 'bg-yellow-50 text-yellow-700',
  'elevé': 'bg-orange-50 text-orange-700',
  'élevé': 'bg-orange-50 text-orange-700',
  critique: 'bg-red-100 text-red-700',
};

const signalStatusColor: Record<string, string> = {
  ouvert: 'bg-orange-50 text-orange-700',
  en_traitement: 'bg-blue-50 text-blue-700',
  'résolu': 'bg-emerald-50 text-emerald-700',
  resolu: 'bg-emerald-50 text-emerald-700',
  'escaladé': 'bg-red-100 text-red-700',
  escalade: 'bg-red-100 text-red-700',
};

const priorityColor: Record<string, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-50 text-orange-700',
  P3: 'bg-zinc-100 text-zinc-600',
};

const complaintStatusColor: Record<string, string> = {
  nouvelle: 'bg-blue-50 text-blue-700',
  'assignée': 'bg-yellow-50 text-yellow-700',
  assignee: 'bg-yellow-50 text-yellow-700',
  en_traitement: 'bg-orange-50 text-orange-700',
  'résolue': 'bg-emerald-50 text-emerald-700',
  resolue: 'bg-emerald-50 text-emerald-700',
  'clôturée': 'bg-zinc-100 text-zinc-600',
  cloturee: 'bg-zinc-100 text-zinc-600',
};

const complaintStatusLabel: Record<string, string> = {
  nouvelle: 'Nouvelle',
  'assignée': 'Assignée',
  en_traitement: 'En traitement',
  'résolue': 'Résolue',
  'clôturée': 'Clôturée',
};

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const key = value.toLowerCase().replace(/ /g, '_');
  const cls = colorMap[key] || colorMap[value] || 'bg-zinc-100 text-zinc-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="animate-spin text-zinc-400" size={24} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function SocialPublishingScreen() {
  const toastCtx = useToast();
  const toast = (msg: string, type: string) => type === 'success' ? toastCtx.success(msg) : toastCtx.error(msg);
  const { user, hasPermission, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CmTab>('journee');
  const [showComplaint, setShowComplaint] = useState(false);
  const [complaintForm, setComplaintForm] = useState<ComplaintForm>({ ...emptyComplaintForm });
  const [complaintSaving, setComplaintSaving] = useState(false);
  const [complaintRefresh, setComplaintRefresh] = useState(0);
  const canValidate = isAdmin || hasPermission('cm_tracking.update');

  const openComplaintModal = () => {
    setShowComplaint(true);
  };

  const submitComplaint = async () => {
    if (!complaintForm.customer_name || !complaintForm.channel || !complaintForm.category || !complaintForm.priority || !complaintForm.description) {
      toast('Veuillez remplir tous les champs obligatoires', 'error'); return;
    }
    setComplaintSaving(true);
    try {
      const res = await api.post('complaints', complaintForm);
      if (res.ok) {
        toast('Réclamation créée avec succès', 'success');
        setShowComplaint(false);
        setComplaintForm({ ...emptyComplaintForm });
        setComplaintRefresh(n => n + 1);
      } else {
        toast('Erreur lors de la création', 'error');
      }
    } catch {
      toast('Erreur lors de la création', 'error');
    } finally {
      setComplaintSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Community Manager" subtitle="Espace de travail CM"
        right={
          <button
            onClick={() => navigate(pathForView('academy'))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <BookOpen size={16} /> Ressources CM
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-200 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {activeTab === 'journee' && <TabJournee toast={toast} userId={user?.id} onNewComplaint={openComplaintModal} canValidate={canValidate} />}
      {activeTab === 'publications' && <TabPublications toast={toast} userId={user?.id} />}
      {activeTab === 'influenceurs' && <TabInfluenceurs toast={toast} onNewComplaint={openComplaintModal} />}
      {activeTab === 'moderation' && <TabModeration toast={toast} onNewComplaint={openComplaintModal} />}
      {activeTab === 'reclamations' && <TabReclamations toast={toast} userId={user?.id} onNewComplaint={openComplaintModal} refreshToken={complaintRefresh} />}

      {/* Complaint creation modal (E6 — Call Center Complaint) */}
      <Modal open={showComplaint} onClose={() => setShowComplaint(false)} title="Créer une réclamation"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowComplaint(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button>
            <button onClick={submitComplaint} disabled={complaintSaving} className="btn btn-primary flex items-center gap-2 text-sm">
              {complaintSaving && <Loader2 size={14} className="animate-spin" />} Créer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Nom du client *</label>
              <input className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="Nom complet" value={complaintForm.customer_name} onChange={e => setComplaintForm(f => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Téléphone</label>
              <input className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="+212..." value={complaintForm.customer_phone} onChange={e => setComplaintForm(f => ({ ...f, customer_phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Identifiant plateforme</label>
            <input className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="@handle ou lien profil" value={complaintForm.customer_handle} onChange={e => setComplaintForm(f => ({ ...f, customer_handle: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Canal *</label>
              <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={complaintForm.channel} onChange={e => setComplaintForm(f => ({ ...f, channel: e.target.value }))}>
                <option value="">Sélectionner...</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telephone">Téléphone</option>
                <option value="email">Email</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Catégorie *</label>
              <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={complaintForm.category} onChange={e => setComplaintForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Sélectionner...</option>
                <option value="produit">Produit</option>
                <option value="service">Service</option>
                <option value="livraison">Livraison</option>
                <option value="facturation">Facturation</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Priorité *</label>
            <div className="flex gap-3">
              {(['P1', 'P2', 'P3'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setComplaintForm(f => ({ ...f, priority: p }))}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
                    complaintForm.priority === p
                      ? p === 'P1' ? 'border-red-500 bg-red-50 text-red-700'
                        : p === 'P2' ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-zinc-400 bg-zinc-50 text-zinc-700'
                      : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Description *</label>
            <textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={complaintForm.description} onChange={e => setComplaintForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  Tab 1 : Ma journée                                                  */
/* ================================================================== */

function TabJournee({ toast, userId, onNewComplaint, canValidate }: { toast: (m: string, t: string) => void; userId?: number; onNewComplaint: () => void; canValidate: boolean }) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newItems, setNewItems] = useState<{ label: string; category: string }[]>([{ label: '', category: 'publication' }]);
  const [saving, setSaving] = useState(false);
  const [showReject, setShowReject] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // E2 — Historique
  const [showHistory, setShowHistory] = useState(false);
  const [historyChecklists, setHistoryChecklists] = useState<Checklist[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLastPage, setHistoryLastPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyDetail, setHistoryDetail] = useState<Checklist | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, clRes, sigRes] = await Promise.all([
        api.get<DailySummary>('cm/daily-summary'),
        api.get<Paginated<Checklist>>('cm/checklists' + buildQuery({ date_from: today(), date_to: today() })),
        api.get<Paginated<Signal>>('cm/signals' + buildQuery({ status: 'ouvert', per_page: 5 })),
      ]);
      if (sumRes.ok) setSummary(sumRes.data);
      if (clRes.ok) setChecklists(clRes.data.data);
      if (sigRes.ok) setSignals(sigRes.data.data);
    } catch {
      toast('Erreur lors du chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get<Paginated<Checklist>>(
        'cm/checklists' + buildQuery({ per_page: 15, page: historyPage, date_from: historyDateFrom || undefined, date_to: historyDateTo || undefined }),
      );
      if (res.ok) {
        setHistoryChecklists(res.data.data);
        setHistoryTotal(res.data.total);
        setHistoryLastPage(res.data.last_page);
      }
    } catch {
      toast('Erreur lors du chargement de l\'historique', 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyDateFrom, historyDateTo, toast]);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  const toggleItem = async (checklistId: number, itemId: number) => {
    try {
      const res = await api.patch(`cm/checklists/${checklistId}/items/${itemId}/toggle`);
      if (!res.ok) { toast('Erreur lors de la mise à jour', 'error'); return; }
      setChecklists(prev =>
        prev.map(cl =>
          cl.id === checklistId
            ? { ...cl, items: cl.items.map(it => (it.id === itemId ? { ...it, is_completed: !it.is_completed } : it)) }
            : cl,
        ),
      );
    } catch {
      toast('Erreur lors de la mise à jour', 'error');
    }
  };

  const createChecklist = async () => {
    const valid = newItems.filter(i => i.label.trim());
    if (!valid.length) { toast('Ajoutez au moins un élément', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('cm/checklists', { work_date: today(), items: valid });
      if (res.ok) {
        toast('Checklist créée', 'success');
        setShowCreate(false);
        setNewItems([{ label: '', category: 'publication' }]);
        load();
      } else {
        toast('Erreur lors de la création', 'error');
      }
    } catch {
      toast('Erreur lors de la création', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateChecklistStatus = async (checklistId: number, status: string, rejectionReason?: string) => {
    try {
      const body: Record<string, string> = { status };
      if (rejectionReason) body.rejection_reason = rejectionReason;
      const res = await api.put(`cm/checklists/${checklistId}`, body);
      if (res.ok) {
        toast(status === 'soumis' ? 'Checklist soumise' : status === 'validé' ? 'Checklist validée' : 'Checklist rejetée', 'success');
        setShowReject(null);
        setRejectReason('');
        load();
      } else {
        toast('Erreur lors de la mise à jour', 'error');
      }
    } catch {
      toast('Erreur lors de la mise à jour', 'error');
    }
  };

  if (loading) return <Spinner />;

  // ── E2: History detail view ──
  if (historyDetail) {
    return (
      <div className="space-y-4">
        <button onClick={() => setHistoryDetail(null)} className="flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
          <ArrowLeft size={16} /> Retour à l'historique
        </button>
        <div className="card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-zinc-900">
              Journée du {new Date(historyDetail.work_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </h3>
            <Badge value={checklistStatusLabel[historyDetail.status] || historyDetail.status} colorMap={checklistStatusColor} />
          </div>
          {historyDetail.rejection_reason && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              <span className="font-semibold">Motif du rejet :</span> {historyDetail.rejection_reason}
            </div>
          )}
          {historyDetail.items.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4 text-center">Aucune tâche pour cette journée.</p>
          ) : (
            historyDetail.items.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-zinc-50">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                  item.is_completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-zinc-300'
                }`}>
                  {item.is_completed && <Check size={12} />}
                </div>
                <span className={`text-sm ${item.is_completed ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
                  {item.label}
                </span>
                <Badge value={item.category} colorMap={{ publication: 'bg-blue-50 text-blue-700', 'modération': 'bg-yellow-50 text-yellow-700', moderation: 'bg-yellow-50 text-yellow-700', veille: 'bg-purple-50 text-purple-700', reporting: 'bg-emerald-50 text-emerald-700' }} />
              </div>
            ))
          )}
          {historyDetail.notes && (
            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm text-zinc-600">
              <span className="font-semibold">Notes :</span> {historyDetail.notes}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── E2: History list view ──
  if (showHistory) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowHistory(false)} className="flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
            <ArrowLeft size={16} /> Retour à Ma journée
          </button>
          <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2"><Calendar size={16} /> Historique des journées</h3>
        </div>

        <div className="flex flex-wrap gap-3">
          <input type="date" className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={historyDateFrom} onChange={e => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }} title="Du" />
          <input type="date" className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={historyDateTo} onChange={e => { setHistoryDateTo(e.target.value); setHistoryPage(1); }} title="Au" />
        </div>

        {historyLoading ? <Spinner /> : historyChecklists.length === 0 ? (
          <EmptyState title="Aucune journée" description="Aucune checklist trouvée pour cette période." />
        ) : (
          <>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Tâches</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Complétées</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Taux</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyChecklists.map(cl => {
                    const total = cl.items.length;
                    const done = cl.items.filter(i => i.is_completed).length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    return (
                      <tr key={cl.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-zinc-700">{new Date(cl.work_date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{total}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600">{done}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 rounded-full bg-zinc-100 overflow-hidden">
                              <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-zinc-500">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm"><Badge value={checklistStatusLabel[cl.status] || cl.status} colorMap={checklistStatusColor} /></td>
                        <td className="px-4 py-3 text-sm">
                          <button onClick={() => setHistoryDetail(cl)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600" title="Voir le détail">
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{historyTotal} résultat{historyTotal > 1 ? 's' : ''}</p>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}><ChevronLeft size={16} /></button>
                <span className="text-sm font-medium">{historyPage} / {historyLastPage}</span>
                <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={historyPage >= historyLastPage} onClick={() => setHistoryPage(p => p + 1)}><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── E1: Main Ma journée view ──
  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Checklist complétée</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{summary?.checklist_completion_percent ?? 0}%</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Modérations</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{summary?.moderation_actions_today ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Signalements en attente</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{summary?.pending_signals ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Publications aujourd'hui</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{summary?.publications_today ?? 0}</p>
        </div>
      </div>

      {/* Checklist */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-900">Checklist du jour</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
              <Calendar size={14} /> Historique
            </button>
            <button onClick={() => setShowCreate(true)} className="btn btn-primary flex items-center gap-2 text-sm">
              <Plus size={16} /> Créer ma checklist
            </button>
          </div>
        </div>
        {checklists.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">Aucune checklist pour aujourd'hui.</p>
        ) : (
          checklists.map(cl => (
            <div key={cl.id} className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-500">Statut :</span>
                  <Badge value={checklistStatusLabel[cl.status] || cl.status} colorMap={checklistStatusColor} />
                </div>
                <div className="flex items-center gap-2">
                  {cl.status === 'en_cours' && (
                    <button onClick={() => updateChecklistStatus(cl.id, 'soumis')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">
                      <Send size={12} /> Soumettre
                    </button>
                  )}
                  {cl.status === 'soumis' && canValidate && (
                    <>
                      <button onClick={() => updateChecklistStatus(cl.id, 'validé')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
                        <CheckCircle size={12} /> Valider
                      </button>
                      <button onClick={() => setShowReject(cl.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                        <XCircle size={12} /> Rejeter
                      </button>
                    </>
                  )}
                  {cl.status === 'rejeté' && (
                    <button onClick={() => updateChecklistStatus(cl.id, 'en_cours')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs font-semibold hover:bg-zinc-100">
                      Reprendre
                    </button>
                  )}
                </div>
              </div>

              {cl.status === 'rejeté' && cl.rejection_reason && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
                  <span className="font-semibold">Motif du rejet :</span> {cl.rejection_reason}
                </div>
              )}

              {cl.items.map(item => (
                <label key={item.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 cursor-pointer">
                  <button
                    onClick={() => toggleItem(cl.id, item.id)}
                    disabled={cl.status === 'validé'}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      item.is_completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-zinc-300'
                    } ${cl.status === 'validé' ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {item.is_completed && <Check size={12} />}
                  </button>
                  <span className={`text-sm ${item.is_completed ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
                    {item.label}
                  </span>
                  <Badge value={item.category} colorMap={{ publication: 'bg-blue-50 text-blue-700', 'modération': 'bg-yellow-50 text-yellow-700', moderation: 'bg-yellow-50 text-yellow-700', veille: 'bg-purple-50 text-purple-700', reporting: 'bg-emerald-50 text-emerald-700' }} />
                </label>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Reject reason modal */}
      <Modal open={showReject !== null} onClose={() => { setShowReject(null); setRejectReason(''); }} title="Motif du rejet"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowReject(null); setRejectReason(''); }} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button>
            <button
              onClick={() => { if (showReject) updateChecklistStatus(showReject, 'rejeté', rejectReason); }}
              disabled={!rejectReason.trim()}
              className="btn btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
            >
              Confirmer le rejet
            </button>
          </div>
        }
      >
        <div>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Raison du rejet *</label>
          <textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Expliquez pourquoi la checklist est rejetée..." />
        </div>
      </Modal>

      {/* Alertes + Réclamation */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-500" /> Alertes
          </h3>
          <button onClick={onNewComplaint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-600 hover:bg-zinc-50">
            <Plus size={12} /> Nouvelle réclamation
          </button>
        </div>
        {signals.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Aucun signalement en attente.</p>
        ) : (
          <div className="space-y-2">
            {signals.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-100">
                <div>
                  <p className="text-sm font-medium text-zinc-700">{s.description}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{s.influencer?.full_name ?? `#${s.influencer_id}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={s.severity} colorMap={severityColor} />
                  <Badge value={s.signal_type} colorMap={{ retard: 'bg-orange-50 text-orange-700', contenu_non_conforme: 'bg-yellow-50 text-yellow-700', injoignable: 'bg-red-50 text-red-700', comportement: 'bg-purple-50 text-purple-700', autre: 'bg-zinc-100 text-zinc-600' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create checklist modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Créer ma checklist"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button>
            <button onClick={createChecklist} disabled={saving} className="btn btn-primary flex items-center gap-2 text-sm">
              {saving && <Loader2 size={14} className="animate-spin" />} Créer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {newItems.map((item, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="Libellé de la tâche" value={item.label}
                onChange={e => setNewItems(prev => prev.map((it, j) => (j === i ? { ...it, label: e.target.value } : it)))} />
              <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={item.category}
                onChange={e => setNewItems(prev => prev.map((it, j) => (j === i ? { ...it, category: e.target.value } : it)))}>
                <option value="publication">Publication</option>
                <option value="modération">Modération</option>
                <option value="veille">Veille</option>
                <option value="reporting">Reporting</option>
              </select>
              {newItems.length > 1 && (
                <button onClick={() => setNewItems(prev => prev.filter((_, j) => j !== i))} className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-400"><X size={16} /></button>
              )}
            </div>
          ))}
          <button onClick={() => setNewItems(prev => [...prev, { label: '', category: 'publication' }])}
            className="text-sm font-semibold text-primary-600 hover:underline flex items-center gap-1">
            <Plus size={14} /> Ajouter un élément
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  Tab 2 : Publications (E3)                                          */
/* ================================================================== */

function TabPublications({ toast, userId }: { toast: (m: string, t: string) => void; userId?: number }) {
  const [rows, setRows] = useState<ContentCalendarEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [status, setStatus] = useState('');

  // Detail panel
  const [detail, setDetail] = useState<ContentCalendarEntry | null>(null);
  const [showMarkPublished, setShowMarkPublished] = useState(false);
  const [showMarkNotPublished, setShowMarkNotPublished] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [notPublishedReason, setNotPublishedReason] = useState('');
  const [markSaving, setMarkSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<ContentCalendarEntry>>(
        'content-calendar' + buildQuery({ assigned_user_id: userId, per_page: 25, page, platform: platform || undefined, status: status || undefined, search: search || undefined }),
      );
      if (res.ok) {
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
      } else {
        setRows([]);
      }
    } catch {
      toast('Erreur lors du chargement des publications', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, platform, status, search, userId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetail = async (id: number) => {
    try {
      const res = await api.get<ContentCalendarEntry>(`content-calendar/${id}`);
      if (res.ok) setDetail(res.data);
    } catch {
      toast('Erreur lors du chargement du détail', 'error');
    }
  };

  const markPublished = async () => {
    if (!publishedUrl.trim()) { toast('Le lien de publication est obligatoire', 'error'); return; }
    if (!detail) return;
    setMarkSaving(true);
    try {
      const res = await api.post(`content-calendar/${detail.id}/mark-published`, { published_url: publishedUrl });
      if (res.ok) {
        toast('Contenu marqué comme publié', 'success');
        setShowMarkPublished(false);
        setPublishedUrl('');
        setDetail(null);
        loadData();
      } else {
        toast('Erreur : le contenu doit être approuvé avant publication', 'error');
      }
    } catch {
      toast('Erreur lors du marquage', 'error');
    } finally {
      setMarkSaving(false);
    }
  };

  const markNotPublished = async () => {
    if (!notPublishedReason.trim()) { toast('Le motif est obligatoire', 'error'); return; }
    if (!detail) return;
    setMarkSaving(true);
    try {
      const res = await api.post(`content-calendar/${detail.id}/mark-not-published`, { not_published_reason: notPublishedReason });
      if (res.ok) {
        toast('Contenu marqué comme non publié', 'success');
        setShowMarkNotPublished(false);
        setNotPublishedReason('');
        setDetail(null);
        loadData();
      } else {
        toast('Erreur lors du marquage', 'error');
      }
    } catch {
      toast('Erreur lors du marquage', 'error');
    } finally {
      setMarkSaving(false);
    }
  };

  // ── Detail view ──
  if (detail) {
    return (
      <div className="space-y-4">
        <button onClick={() => setDetail(null)} className="flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
          <ArrowLeft size={16} /> Retour à la liste
        </button>

        <div className="card p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-black text-zinc-900">{detail.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <Badge value={detail.platform} colorMap={platformColor} />
                <Badge value={detail.content_type} colorMap={{ post: 'bg-blue-50 text-blue-700', story: 'bg-pink-50 text-pink-700', reel: 'bg-purple-50 text-purple-700', video: 'bg-red-50 text-red-700', carousel: 'bg-indigo-50 text-indigo-700' }} />
                <Badge value={pubStatusLabel[detail.status] || detail.status} colorMap={pubStatusColor} />
              </div>
            </div>
            {detail.status === 'approved' && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowMarkPublished(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
                  <CheckCircle size={14} /> Marquer publiée
                </button>
                <button onClick={() => setShowMarkNotPublished(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700">
                  <XCircle size={14} /> Non publiée
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Date planifiée</p>
              <p className="text-sm font-medium text-zinc-700 flex items-center gap-1.5">
                <Clock size={14} className="text-zinc-400" />
                {detail.planned_at ? new Date(detail.planned_at).toLocaleString('fr-FR') : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Compte social</p>
              <p className="text-sm font-medium text-zinc-700">{detail.social_account?.account_name ?? '—'}</p>
            </div>
            {detail.published_at && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Publié le</p>
                <p className="text-sm font-medium text-zinc-700">{new Date(detail.published_at).toLocaleString('fr-FR')}</p>
              </div>
            )}
            {detail.published_url && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Lien publication</p>
                <p className="text-sm font-medium text-primary-600 flex items-center gap-1 break-all">
                  <ExternalLink size={14} /> {detail.published_url}
                </p>
              </div>
            )}
            {detail.validated_by_user && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Validé par</p>
                <p className="text-sm font-medium text-zinc-700">{detail.validated_by_user.name}</p>
              </div>
            )}
          </div>

          {detail.caption && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Légende</p>
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm text-zinc-700 whitespace-pre-wrap">{detail.caption}</div>
            </div>
          )}

          {detail.description && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Consignes</p>
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm text-zinc-700 whitespace-pre-wrap">{detail.description}</div>
            </div>
          )}

          {detail.not_published_reason && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              <span className="font-semibold">Motif de non-publication :</span> {detail.not_published_reason}
            </div>
          )}
        </div>

        {/* Mark Published modal */}
        <Modal open={showMarkPublished} onClose={() => setShowMarkPublished(false)} title="Marquer comme publiée"
          footer={
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowMarkPublished(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button>
              <button onClick={markPublished} disabled={markSaving} className="btn btn-primary flex items-center gap-2 text-sm">
                {markSaving && <Loader2 size={14} className="animate-spin" />} Confirmer
              </button>
            </div>
          }
        >
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Lien de la publication *</label>
            <input className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="https://..." value={publishedUrl} onChange={e => setPublishedUrl(e.target.value)} />
          </div>
        </Modal>

        {/* Mark Not Published modal */}
        <Modal open={showMarkNotPublished} onClose={() => setShowMarkNotPublished(false)} title="Marquer comme non publiée"
          footer={
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowMarkNotPublished(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button>
              <button onClick={markNotPublished} disabled={markSaving} className="btn btn-primary flex items-center gap-2 text-sm">
                {markSaving && <Loader2 size={14} className="animate-spin" />} Confirmer
              </button>
            </div>
          }
        >
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Motif de non-publication *</label>
            <textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={notPublishedReason} onChange={e => setNotPublishedReason(e.target.value)} placeholder="Expliquez pourquoi le contenu n'a pas été publié..." />
          </div>
        </Modal>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs" placeholder="Rechercher..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}>
          <option value="">Toutes les plateformes</option>
          <option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option>
          <option value="twitter">Twitter</option><option value="linkedin">LinkedIn</option><option value="youtube">YouTube</option>
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          <option value="draft">Brouillon</option><option value="approved">Approuvé</option><option value="published">Publié</option><option value="cancelled">Annulé</option>
        </select>
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState title="Aucune publication" description="Aucune publication ne correspond à vos critères." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Plateforme</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date planifiée</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-700">{r.title}</td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.platform} colorMap={platformColor} /></td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{r.content_type}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{r.planned_at ? new Date(r.planned_at).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-sm"><Badge value={pubStatusLabel[r.status] || r.status} colorMap={pubStatusColor} /></td>
                    <td className="px-4 py-3 text-sm">
                      <button onClick={() => loadDetail(r.id)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600" title="Voir le détail">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{total} résultat{total > 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
              <span className="text-sm font-medium">{page} / {lastPage}</span>
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Tab 3 : Suivi influenceurs (E4)                                    */
/* ================================================================== */

function TabInfluenceurs({ toast, onNewComplaint }: { toast: (m: string, t: string) => void; onNewComplaint: () => void }) {
  const [logs, setLogs] = useState<InfluencerContentLog[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [contentType, setContentType] = useState('');
  const [sigPage, setSigPage] = useState(1);
  const [sigTotal, setSigTotal] = useState(0);
  const [sigLastPage, setSigLastPage] = useState(1);
  const [showNewLog, setShowNewLog] = useState(false);
  const [showNewSignal, setShowNewSignal] = useState(false);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [saving, setSaving] = useState(false);
  const [logForm, setLogForm] = useState({ influencer_id: '', content_type: '', platform: '', content_url: '', published_at: '', notes: '' });
  const [sigForm, setSigForm] = useState({ influencer_id: '', signal_type: '', severity: '', description: '' });

  const loadLogs = useCallback(async () => {
    try {
      const res = await api.get<Paginated<InfluencerContentLog>>(
        'cm/influencer-content' + buildQuery({ per_page: 25, page, platform: platform || undefined, content_type: contentType || undefined, search: search || undefined }),
      );
      if (res.ok) { setLogs(res.data.data); setTotal(res.data.total); setLastPage(res.data.last_page); }
    } catch { toast('Erreur lors du chargement', 'error'); }
  }, [page, platform, contentType, search, toast]);

  const loadSignals = useCallback(async () => {
    try {
      const res = await api.get<Paginated<Signal>>('cm/signals' + buildQuery({ per_page: 25, page: sigPage }));
      if (res.ok) { setSignals(res.data.data); setSigTotal(res.data.total); setSigLastPage(res.data.last_page); }
    } catch { toast('Erreur lors du chargement des signalements', 'error'); }
  }, [sigPage, toast]);

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([loadLogs(), loadSignals()]); setLoading(false); })();
  }, [loadLogs, loadSignals]);

  const loadInfluencers = async () => {
    try { const res = await api.get<Paginated<Influencer>>('influencers' + buildQuery({ per_page: 100 })); if (res.ok) setInfluencers(res.data.data); } catch {}
  };
  const openNewLog = () => { loadInfluencers(); setShowNewLog(true); };
  const openNewSignal = () => { loadInfluencers(); setShowNewSignal(true); };

  const submitLog = async () => {
    if (!logForm.influencer_id || !logForm.content_type || !logForm.platform) { toast('Veuillez remplir les champs obligatoires', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('cm/influencer-content', { ...logForm, influencer_id: Number(logForm.influencer_id) });
      if (res.ok) { toast('Log créé avec succès', 'success'); setShowNewLog(false); setLogForm({ influencer_id: '', content_type: '', platform: '', content_url: '', published_at: '', notes: '' }); loadLogs(); }
      else toast('Erreur lors de la création', 'error');
    } catch { toast('Erreur lors de la création', 'error'); } finally { setSaving(false); }
  };

  const submitSignal = async () => {
    if (!sigForm.influencer_id || !sigForm.signal_type || !sigForm.severity || !sigForm.description) { toast('Veuillez remplir tous les champs', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('cm/signals', { ...sigForm, influencer_id: Number(sigForm.influencer_id) });
      if (res.ok) { toast('Signalement créé', 'success'); setShowNewSignal(false); setSigForm({ influencer_id: '', signal_type: '', severity: '', description: '' }); loadSignals(); }
      else toast('Erreur lors de la création', 'error');
    } catch { toast('Erreur lors de la création', 'error'); } finally { setSaving(false); }
  };

  const archiveLog = async (id: number) => {
    try { const res = await api.patch(`cm/influencer-content/${id}/archive`); if (res.ok) { toast('Contenu archivé', 'success'); loadLogs(); } else toast('Erreur', 'error'); }
    catch { toast('Erreur', 'error'); }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-900">Contenus influenceurs</h3>
          <button onClick={openNewLog} className="btn btn-primary flex items-center gap-2 text-sm"><Plus size={16} /> Nouveau log</button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs" placeholder="Rechercher..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}>
            <option value="">Toutes les plateformes</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="twitter">Twitter</option><option value="youtube">YouTube</option>
          </select>
          <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={contentType} onChange={e => { setContentType(e.target.value); setPage(1); }}>
            <option value="">Tous les types</option><option value="post">Post</option><option value="story">Story</option><option value="reel">Reel</option><option value="video">Vidéo</option><option value="live">Live</option>
          </select>
        </div>
        {logs.length === 0 ? <EmptyState title="Aucun contenu" description="Aucun contenu d'influenceur trouvé." /> : (
          <>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Influenceur</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Plateforme</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Archivé</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                </tr></thead>
                <tbody>
                  {logs.map(r => (
                    <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-zinc-700">{r.influencer?.full_name ?? `#${r.influencer_id}`}</td>
                      <td className="px-4 py-3 text-sm"><Badge value={r.content_type} colorMap={{ post: 'bg-blue-50 text-blue-700', story: 'bg-pink-50 text-pink-700', reel: 'bg-purple-50 text-purple-700', video: 'bg-red-50 text-red-700', 'vidéo': 'bg-red-50 text-red-700', live: 'bg-emerald-50 text-emerald-700' }} /></td>
                      <td className="px-4 py-3 text-sm"><Badge value={r.platform} colorMap={platformColor} /></td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{r.published_at ? new Date(r.published_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-4 py-3 text-sm">{r.is_archived ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-zinc-100 text-zinc-600">Archivé</span> : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">Actif</span>}</td>
                      <td className="px-4 py-3 text-sm">{!r.is_archived && <button onClick={() => archiveLog(r.id)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600" title="Archiver"><Archive size={16} /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{total} résultat{total > 1 ? 's' : ''}</p>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
                <span className="text-sm font-medium">{page} / {lastPage}</span>
                <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Signals */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2"><Flag size={16} className="text-orange-500" /> Signalements</h3>
          <div className="flex items-center gap-2">
            <button onClick={onNewComplaint} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"><AlertTriangle size={14} /> Réclamation</button>
            <button onClick={openNewSignal} className="btn btn-primary flex items-center gap-2 text-sm"><Plus size={16} /> Nouveau signalement</button>
          </div>
        </div>
        {signals.length === 0 ? <EmptyState title="Aucun signalement" description="Aucun signalement trouvé." /> : (
          <>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Influenceur</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Sévérité</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                </tr></thead>
                <tbody>
                  {signals.map(s => (
                    <tr key={s.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-zinc-700">{s.influencer?.full_name ?? `#${s.influencer_id}`}</td>
                      <td className="px-4 py-3 text-sm"><Badge value={s.signal_type} colorMap={{ retard: 'bg-orange-50 text-orange-700', contenu_non_conforme: 'bg-yellow-50 text-yellow-700', injoignable: 'bg-red-50 text-red-700', comportement: 'bg-purple-50 text-purple-700', autre: 'bg-zinc-100 text-zinc-600' }} /></td>
                      <td className="px-4 py-3 text-sm"><Badge value={s.severity} colorMap={severityColor} /></td>
                      <td className="px-4 py-3 text-sm text-zinc-600 max-w-[240px] truncate">{s.description}</td>
                      <td className="px-4 py-3 text-sm"><Badge value={s.status} colorMap={signalStatusColor} /></td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{new Date(s.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{sigTotal} résultat{sigTotal > 1 ? 's' : ''}</p>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={sigPage <= 1} onClick={() => setSigPage(p => p - 1)}><ChevronLeft size={16} /></button>
                <span className="text-sm font-medium">{sigPage} / {sigLastPage}</span>
                <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={sigPage >= sigLastPage} onClick={() => setSigPage(p => p + 1)}><ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New log modal */}
      <Modal open={showNewLog} onClose={() => setShowNewLog(false)} title="Nouveau log influenceur"
        footer={<div className="flex justify-end gap-3"><button onClick={() => setShowNewLog(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button><button onClick={submitLog} disabled={saving} className="btn btn-primary flex items-center gap-2 text-sm">{saving && <Loader2 size={14} className="animate-spin" />} Enregistrer</button></div>}>
        <div className="space-y-3">
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Influenceur *</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={logForm.influencer_id} onChange={e => setLogForm(f => ({ ...f, influencer_id: e.target.value }))}><option value="">Sélectionner...</option>{influencers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Type de contenu *</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={logForm.content_type} onChange={e => setLogForm(f => ({ ...f, content_type: e.target.value }))}><option value="">Sélectionner...</option><option value="post">Post</option><option value="story">Story</option><option value="reel">Reel</option><option value="video">Vidéo</option><option value="live">Live</option></select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Plateforme *</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={logForm.platform} onChange={e => setLogForm(f => ({ ...f, platform: e.target.value }))}><option value="">Sélectionner...</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="twitter">Twitter</option><option value="youtube">YouTube</option></select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">URL du contenu</label><input className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="https://..." value={logForm.content_url} onChange={e => setLogForm(f => ({ ...f, content_url: e.target.value }))} /></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Date de publication</label><input type="date" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={logForm.published_at} onChange={e => setLogForm(f => ({ ...f, published_at: e.target.value }))} /></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Notes</label><textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* New signal modal */}
      <Modal open={showNewSignal} onClose={() => setShowNewSignal(false)} title="Nouveau signalement"
        footer={<div className="flex justify-end gap-3"><button onClick={() => setShowNewSignal(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button><button onClick={submitSignal} disabled={saving} className="btn btn-primary flex items-center gap-2 text-sm">{saving && <Loader2 size={14} className="animate-spin" />} Enregistrer</button></div>}>
        <div className="space-y-3">
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Influenceur *</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={sigForm.influencer_id} onChange={e => setSigForm(f => ({ ...f, influencer_id: e.target.value }))}><option value="">Sélectionner...</option>{influencers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Type de signal *</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={sigForm.signal_type} onChange={e => setSigForm(f => ({ ...f, signal_type: e.target.value }))}><option value="">Sélectionner...</option><option value="retard">Retard</option><option value="contenu_non_conforme">Contenu non conforme</option><option value="injoignable">Injoignable</option><option value="comportement">Comportement</option><option value="autre">Autre</option></select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Sévérité *</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={sigForm.severity} onChange={e => setSigForm(f => ({ ...f, severity: e.target.value }))}><option value="">Sélectionner...</option><option value="faible">Faible</option><option value="moyen">Moyen</option><option value="élevé">Élevé</option><option value="critique">Critique</option></select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Description *</label><textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={sigForm.description} onChange={e => setSigForm(f => ({ ...f, description: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  Tab 4 : Modération (E5)                                            */
/* ================================================================== */

function TabModeration({ toast, onNewComplaint }: { toast: (m: string, t: string) => void; onNewComplaint: () => void }) {
  const [rows, setRows] = useState<ModerationAction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('');
  const [actionType, setActionType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ platform: '', action_type: '', social_account_id: '', description: '', screenshot_url: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<ModerationAction>>(
        'cm/moderation' + buildQuery({ per_page: 25, page, platform: platform || undefined, action_type: actionType || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
      );
      if (res.ok) { setRows(res.data.data); setTotal(res.data.total); setLastPage(res.data.last_page); } else setRows([]);
    } catch { toast('Erreur lors du chargement', 'error'); setRows([]); } finally { setLoading(false); }
  }, [page, platform, actionType, dateFrom, dateTo, toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = async () => {
    try { const res = await api.get<Paginated<SocialAccount>>('social-accounts' + buildQuery({ per_page: 100 })); if (res.ok) setAccounts(res.data.data); } catch {}
    setShowNew(true);
  };

  const submit = async () => {
    if (!form.platform || !form.action_type || !form.description) { toast('Veuillez remplir les champs obligatoires', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.post('cm/moderation', { ...form, social_account_id: form.social_account_id ? Number(form.social_account_id) : null, action_date: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      if (res.ok) { toast('Action de modération créée', 'success'); setShowNew(false); setForm({ platform: '', action_type: '', social_account_id: '', description: '', screenshot_url: '' }); load(); }
      else toast('Erreur lors de la création', 'error');
    } catch { toast('Erreur lors de la création', 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-900">Actions de modération</h3>
        <div className="flex items-center gap-2">
          <button onClick={onNewComplaint} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"><AlertTriangle size={14} /> Réclamation</button>
          <button onClick={openNew} className="btn btn-primary flex items-center gap-2 text-sm"><Plus size={16} /> Nouvelle action</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}>
          <option value="">Toutes les plateformes</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="twitter">Twitter</option><option value="youtube">YouTube</option>
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={actionType} onChange={e => { setActionType(e.target.value); setPage(1); }}>
          <option value="">Tous les types</option><option value="commentaire_supprimé">Commentaire supprimé</option><option value="commentaire_masqué">Commentaire masqué</option><option value="message_envoyé">Message envoyé</option><option value="avis_signalé">Avis signalé</option><option value="ban_utilisateur">Ban utilisateur</option><option value="autre">Autre</option>
        </select>
        <input type="date" className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} title="Date début" />
        <input type="date" className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} title="Date fin" />
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? <EmptyState title="Aucune action" description="Aucune action de modération trouvée." /> : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full"><thead><tr className="border-b border-zinc-100">
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Plateforme</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type d'action</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Compte social</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
            </tr></thead><tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm"><Badge value={r.platform} colorMap={platformColor} /></td>
                  <td className="px-4 py-3 text-sm"><Badge value={r.action_type} colorMap={actionTypeColor} /></td>
                  <td className="px-4 py-3 text-sm text-zinc-600 max-w-[280px] truncate">{r.description}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{r.social_account?.account_name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{total} résultat{total > 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
              <span className="text-sm font-medium">{page} / {lastPage}</span>
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
            </div>
          </div>
        </>
      )}

      {/* New moderation modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nouvelle action de modération"
        footer={<div className="flex justify-end gap-3"><button onClick={() => setShowNew(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button><button onClick={submit} disabled={saving} className="btn btn-primary flex items-center gap-2 text-sm">{saving && <Loader2 size={14} className="animate-spin" />} Enregistrer</button></div>}>
        <div className="space-y-3">
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Plateforme *</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}><option value="">Sélectionner...</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="twitter">Twitter</option><option value="youtube">YouTube</option></select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Type d'action *</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}><option value="">Sélectionner...</option><option value="commentaire_supprimé">Commentaire supprimé</option><option value="commentaire_masqué">Commentaire masqué</option><option value="message_envoyé">Message envoyé</option><option value="avis_signalé">Avis signalé</option><option value="ban_utilisateur">Ban utilisateur</option><option value="autre">Autre</option></select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Compte social</label><select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={form.social_account_id} onChange={e => setForm(f => ({ ...f, social_account_id: e.target.value }))}><option value="">Sélectionner...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({a.platform})</option>)}</select></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">Description *</label><textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="block text-xs font-semibold text-zinc-500 mb-1">URL capture d'écran</label><input className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="https://..." value={form.screenshot_url} onChange={e => setForm(f => ({ ...f, screenshot_url: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  Tab 5 : Mes réclamations (E7) — with thread system                  */
/* ================================================================== */

function TabReclamations({ toast, userId, onNewComplaint, refreshToken }: { toast: (m: string, t: string) => void; userId?: number; onNewComplaint: () => void; refreshToken: number }) {
  const [rows, setRows] = useState<CallCenterComplaint[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Detail + thread
  const [detail, setDetail] = useState<CallCenterComplaint | null>(null);
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Priority edit
  const [editPriority, setEditPriority] = useState(false);
  const [newPriority, setNewPriority] = useState('');
  const [savingPriority, setSavingPriority] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<CallCenterComplaint>>(
        'complaints' + buildQuery({ source_user_id: userId, per_page: 25, page }),
      );
      if (res.ok) { setRows(res.data.data); setTotal(res.data.total); setLastPage(res.data.last_page); }
      else setRows([]);
    } catch { toast('Erreur lors du chargement', 'error'); setRows([]); } finally { setLoading(false); }
  }, [page, userId, toast, refreshToken]);

  useEffect(() => { loadList(); }, [loadList]);

  const openDetail = async (id: number) => {
    try {
      const res = await api.get<CallCenterComplaint>(`complaints/${id}`);
      if (res.ok) {
        setDetail(res.data);
        setNewPriority(res.data.priority);
        loadThread(id);
      }
    } catch { toast('Erreur lors du chargement', 'error'); }
  };

  const loadThread = async (id: number) => {
    setThreadLoading(true);
    try {
      const res = await api.get<ThreadEntry[]>(`complaints/${id}/thread`);
      if (res.ok) setThread(res.data);
    } catch {} finally { setThreadLoading(false); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !detail) return;
    setSendingMessage(true);
    try {
      const res = await api.post(`complaints/${detail.id}/thread`, { content: newMessage, entry_type: 'message' });
      if (res.ok) {
        toast('Message envoyé', 'success');
        setNewMessage('');
        loadThread(detail.id);
      } else {
        toast('Erreur lors de l\'envoi', 'error');
      }
    } catch { toast('Erreur lors de l\'envoi', 'error'); } finally { setSendingMessage(false); }
  };

  const savePriority = async () => {
    if (!detail || newPriority === detail.priority) return;
    setSavingPriority(true);
    try {
      const res = await api.put(`complaints/${detail.id}`, { priority: newPriority });
      if (res.ok) {
        toast('Priorité mise à jour', 'success');
        setDetail(prev => prev ? { ...prev, priority: newPriority } : null);
        setEditPriority(false);
        loadThread(detail.id);
        loadList();
      } else toast('Erreur', 'error');
    } catch { toast('Erreur', 'error'); } finally { setSavingPriority(false); }
  };

  // ── Detail view with thread ──
  if (detail) {
    const isClosed = detail.status === 'clôturée';
    return (
      <div className="space-y-4">
        <button onClick={() => { setDetail(null); setThread([]); }} className="flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900">
          <ArrowLeft size={16} /> Retour aux réclamations
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: complaint info */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">{detail.reference}</span>
                <Badge value={complaintStatusLabel[detail.status] || detail.status} colorMap={complaintStatusColor} />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</p>
                <p className="text-sm font-bold text-zinc-900">{detail.customer_name}</p>
                {detail.customer_phone && <p className="text-xs text-zinc-500">{detail.customer_phone}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Canal</p>
                  <p className="text-sm font-medium text-zinc-700">{detail.channel}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Catégorie</p>
                  <p className="text-sm font-medium text-zinc-700">{detail.category}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Priorité</p>
                {editPriority ? (
                  <div className="flex items-center gap-2">
                    {(['P1', 'P2', 'P3'] as const).map(p => (
                      <button key={p} onClick={() => setNewPriority(p)} className={`px-3 py-1 rounded-lg text-xs font-bold border-2 ${newPriority === p ? (p === 'P1' ? 'border-red-500 bg-red-50 text-red-700' : p === 'P2' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-zinc-400 bg-zinc-50 text-zinc-700') : 'border-zinc-200 text-zinc-400'}`}>{p}</button>
                    ))}
                    <button onClick={savePriority} disabled={savingPriority} className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"><Check size={14} /></button>
                    <button onClick={() => { setEditPriority(false); setNewPriority(detail.priority); }} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge value={detail.priority} colorMap={priorityColor} />
                    {!isClosed && <button onClick={() => setEditPriority(true)} className="text-xs text-primary-600 hover:underline">Modifier</button>}
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</p>
                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{detail.description}</p>
              </div>

              {detail.assigned_user && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assigné à</p>
                  <p className="text-sm font-medium text-zinc-700">{detail.assigned_user.name}</p>
                </div>
              )}

              {detail.resolution_notes && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700">
                  <span className="font-semibold">Résolution :</span> {detail.resolution_notes}
                </div>
              )}

              <p className="text-xs text-zinc-400">Créée le {new Date(detail.created_at).toLocaleString('fr-FR')}</p>
            </div>
          </div>

          {/* Right: thread */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-4">
              <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2 mb-4">
                <MessageSquare size={16} /> Fil d'échange
              </h3>

              {threadLoading ? <Spinner /> : thread.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-6">Aucun message dans ce fil.</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {thread.map(entry => (
                    <div key={entry.id} className={`p-3 rounded-xl border ${
                      entry.entry_type === 'changement_de_champ'
                        ? 'bg-amber-50 border-amber-100'
                        : entry.author_user_id === userId
                          ? 'bg-primary-50 border-primary-100'
                          : 'bg-zinc-50 border-zinc-100'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-zinc-600">{entry.author?.name ?? 'Système'}</span>
                        <span className="text-[10px] text-zinc-400">{new Date(entry.created_at).toLocaleString('fr-FR')}</span>
                      </div>
                      {entry.entry_type === 'changement_de_champ' && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase bg-amber-100 text-amber-700 mb-1">Modification</span>
                      )}
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap">{entry.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* New message input */}
              {!isClosed && (
                <div className="mt-4 flex gap-2">
                  <textarea
                    className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium resize-none"
                    rows={2}
                    placeholder="Écrire un message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    className="self-end px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {sendingMessage ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Envoyer
                  </button>
                </div>
              )}
              {isClosed && (
                <div className="mt-4 p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-center text-sm text-zinc-400">
                  Ce fil est en lecture seule — la réclamation est clôturée.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-900">Mes réclamations</h3>
        <button onClick={onNewComplaint} className="btn btn-primary flex items-center gap-2 text-sm"><Plus size={16} /> Nouvelle réclamation</button>
      </div>

      {loading ? <Spinner /> : rows.length === 0 ? (
        <EmptyState title="Aucune réclamation" description="Vous n'avez aucune réclamation en cours." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full"><thead><tr className="border-b border-zinc-100">
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Référence</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Client</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Catégorie</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Priorité</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
              <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
            </tr></thead><tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                  <td className="px-4 py-3 text-sm font-mono font-bold text-zinc-500">{r.reference}</td>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-700">{r.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{r.category}</td>
                  <td className="px-4 py-3 text-sm"><Badge value={r.priority} colorMap={priorityColor} /></td>
                  <td className="px-4 py-3 text-sm"><Badge value={complaintStatusLabel[r.status] || r.status} colorMap={complaintStatusColor} /></td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={() => openDetail(r.id)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600" title="Voir"><Eye size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{total} résultat{total > 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
              <span className="text-sm font-medium">{page} / {lastPage}</span>
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
