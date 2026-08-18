import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import * as api from '../lib/api';
import { buildQuery } from '../lib/pagination';
import type { Paginated } from '../lib/pagination';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardCheck, FileText, Users, Shield, AlertTriangle,
  Plus, Search, ChevronLeft, ChevronRight, Loader2, Check, X,
  Archive, Flag, Eye,
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
  status: string;
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

type Complaint = {
  id: number;
  influencer?: { id: number; full_name: string };
  subject: string;
  status: string;
  priority: string;
  created_at: string;
};

type Influencer = { id: number; full_name: string };
type SocialAccount = { id: number; platform: string; account_name: string };

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
  brouillon: 'bg-zinc-100 text-zinc-600',
  en_revision: 'bg-yellow-50 text-yellow-700',
  approuve: 'bg-emerald-50 text-emerald-700',
  'approuvé': 'bg-emerald-50 text-emerald-700',
  publie: 'bg-blue-50 text-blue-700',
  'publié': 'bg-blue-50 text-blue-700',
  rejete: 'bg-red-50 text-red-700',
  'rejeté': 'bg-red-50 text-red-700',
};

const pubStatusLabel: Record<string, string> = {
  brouillon: 'Brouillon',
  en_revision: 'En révision',
  approuve: 'Approuvé',
  'approuvé': 'Approuvé',
  publie: 'Publié',
  'publié': 'Publié',
  rejete: 'Rejeté',
  'rejeté': 'Rejeté',
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
  basse: 'bg-zinc-100 text-zinc-600',
  normale: 'bg-blue-50 text-blue-700',
  haute: 'bg-orange-50 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

const complaintStatusColor: Record<string, string> = {
  ouverte: 'bg-orange-50 text-orange-700',
  en_cours: 'bg-blue-50 text-blue-700',
  'résolue': 'bg-emerald-50 text-emerald-700',
  resolue: 'bg-emerald-50 text-emerald-700',
  'fermée': 'bg-zinc-100 text-zinc-600',
  fermee: 'bg-zinc-100 text-zinc-600',
};

function Badge({ value, colorMap }: { value: string; colorMap: Record<string, string> }) {
  const key = value.toLowerCase().replace(/ /g, '_');
  const cls = colorMap[key] || 'bg-zinc-100 text-zinc-600';
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
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CmTab>('journee');

  return (
    <div className="space-y-6">
      <PageHeader title="Community Manager" subtitle="Espace de travail CM" />

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
      {activeTab === 'journee' && <TabJournee toast={toast} userId={user?.id} />}
      {activeTab === 'publications' && <TabPublications toast={toast} userId={user?.id} />}
      {activeTab === 'influenceurs' && <TabInfluenceurs toast={toast} />}
      {activeTab === 'moderation' && <TabModeration toast={toast} />}
      {activeTab === 'reclamations' && <TabReclamations toast={toast} userId={user?.id} />}
    </div>
  );
}

/* ================================================================== */
/*  Tab 1 : Ma journée                                                  */
/* ================================================================== */

function TabJournee({ toast, userId }: { toast: (m: string, t: string) => void; userId?: number }) {
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newItems, setNewItems] = useState<{ label: string; category: string }[]>([{ label: '', category: 'publication' }]);
  const [saving, setSaving] = useState(false);

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

  if (loading) return <Spinner />;

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
          <button onClick={() => setShowCreate(true)} className="btn btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Créer ma checklist
          </button>
        </div>
        {checklists.length === 0 ? (
          <p className="text-sm text-zinc-400 py-4 text-center">Aucune checklist pour aujourd'hui.</p>
        ) : (
          checklists.map(cl => (
            <div key={cl.id} className="space-y-2">
              {cl.items.map(item => (
                <label key={item.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 cursor-pointer">
                  <button
                    onClick={() => toggleItem(cl.id, item.id)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      item.is_completed ? 'bg-primary-600 border-primary-600 text-white' : 'border-zinc-300'
                    }`}
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

      {/* Alertes */}
      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2">
          <AlertTriangle size={16} className="text-orange-500" /> Alertes
        </h3>
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
              <input
                className="flex-1 px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
                placeholder="Libellé de la tâche"
                value={item.label}
                onChange={e => setNewItems(prev => prev.map((it, j) => (j === i ? { ...it, label: e.target.value } : it)))}
              />
              <select
                className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium"
                value={item.category}
                onChange={e => setNewItems(prev => prev.map((it, j) => (j === i ? { ...it, category: e.target.value } : it)))}
              >
                <option value="publication">Publication</option>
                <option value="modération">Modération</option>
                <option value="veille">Veille</option>
                <option value="reporting">Reporting</option>
              </select>
              {newItems.length > 1 && (
                <button onClick={() => setNewItems(prev => prev.filter((_, j) => j !== i))} className="p-2.5 rounded-xl hover:bg-zinc-100 text-zinc-400">
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setNewItems(prev => [...prev, { label: '', category: 'publication' }])}
            className="text-sm font-semibold text-primary-600 hover:underline flex items-center gap-1"
          >
            <Plus size={14} /> Ajouter un élément
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  Tab 2 : Publications                                               */
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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<ContentCalendarEntry>>(
          'content-calendar' + buildQuery({ assigned_to: userId, per_page: 25, page, platform: platform || undefined, status: status || undefined, search: search || undefined }),
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
    })();
  }, [page, platform, status, search, userId, toast]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
            placeholder="Rechercher..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}>
          <option value="">Toutes les plateformes</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="twitter">Twitter</option>
          <option value="linkedin">LinkedIn</option>
          <option value="youtube">YouTube</option>
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Tous les statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="en_revision">En révision</option>
          <option value="approuvé">Approuvé</option>
          <option value="publié">Publié</option>
          <option value="rejeté">Rejeté</option>
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune publication" description="Aucune publication ne correspond à vos critères." />
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
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-700">{r.title}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge value={r.platform} colorMap={platformColor} />
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{r.content_type}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{r.planned_at ? new Date(r.planned_at).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge value={pubStatusLabel[r.status] || r.status} colorMap={pubStatusColor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">{total} résultat{total > 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium">{page} / {lastPage}</span>
              <button className="p-2 rounded-lg hover:bg-zinc-100 disabled:opacity-40" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Tab 3 : Suivi influenceurs                                         */
/* ================================================================== */

function TabInfluenceurs({ toast }: { toast: (m: string, t: string) => void }) {
  const [logs, setLogs] = useState<InfluencerContentLog[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('');
  const [contentType, setContentType] = useState('');

  // Signals pagination
  const [sigPage, setSigPage] = useState(1);
  const [sigTotal, setSigTotal] = useState(0);
  const [sigLastPage, setSigLastPage] = useState(1);

  // Modals
  const [showNewLog, setShowNewLog] = useState(false);
  const [showNewSignal, setShowNewSignal] = useState(false);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [saving, setSaving] = useState(false);

  // New log form
  const [logForm, setLogForm] = useState({
    influencer_id: '', content_type: '', platform: '', content_url: '', published_at: '', notes: '',
  });

  // New signal form
  const [sigForm, setSigForm] = useState({
    influencer_id: '', signal_type: '', severity: '', description: '',
  });

  const loadLogs = useCallback(async () => {
    try {
      const res = await api.get<Paginated<InfluencerContentLog>>(
        'cm/influencer-content' + buildQuery({ per_page: 25, page, platform: platform || undefined, content_type: contentType || undefined, search: search || undefined }),
      );
      if (res.ok) {
        setLogs(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
      }
    } catch {
      toast('Erreur lors du chargement', 'error');
    }
  }, [page, platform, contentType, search, toast]);

  const loadSignals = useCallback(async () => {
    try {
      const res = await api.get<Paginated<Signal>>('cm/signals' + buildQuery({ per_page: 25, page: sigPage }));
      if (res.ok) {
        setSignals(res.data.data);
        setSigTotal(res.data.total);
        setSigLastPage(res.data.last_page);
      }
    } catch {
      toast('Erreur lors du chargement des signalements', 'error');
    }
  }, [sigPage, toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadLogs(), loadSignals()]);
      setLoading(false);
    })();
  }, [loadLogs, loadSignals]);

  const loadInfluencers = async () => {
    try {
      const res = await api.get<Paginated<Influencer>>('influencers' + buildQuery({ per_page: 100 }));
      if (res.ok) setInfluencers(res.data.data);
    } catch { /* ignore */ }
  };

  const openNewLog = () => { loadInfluencers(); setShowNewLog(true); };
  const openNewSignal = () => { loadInfluencers(); setShowNewSignal(true); };

  const submitLog = async () => {
    if (!logForm.influencer_id || !logForm.content_type || !logForm.platform) {
      toast('Veuillez remplir les champs obligatoires', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await api.post('cm/influencer-content', { ...logForm, influencer_id: Number(logForm.influencer_id) });
      if (res.ok) {
        toast('Log créé avec succès', 'success');
        setShowNewLog(false);
        setLogForm({ influencer_id: '', content_type: '', platform: '', content_url: '', published_at: '', notes: '' });
        loadLogs();
      } else {
        toast('Erreur lors de la création', 'error');
      }
    } catch {
      toast('Erreur lors de la création', 'error');
    } finally {
      setSaving(false);
    }
  };

  const submitSignal = async () => {
    if (!sigForm.influencer_id || !sigForm.signal_type || !sigForm.severity || !sigForm.description) {
      toast('Veuillez remplir tous les champs', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await api.post('cm/signals', { ...sigForm, influencer_id: Number(sigForm.influencer_id) });
      if (res.ok) {
        toast('Signalement créé', 'success');
        setShowNewSignal(false);
        setSigForm({ influencer_id: '', signal_type: '', severity: '', description: '' });
        loadSignals();
      } else {
        toast('Erreur lors de la création', 'error');
      }
    } catch {
      toast('Erreur lors de la création', 'error');
    } finally {
      setSaving(false);
    }
  };

  const archiveLog = async (id: number) => {
    try {
      const res = await api.patch(`cm/influencer-content/${id}/archive`);
      if (res.ok) {
        toast('Contenu archivé', 'success');
        loadLogs();
      } else {
        toast('Erreur lors de l\'archivage', 'error');
      }
    } catch {
      toast('Erreur lors de l\'archivage', 'error');
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-8">
      {/* Content logs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-900">Contenus influenceurs</h3>
          <button onClick={openNewLog} className="btn btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Nouveau log
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              className="pl-9 pr-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium w-full max-w-xs"
              placeholder="Rechercher..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}>
            <option value="">Toutes les plateformes</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="twitter">Twitter</option>
            <option value="youtube">YouTube</option>
          </select>
          <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={contentType} onChange={e => { setContentType(e.target.value); setPage(1); }}>
            <option value="">Tous les types</option>
            <option value="post">Post</option>
            <option value="story">Story</option>
            <option value="reel">Reel</option>
            <option value="video">Vidéo</option>
            <option value="live">Live</option>
          </select>
        </div>

        {logs.length === 0 ? (
          <EmptyState icon={Users} title="Aucun contenu" description="Aucun contenu d'influenceur trouvé." />
        ) : (
          <>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Influenceur</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type de contenu</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Plateforme</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date publication</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Archivé</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(r => (
                    <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-zinc-700">{r.influencer?.full_name ?? `#${r.influencer_id}`}</td>
                      <td className="px-4 py-3 text-sm"><Badge value={r.content_type} colorMap={{ post: 'bg-blue-50 text-blue-700', story: 'bg-pink-50 text-pink-700', reel: 'bg-purple-50 text-purple-700', video: 'bg-red-50 text-red-700', 'vidéo': 'bg-red-50 text-red-700', live: 'bg-emerald-50 text-emerald-700' }} /></td>
                      <td className="px-4 py-3 text-sm"><Badge value={r.platform} colorMap={platformColor} /></td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{r.published_at ? new Date(r.published_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        {r.is_archived
                          ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-zinc-100 text-zinc-600">Archivé</span>
                          : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">Actif</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!r.is_archived && (
                          <button onClick={() => archiveLog(r.id)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600" title="Archiver">
                            <Archive size={16} />
                          </button>
                        )}
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

      {/* Signals section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2"><Flag size={16} className="text-orange-500" /> Signalements</h3>
          <button onClick={openNewSignal} className="btn btn-primary flex items-center gap-2 text-sm">
            <Plus size={16} /> Nouveau signalement
          </button>
        </div>

        {signals.length === 0 ? (
          <EmptyState icon={Flag} title="Aucun signalement" description="Aucun signalement trouvé." />
        ) : (
          <>
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Influenceur</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Sévérité</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                  </tr>
                </thead>
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
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowNewLog(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button>
            <button onClick={submitLog} disabled={saving} className="btn btn-primary flex items-center gap-2 text-sm">
              {saving && <Loader2 size={14} className="animate-spin" />} Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Influenceur *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={logForm.influencer_id} onChange={e => setLogForm(f => ({ ...f, influencer_id: e.target.value }))}>
              <option value="">Sélectionner...</option>
              {influencers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Type de contenu *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={logForm.content_type} onChange={e => setLogForm(f => ({ ...f, content_type: e.target.value }))}>
              <option value="">Sélectionner...</option>
              <option value="post">Post</option>
              <option value="story">Story</option>
              <option value="reel">Reel</option>
              <option value="video">Vidéo</option>
              <option value="live">Live</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Plateforme *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={logForm.platform} onChange={e => setLogForm(f => ({ ...f, platform: e.target.value }))}>
              <option value="">Sélectionner...</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="twitter">Twitter</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">URL du contenu</label>
            <input className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="https://..." value={logForm.content_url} onChange={e => setLogForm(f => ({ ...f, content_url: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Date de publication</label>
            <input type="date" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={logForm.published_at} onChange={e => setLogForm(f => ({ ...f, published_at: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Notes</label>
            <textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* New signal modal */}
      <Modal open={showNewSignal} onClose={() => setShowNewSignal(false)} title="Nouveau signalement"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowNewSignal(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button>
            <button onClick={submitSignal} disabled={saving} className="btn btn-primary flex items-center gap-2 text-sm">
              {saving && <Loader2 size={14} className="animate-spin" />} Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Influenceur *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={sigForm.influencer_id} onChange={e => setSigForm(f => ({ ...f, influencer_id: e.target.value }))}>
              <option value="">Sélectionner...</option>
              {influencers.map(i => <option key={i.id} value={i.id}>{i.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Type de signal *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={sigForm.signal_type} onChange={e => setSigForm(f => ({ ...f, signal_type: e.target.value }))}>
              <option value="">Sélectionner...</option>
              <option value="retard">Retard</option>
              <option value="contenu_non_conforme">Contenu non conforme</option>
              <option value="injoignable">Injoignable</option>
              <option value="comportement">Comportement</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Sévérité *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={sigForm.severity} onChange={e => setSigForm(f => ({ ...f, severity: e.target.value }))}>
              <option value="">Sélectionner...</option>
              <option value="faible">Faible</option>
              <option value="moyen">Moyen</option>
              <option value="élevé">Élevé</option>
              <option value="critique">Critique</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Description *</label>
            <textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={sigForm.description} onChange={e => setSigForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  Tab 4 : Modération                                                  */
/* ================================================================== */

function TabModeration({ toast }: { toast: (m: string, t: string) => void }) {
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
  const [form, setForm] = useState({
    platform: '', action_type: '', social_account_id: '', description: '', screenshot_url: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Paginated<ModerationAction>>(
        'cm/moderation' + buildQuery({ per_page: 25, page, platform: platform || undefined, action_type: actionType || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
      );
      if (res.ok) {
        setRows(res.data.data);
        setTotal(res.data.total);
        setLastPage(res.data.last_page);
      } else {
        setRows([]);
      }
    } catch {
      toast('Erreur lors du chargement', 'error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, platform, actionType, dateFrom, dateTo, toast]);

  useEffect(() => { load(); }, [load]);

  const openNew = async () => {
    try {
      const res = await api.get<Paginated<SocialAccount>>('social-accounts' + buildQuery({ per_page: 100 }));
      if (res.ok) setAccounts(res.data.data);
    } catch { /* ignore */ }
    setShowNew(true);
  };

  const submit = async () => {
    if (!form.platform || !form.action_type || !form.description) {
      toast('Veuillez remplir les champs obligatoires', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await api.post('cm/moderation', {
        ...form,
        social_account_id: form.social_account_id ? Number(form.social_account_id) : null,
        action_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
      if (res.ok) {
        toast('Action de modération créée', 'success');
        setShowNew(false);
        setForm({ platform: '', action_type: '', social_account_id: '', description: '', screenshot_url: '' });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-900">Actions de modération</h3>
        <button onClick={openNew} className="btn btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Nouvelle action
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={platform} onChange={e => { setPlatform(e.target.value); setPage(1); }}>
          <option value="">Toutes les plateformes</option>
          <option value="facebook">Facebook</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="twitter">Twitter</option>
          <option value="youtube">YouTube</option>
        </select>
        <select className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={actionType} onChange={e => { setActionType(e.target.value); setPage(1); }}>
          <option value="">Tous les types</option>
          <option value="commentaire_supprimé">Commentaire supprimé</option>
          <option value="commentaire_masqué">Commentaire masqué</option>
          <option value="message_envoyé">Message envoyé</option>
          <option value="avis_signalé">Avis signalé</option>
          <option value="ban_utilisateur">Ban utilisateur</option>
          <option value="autre">Autre</option>
        </select>
        <input type="date" className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} placeholder="Du" title="Date début" />
        <input type="date" className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} placeholder="Au" title="Date fin" />
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={Shield} title="Aucune action" description="Aucune action de modération trouvée." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Plateforme</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Type d'action</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Description</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Compte social</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm"><Badge value={r.platform} colorMap={platformColor} /></td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.action_type} colorMap={actionTypeColor} /></td>
                    <td className="px-4 py-3 text-sm text-zinc-600 max-w-[280px] truncate">{r.description}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{r.social_account?.account_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
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

      {/* New moderation modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nouvelle action de modération"
        footer={
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowNew(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">Annuler</button>
            <button onClick={submit} disabled={saving} className="btn btn-primary flex items-center gap-2 text-sm">
              {saving && <Loader2 size={14} className="animate-spin" />} Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Plateforme *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
              <option value="">Sélectionner...</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="twitter">Twitter</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Type d'action *</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))}>
              <option value="">Sélectionner...</option>
              <option value="commentaire_supprimé">Commentaire supprimé</option>
              <option value="commentaire_masqué">Commentaire masqué</option>
              <option value="message_envoyé">Message envoyé</option>
              <option value="avis_signalé">Avis signalé</option>
              <option value="ban_utilisateur">Ban utilisateur</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Compte social</label>
            <select className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" value={form.social_account_id} onChange={e => setForm(f => ({ ...f, social_account_id: e.target.value }))}>
              <option value="">Sélectionner...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({a.platform})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Description *</label>
            <textarea className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">URL capture d'écran</label>
            <input className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium" placeholder="https://..." value={form.screenshot_url} onChange={e => setForm(f => ({ ...f, screenshot_url: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ================================================================== */
/*  Tab 5 : Mes réclamations                                            */
/* ================================================================== */

function TabReclamations({ toast, userId }: { toast: (m: string, t: string) => void; userId?: number }) {
  const [rows, setRows] = useState<Complaint[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<Paginated<Complaint>>(
          'influencer-complaints' + buildQuery({ created_by: userId, per_page: 25, page }),
        );
        if (res.ok) {
          setRows(res.data.data);
          setTotal(res.data.total);
          setLastPage(res.data.last_page);
        } else {
          setRows([]);
        }
      } catch {
        toast('Erreur lors du chargement des réclamations', 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [page, userId, toast]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-zinc-900">Mes réclamations</h3>
        <button
          onClick={() => toast('Redirection vers le module réclamations...', 'success')}
          className="btn btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Nouvelle réclamation
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="Aucune réclamation" description="Vous n'avez aucune réclamation en cours." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Influenceur</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Sujet</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Statut</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Priorité</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-700">{r.influencer?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{r.subject}</td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.status} colorMap={complaintStatusColor} /></td>
                    <td className="px-4 py-3 text-sm"><Badge value={r.priority} colorMap={priorityColor} /></td>
                    <td className="px-4 py-3 text-sm text-zinc-600">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
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
