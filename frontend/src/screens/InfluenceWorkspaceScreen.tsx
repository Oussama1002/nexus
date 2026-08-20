import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  DollarSign,
  Eye,
  FileText,
  Handshake,
  LayoutGrid,
  Package,
  Pause,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Truck,
  UserCheck,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { flattenFieldErrors } from '../lib/formErrors';
import { formatCurrency } from '../lib/utils';
import {
  INFLUENCER_STATUS_LABELS,
  COLLAB_STATUS_LABELS,
  COLLAB_TYPE_LABELS,
  DELIVERABLE_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
  PAYMENT_NATURE_LABELS,
  PAYMENT_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  statusLabelFr,
} from '../lib/statusLabelsFr';

/* ─────── Types ─────── */
type Space = 'pilotage' | 'influenceuses' | 'collaborations' | 'livrables' | 'envois' | 'paiements' | 'documents';
type R = Record<string, unknown>;

const PLATFORMS = [
  { v: 'instagram', l: 'Instagram' },
  { v: 'facebook', l: 'Facebook' },
  { v: 'tiktok', l: 'TikTok' },
  { v: 'youtube', l: 'YouTube' },
  { v: 'linkedin', l: 'LinkedIn' },
  { v: 'x', l: 'X' },
];

const QUALIFICATION_DIMS = [
  { key: 'pertinence', label: 'Pertinence' },
  { key: 'autorite', label: 'Autorité' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'regularite', label: 'Régularité' },
  { key: 'homogeneite', label: 'Homogénéité' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'reputation', label: 'Réputation' },
  { key: 'creativite', label: 'Créativité' },
];

const INF_STATUSES = Object.keys(INFLUENCER_STATUS_LABELS);
const COLLAB_STATUSES = Object.keys(COLLAB_STATUS_LABELS);
const COLLAB_TYPES = Object.keys(COLLAB_TYPE_LABELS);
const DELIVERABLE_STATUSES = Object.keys(DELIVERABLE_STATUS_LABELS);
const SHIPMENT_STATUSES = Object.keys(SHIPMENT_STATUS_LABELS);
const PAYMENT_NATURES = Object.keys(PAYMENT_NATURE_LABELS);
const DOC_TYPES = Object.keys(DOCUMENT_TYPE_LABELS);
const CONTENT_TYPES = ['story', 'reel', 'post', 'video', 'live', 'carousel', 'article', 'autre'];

/* ─────── Helpers ─────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {children}
    </span>
  );
}

function StatusBadge({ value, labels }: { value: string | null | undefined; labels: Record<string, string> }) {
  if (!value) return <span className="text-zinc-400">—</span>;
  const colors: Record<string, string> = {
    reperee: 'bg-blue-50 text-blue-700',
    qualifiee: 'bg-indigo-50 text-indigo-700',
    contactee: 'bg-cyan-50 text-cyan-700',
    en_discussion: 'bg-amber-50 text-amber-700',
    en_negociation: 'bg-orange-50 text-orange-700',
    active: 'bg-green-50 text-green-700',
    inactive: 'bg-zinc-100 text-zinc-600',
    ecartee: 'bg-red-50 text-red-600',
    exclue: 'bg-red-100 text-red-800',
    brouillon: 'bg-zinc-100 text-zinc-600',
    en_attente_validation: 'bg-amber-50 text-amber-700',
    refusee: 'bg-red-50 text-red-600',
    en_preparation: 'bg-blue-50 text-blue-700',
    en_cours: 'bg-cyan-50 text-cyan-700',
    en_revue: 'bg-purple-50 text-purple-700',
    en_pause: 'bg-amber-100 text-amber-800',
    contractualisation_en_attente: 'bg-orange-50 text-orange-700',
    contractualisee: 'bg-teal-50 text-teal-700',
    terminee: 'bg-green-50 text-green-700',
    arretee: 'bg-red-50 text-red-600',
    a_produire: 'bg-zinc-100 text-zinc-600',
    livre: 'bg-blue-50 text-blue-700',
    valide: 'bg-green-50 text-green-700',
    refuse: 'bg-red-50 text-red-600',
    a_preparer: 'bg-zinc-100 text-zinc-600',
    expedie: 'bg-blue-50 text-blue-700',
    en_acheminement: 'bg-cyan-50 text-cyan-700',
    recu: 'bg-green-50 text-green-700',
    non_parvenu: 'bg-red-50 text-red-600',
    en_attente_validation_n1: 'bg-amber-50 text-amber-700',
    valide_n1: 'bg-blue-50 text-blue-700',
    en_attente_validation_n2: 'bg-orange-50 text-orange-700',
    valide_n2: 'bg-green-50 text-green-700',
    paye: 'bg-emerald-50 text-emerald-700',
    rejete: 'bg-red-50 text-red-600',
  };
  return <Badge color={colors[value] || 'bg-zinc-100 text-zinc-600'}>{labels[value] || value}</Badge>;
}

const selClass = 'w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold bg-white text-zinc-900';
const inputClass = selClass;

function fmtNum(n: unknown): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('fr-FR');
}

function fmtPct(n: unknown): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '—';
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}

function infLabel(row: R): string {
  const inf = (row.influencer as R | undefined) ?? null;
  if (!inf) return `#${String(row.influencer_id ?? '—')}`;
  return String(inf.full_name ?? inf.username ?? `#${String(row.influencer_id)}`);
}

function collabLabel(row: R): string {
  const c = (row.collaboration as R | undefined) ?? null;
  if (!c) return `#${String(row.collaboration_id ?? '—')}`;
  return String(c.title ?? `#${String(row.collaboration_id)}`);
}

function errToast(toast: ReturnType<typeof useToast>, res: { message: string; errors?: unknown }) {
  const fe = flattenFieldErrors((res.errors ?? {}) as Record<string, unknown>);
  toast.error(fe.length ? fe.join(' ') : res.message);
}

/* ─────── Stat Card ─────── */
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
      <div className="text-[11px] font-bold uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-black text-zinc-900">{value}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────────────── */
export function InfluenceWorkspaceScreen() {
  const { activeBrandId } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();

  const [space, setSpace] = useState<Space>('pilotage');
  const [loading, setLoading] = useState(false);

  /* ── Data stores ── */
  const [dash, setDash] = useState<R | null>(null);
  const [influencers, setInfluencers] = useState<R[]>([]);
  const [collabs, setCollabs] = useState<R[]>([]);
  const [deliverables, setDeliverables] = useState<R[]>([]);
  const [shipments, setShipments] = useState<R[]>([]);
  const [payments, setPayments] = useState<R[]>([]);
  const [publishedContents, setPublishedContents] = useState<R[]>([]);
  const [documents, setDocuments] = useState<R[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: number; name: string }[]>([]);

  /* ── Filters ── */
  const [infStatusFilter, setInfStatusFilter] = useState('');
  const [collabStatusFilter, setCollabStatusFilter] = useState('');

  /* ── Load ── */
  const load = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    try {
      if (space === 'pilotage') {
        const [dashR, infR] = await Promise.all([
          api.get<R>('dashboards/influence'),
          api.get<LaravelPaginator<R>>('influencers?per_page=200'),
        ]);
        if (dashR.ok) setDash(dashR.data);
        if (infR.ok && isPaginator(infR.data)) setInfluencers(infR.data.data);
      } else if (space === 'influenceuses') {
        const q = infStatusFilter ? `&status=${infStatusFilter}` : '';
        const r = await api.get<LaravelPaginator<R>>(`influencers?per_page=200${q}`);
        if (r.ok && isPaginator(r.data)) setInfluencers(r.data.data);
      } else if (space === 'collaborations') {
        const q = collabStatusFilter ? `&status=${collabStatusFilter}` : '';
        const [colR, infR, campR] = await Promise.all([
          api.get<LaravelPaginator<R>>(`influencer-collaborations?per_page=200${q}`),
          api.get<LaravelPaginator<R>>('influencers?per_page=200'),
          api.get<LaravelPaginator<{ id: number; name: string }>>('campaigns?per_page=200'),
        ]);
        if (colR.ok && isPaginator(colR.data)) setCollabs(colR.data.data);
        if (infR.ok && isPaginator(infR.data)) setInfluencers(infR.data.data);
        if (campR.ok && isPaginator(campR.data)) setCampaigns(campR.data.data);
      } else if (space === 'livrables') {
        const [delR, colR, pcR, infR] = await Promise.all([
          api.get<LaravelPaginator<R>>('influencer-deliverables?per_page=200'),
          api.get<LaravelPaginator<R>>('influencer-collaborations?per_page=200'),
          api.get<LaravelPaginator<R>>('influencer-published-contents?per_page=200'),
          api.get<LaravelPaginator<R>>('influencers?per_page=200'),
        ]);
        if (delR.ok && isPaginator(delR.data)) setDeliverables(delR.data.data);
        if (colR.ok && isPaginator(colR.data)) setCollabs(colR.data.data);
        if (pcR.ok && isPaginator(pcR.data)) setPublishedContents(pcR.data.data);
        if (infR.ok && isPaginator(infR.data)) setInfluencers(infR.data.data);
      } else if (space === 'envois') {
        const [shipR, infR, colR] = await Promise.all([
          api.get<LaravelPaginator<R>>('influencer-shipments?per_page=200'),
          api.get<LaravelPaginator<R>>('influencers?per_page=200'),
          api.get<LaravelPaginator<R>>('influencer-collaborations?per_page=200'),
        ]);
        if (shipR.ok && isPaginator(shipR.data)) setShipments(shipR.data.data);
        if (infR.ok && isPaginator(infR.data)) setInfluencers(infR.data.data);
        if (colR.ok && isPaginator(colR.data)) setCollabs(colR.data.data);
      } else if (space === 'paiements') {
        const [payR, infR, colR] = await Promise.all([
          api.get<LaravelPaginator<R>>('influencer-payments?per_page=200'),
          api.get<LaravelPaginator<R>>('influencers?per_page=200'),
          api.get<LaravelPaginator<R>>('influencer-collaborations?per_page=200'),
        ]);
        if (payR.ok && isPaginator(payR.data)) setPayments(payR.data.data);
        if (infR.ok && isPaginator(infR.data)) setInfluencers(infR.data.data);
        if (colR.ok && isPaginator(colR.data)) setCollabs(colR.data.data);
      } else if (space === 'documents') {
        const [docR, infR, colR] = await Promise.all([
          api.get<LaravelPaginator<R>>('influencer-documents?per_page=200'),
          api.get<LaravelPaginator<R>>('influencers?per_page=200'),
          api.get<LaravelPaginator<R>>('influencer-collaborations?per_page=200'),
        ]);
        if (docR.ok && isPaginator(docR.data)) setDocuments(docR.data.data);
        if (infR.ok && isPaginator(infR.data)) setInfluencers(infR.data.data);
        if (colR.ok && isPaginator(colR.data)) setCollabs(colR.data.data);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, space, infStatusFilter, collabStatusFilter, toast]);

  useEffect(() => { void load(); }, [load]);

  /* ──────────────────────── INFLUENCER CRUD ──────────────────────── */
  const [infOpen, setInfOpen] = useState(false);
  const [infId, setInfId] = useState<number | undefined>();
  const [infForm, setInfForm] = useState({
    full_name: '', username: '', platform: '', niche: '', bio: '', city: '',
    audience_size: '', engagement_rate: '',
    pricing_story: '', pricing_reel: '', pricing_post: '', pricing_video: '', pricing_live: '',
    contact_phone: '', contact_email: '', notes: '', source: '', status: 'reperee',
  });
  const [infSaving, setInfSaving] = useState(false);

  const openInf = (id?: number) => {
    setInfId(id);
    setInfForm({
      full_name: '', username: '', platform: '', niche: '', bio: '', city: '',
      audience_size: '', engagement_rate: '',
      pricing_story: '', pricing_reel: '', pricing_post: '', pricing_video: '', pricing_live: '',
      contact_phone: '', contact_email: '', notes: '', source: '', status: 'reperee',
    });
    if (id) void loadInf(id);
    setInfOpen(true);
  };

  const loadInf = async (id: number) => {
    const r = await api.get<R>(`influencers/${id}`);
    if (!r.ok) return errToast(toast, r);
    const d = r.data;
    const pj = (typeof d.pricing_json === 'object' && d.pricing_json) ? d.pricing_json as R : {};
    setInfForm({
      full_name: String(d.full_name ?? ''), username: String(d.username ?? ''),
      platform: String(d.platform ?? ''), niche: String(d.niche ?? ''),
      bio: String(d.bio ?? ''), city: String(d.city ?? ''),
      audience_size: d.audience_size != null ? String(d.audience_size) : '',
      engagement_rate: d.engagement_rate != null ? String(d.engagement_rate) : '',
      pricing_story: pj.story != null ? String(pj.story) : '',
      pricing_reel: pj.reel != null ? String(pj.reel) : '',
      pricing_post: pj.post != null ? String(pj.post) : '',
      pricing_video: pj.video != null ? String(pj.video) : '',
      pricing_live: pj.live != null ? String(pj.live) : '',
      contact_phone: String(d.contact_phone ?? ''), contact_email: String(d.contact_email ?? ''),
      notes: String(d.notes ?? ''), source: String(d.source ?? ''),
      status: String(d.status ?? 'reperee'),
    });
  };

  const saveInf = async () => {
    const pricing: Record<string, number> = {};
    if (infForm.pricing_story.trim()) pricing.story = Number(infForm.pricing_story);
    if (infForm.pricing_reel.trim()) pricing.reel = Number(infForm.pricing_reel);
    if (infForm.pricing_post.trim()) pricing.post = Number(infForm.pricing_post);
    if (infForm.pricing_video.trim()) pricing.video = Number(infForm.pricing_video);
    if (infForm.pricing_live.trim()) pricing.live = Number(infForm.pricing_live);
    const body: R = {
      full_name: infForm.full_name, username: infForm.username || null,
      platform: infForm.platform || null, niche: infForm.niche || null,
      bio: infForm.bio || null, city: infForm.city || null,
      audience_size: infForm.audience_size ? Number(infForm.audience_size) : null,
      engagement_rate: infForm.engagement_rate ? Number(infForm.engagement_rate) : null,
      pricing_json: Object.keys(pricing).length > 0 ? pricing : null,
      contact_phone: infForm.contact_phone || null, contact_email: infForm.contact_email || null,
      notes: infForm.notes || null, source: infForm.source || null,
      status: infForm.status,
    };
    setInfSaving(true);
    try {
      const r = infId ? await api.patch(`influencers/${infId}`, body) : await api.post('influencers', body);
      if (!r.ok) return errToast(toast, r);
      toast.success(infId ? 'Influenceuse mise à jour.' : 'Influenceuse créée.');
      setInfOpen(false);
      void load();
    } finally { setInfSaving(false); }
  };

  const deleteInf = async (id: number) => {
    const r = await api.del(`influencers/${id}`);
    if (!r.ok) return errToast(toast, r);
    toast.success('Influenceuse supprimée.');
    void load();
  };

  /* ── Qualification modal ── */
  const [qualOpen, setQualOpen] = useState(false);
  const [qualId, setQualId] = useState<number>(0);
  const [qualScores, setQualScores] = useState<Record<string, number>>({});
  const [qualSaving, setQualSaving] = useState(false);

  const openQualify = (id: number, existing?: R) => {
    setQualId(id);
    const scores: Record<string, number> = {};
    const qj = (existing?.qualification_json as R | undefined) ?? {};
    QUALIFICATION_DIMS.forEach(d => { scores[d.key] = Number(qj[d.key] ?? 3); });
    setQualScores(scores);
    setQualOpen(true);
  };

  const saveQualify = async () => {
    setQualSaving(true);
    try {
      const r = await api.post(`influencers/${qualId}/qualify`, { qualification_json: qualScores });
      if (!r.ok) return errToast(toast, r);
      toast.success('Qualification enregistrée.');
      setQualOpen(false);
      void load();
    } finally { setQualSaving(false); }
  };

  /* ── Exclude modal ── */
  const [exclOpen, setExclOpen] = useState(false);
  const [exclId, setExclId] = useState<number>(0);
  const [exclReason, setExclReason] = useState('');
  const [exclSaving, setExclSaving] = useState(false);

  const saveExclude = async () => {
    if (!exclReason.trim()) { toast.error('Motif requis.'); return; }
    setExclSaving(true);
    try {
      const r = await api.post(`influencers/${exclId}/exclude`, { exclusion_reason: exclReason });
      if (!r.ok) return errToast(toast, r);
      toast.success('Influenceuse exclue.');
      setExclOpen(false);
      void load();
    } finally { setExclSaving(false); }
  };

  /* ── Status change ── */
  const changeInfStatus = async (id: number, status: string) => {
    const r = await api.post(`influencers/${id}/status`, { status });
    if (!r.ok) return errToast(toast, r);
    toast.success('Statut mis à jour.');
    void load();
  };

  /* ──────────────────────── COLLABORATION CRUD ──────────────────────── */
  const [colOpen, setColOpen] = useState(false);
  const [colId, setColId] = useState<number | undefined>();
  const [colForm, setColForm] = useState({
    influencer_id: '', campaign_id: '', title: '', description: '', objectives: '',
    collaboration_type: 'post', deliverables: '', contract_url: '', brief_url: '',
    agreed_amount: '', currency: 'MAD', start_date: '', end_date: '',
  });
  const [colSaving, setColSaving] = useState(false);

  const openCollab = (id?: number) => {
    setColId(id);
    setColForm({
      influencer_id: '', campaign_id: '', title: '', description: '', objectives: '',
      collaboration_type: 'post', deliverables: '', contract_url: '', brief_url: '',
      agreed_amount: '', currency: 'MAD', start_date: '', end_date: '',
    });
    if (id) void loadCollab(id);
    setColOpen(true);
  };

  const loadCollab = async (id: number) => {
    const r = await api.get<R>(`influencer-collaborations/${id}`);
    if (!r.ok) return errToast(toast, r);
    const d = r.data;
    setColForm({
      influencer_id: d.influencer_id ? String(d.influencer_id) : '',
      campaign_id: d.campaign_id ? String(d.campaign_id) : '',
      title: String(d.title ?? ''), description: String(d.description ?? ''),
      objectives: String(d.objectives ?? ''),
      collaboration_type: String(d.collaboration_type ?? 'post'),
      deliverables: String(d.deliverables ?? ''),
      contract_url: String(d.contract_url ?? ''), brief_url: String(d.brief_url ?? ''),
      agreed_amount: d.agreed_amount != null ? String(d.agreed_amount) : '',
      currency: String(d.currency ?? 'MAD'),
      start_date: d.start_date ? String(d.start_date).slice(0, 10) : '',
      end_date: d.end_date ? String(d.end_date).slice(0, 10) : '',
    });
  };

  const saveCollab = async () => {
    const body: R = {
      influencer_id: Number(colForm.influencer_id),
      campaign_id: colForm.campaign_id ? Number(colForm.campaign_id) : null,
      title: colForm.title, description: colForm.description || null,
      objectives: colForm.objectives || null,
      collaboration_type: colForm.collaboration_type,
      deliverables: colForm.deliverables || null,
      contract_url: colForm.contract_url || null, brief_url: colForm.brief_url || null,
      agreed_amount: colForm.agreed_amount ? Number(colForm.agreed_amount) : 0,
      currency: colForm.currency || 'MAD',
      start_date: colForm.start_date || null, end_date: colForm.end_date || null,
    };
    setColSaving(true);
    try {
      const r = colId
        ? await api.patch(`influencer-collaborations/${colId}`, body)
        : await api.post('influencer-collaborations', body);
      if (!r.ok) return errToast(toast, r);
      toast.success(colId ? 'Collaboration mise à jour.' : 'Collaboration créée.');
      setColOpen(false);
      void load();
    } finally { setColSaving(false); }
  };

  const deleteCollab = async (id: number) => {
    const r = await api.del(`influencer-collaborations/${id}`);
    if (!r.ok) return errToast(toast, r);
    toast.success('Collaboration supprimée.');
    void load();
  };

  /* ── Collaboration validation ── */
  const requestValidation = async (id: number, vType: string) => {
    const r = await api.post(`influencer-collaborations/${id}/request-validation`, { validation_type: vType });
    if (!r.ok) return errToast(toast, r);
    toast.success(`Demande ${vType} envoyée.`);
    void load();
  };

  const [valOpen, setValOpen] = useState(false);
  const [valTarget, setValTarget] = useState<{ id: number; vType: string }>({ id: 0, vType: 'V1' });
  const [valDecision, setValDecision] = useState('approuve');
  const [valComment, setValComment] = useState('');
  const [valSaving, setValSaving] = useState(false);

  const openValidation = (id: number, vType: string) => {
    setValTarget({ id, vType });
    setValDecision('approuve');
    setValComment('');
    setValOpen(true);
  };

  const saveValidation = async () => {
    setValSaving(true);
    try {
      const r = await api.post(`influencer-collaborations/${valTarget.id}/decide-validation`, {
        validation_type: valTarget.vType, decision: valDecision, comment: valComment || null,
      });
      if (!r.ok) return errToast(toast, r);
      toast.success(`${valTarget.vType} : ${valDecision === 'approuve' ? 'Approuvé' : 'Refusé'}.`);
      setValOpen(false);
      void load();
    } finally { setValSaving(false); }
  };

  const changeCollabStatus = async (id: number, status: string, reason?: string) => {
    const body: R = { status };
    if (status === 'en_pause') body.pause_reason = reason || 'Mise en pause';
    if (status === 'arretee') body.stop_reason = reason || 'Arrêtée';
    const r = await api.post(`influencer-collaborations/${id}/status`, body);
    if (!r.ok) return errToast(toast, r);
    toast.success('Statut mis à jour.');
    void load();
  };

  /* ──────────────────────── DELIVERABLE CRUD ──────────────────────── */
  const [delOpen, setDelOpen] = useState(false);
  const [delId, setDelId] = useState<number | undefined>();
  const [delForm, setDelForm] = useState({
    collaboration_id: '', title: '', content_type: 'post', platform: '', quantity: '1',
    due_date: '', description: '', brief_notes: '', status: 'a_produire',
  });
  const [delSaving, setDelSaving] = useState(false);

  const openDel = (id?: number) => {
    setDelId(id);
    setDelForm({
      collaboration_id: '', title: '', content_type: 'post', platform: '', quantity: '1',
      due_date: '', description: '', brief_notes: '', status: 'a_produire',
    });
    if (id) void loadDel(id);
    setDelOpen(true);
  };

  const loadDel = async (id: number) => {
    const r = await api.get<R>(`influencer-deliverables/${id}`);
    if (!r.ok) return errToast(toast, r);
    const d = r.data;
    setDelForm({
      collaboration_id: d.collaboration_id ? String(d.collaboration_id) : '',
      title: String(d.title ?? ''), content_type: String(d.content_type ?? 'post'),
      platform: String(d.platform ?? ''), quantity: String(d.quantity ?? 1),
      due_date: d.due_date ? String(d.due_date).slice(0, 10) : '',
      description: String(d.description ?? ''), brief_notes: String(d.brief_notes ?? ''),
      status: String(d.status ?? 'a_produire'),
    });
  };

  const saveDel = async () => {
    const body: R = {
      collaboration_id: Number(delForm.collaboration_id), title: delForm.title,
      content_type: delForm.content_type, platform: delForm.platform || null,
      quantity: Number(delForm.quantity || 1), due_date: delForm.due_date || null,
      description: delForm.description || null, brief_notes: delForm.brief_notes || null,
      status: delForm.status,
    };
    setDelSaving(true);
    try {
      const r = delId
        ? await api.patch(`influencer-deliverables/${delId}`, body)
        : await api.post('influencer-deliverables', body);
      if (!r.ok) return errToast(toast, r);
      toast.success(delId ? 'Livrable mis à jour.' : 'Livrable créé.');
      setDelOpen(false);
      void load();
    } finally { setDelSaving(false); }
  };

  const deleteDel = async (id: number) => {
    const r = await api.del(`influencer-deliverables/${id}`);
    if (!r.ok) return errToast(toast, r);
    toast.success('Livrable supprimé.');
    void load();
  };

  /* ──────────────────────── SHIPMENT CRUD ──────────────────────── */
  const [shipOpen, setShipOpen] = useState(false);
  const [shipId, setShipId] = useState<number | undefined>();
  const [shipForm, setShipForm] = useState({
    collaboration_id: '', influencer_id: '', products: '',
    shipping_company: '', tracking_number: '', tracking_url: '',
    estimated_delivery: '', delivery_address: '', notes: '', status: 'a_preparer',
  });
  const [shipSaving, setShipSaving] = useState(false);

  const openShip = (id?: number) => {
    setShipId(id);
    setShipForm({
      collaboration_id: '', influencer_id: '', products: '',
      shipping_company: '', tracking_number: '', tracking_url: '',
      estimated_delivery: '', delivery_address: '', notes: '', status: 'a_preparer',
    });
    if (id) void loadShip(id);
    setShipOpen(true);
  };

  const loadShip = async (id: number) => {
    const r = await api.get<R>(`influencer-shipments/${id}`);
    if (!r.ok) return errToast(toast, r);
    const d = r.data;
    const pj = Array.isArray(d.products_json) ? d.products_json : [];
    setShipForm({
      collaboration_id: d.collaboration_id ? String(d.collaboration_id) : '',
      influencer_id: d.influencer_id ? String(d.influencer_id) : '',
      products: pj.map((p: R) => `${p.name} x${p.quantity}`).join(', '),
      shipping_company: String(d.shipping_company ?? ''),
      tracking_number: String(d.tracking_number ?? ''),
      tracking_url: String(d.tracking_url ?? ''),
      estimated_delivery: d.estimated_delivery ? String(d.estimated_delivery).slice(0, 10) : '',
      delivery_address: String(d.delivery_address ?? ''),
      notes: String(d.notes ?? ''), status: String(d.status ?? 'a_preparer'),
    });
  };

  const saveShip = async () => {
    const items = shipForm.products.split(',').map(s => s.trim()).filter(Boolean).map(s => {
      const match = s.match(/^(.+?)\s*x(\d+)$/);
      return match ? { name: match[1].trim(), quantity: Number(match[2]) } : { name: s, quantity: 1 };
    });
    if (!items.length) { toast.error('Ajoutez au moins un produit.'); return; }
    const body: R = {
      collaboration_id: Number(shipForm.collaboration_id),
      influencer_id: Number(shipForm.influencer_id),
      products_json: items,
      shipping_company: shipForm.shipping_company || null,
      tracking_number: shipForm.tracking_number || null,
      tracking_url: shipForm.tracking_url || null,
      estimated_delivery: shipForm.estimated_delivery || null,
      delivery_address: shipForm.delivery_address || null,
      notes: shipForm.notes || null, status: shipForm.status,
    };
    setShipSaving(true);
    try {
      const r = shipId
        ? await api.patch(`influencer-shipments/${shipId}`, body)
        : await api.post('influencer-shipments', body);
      if (!r.ok) return errToast(toast, r);
      toast.success(shipId ? 'Envoi mis à jour.' : 'Envoi créé.');
      setShipOpen(false);
      void load();
    } finally { setShipSaving(false); }
  };

  const deleteShip = async (id: number) => {
    const r = await api.del(`influencer-shipments/${id}`);
    if (!r.ok) return errToast(toast, r);
    toast.success('Envoi supprimé.');
    void load();
  };

  /* ──────────────────────── PAYMENT CRUD ──────────────────────── */
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<number | undefined>();
  const [payForm, setPayForm] = useState({
    collaboration_id: '', influencer_id: '', nature: 'remuneration',
    amount: '', currency: 'MAD', payment_method: '', description: '',
    period_start: '', period_end: '', due_date: '', notes: '',
  });
  const [paySaving, setPaySaving] = useState(false);

  const openPay = (id?: number) => {
    setPayId(id);
    setPayForm({
      collaboration_id: '', influencer_id: '', nature: 'remuneration',
      amount: '', currency: 'MAD', payment_method: '', description: '',
      period_start: '', period_end: '', due_date: '', notes: '',
    });
    if (id) void loadPay(id);
    setPayOpen(true);
  };

  const loadPay = async (id: number) => {
    const r = await api.get<R>(`influencer-payments/${id}`);
    if (!r.ok) return errToast(toast, r);
    const d = r.data;
    setPayForm({
      collaboration_id: d.collaboration_id ? String(d.collaboration_id) : '',
      influencer_id: d.influencer_id ? String(d.influencer_id) : '',
      nature: String(d.nature ?? 'remuneration'),
      amount: d.amount != null ? String(d.amount) : '',
      currency: String(d.currency ?? 'MAD'),
      payment_method: String(d.payment_method ?? ''),
      description: String(d.description ?? ''),
      period_start: d.period_start ? String(d.period_start).slice(0, 10) : '',
      period_end: d.period_end ? String(d.period_end).slice(0, 10) : '',
      due_date: d.due_date ? String(d.due_date).slice(0, 10) : '',
      notes: String(d.notes ?? ''),
    });
  };

  const savePay = async () => {
    const body: R = {
      collaboration_id: Number(payForm.collaboration_id),
      influencer_id: Number(payForm.influencer_id),
      nature: payForm.nature, amount: Number(payForm.amount || 0),
      currency: payForm.currency || 'MAD',
      payment_method: payForm.payment_method || null,
      description: payForm.description || null,
      period_start: payForm.period_start || null, period_end: payForm.period_end || null,
      due_date: payForm.due_date || null, notes: payForm.notes || null,
    };
    setPaySaving(true);
    try {
      const r = payId
        ? await api.patch(`influencer-payments/${payId}`, body)
        : await api.post('influencer-payments', body);
      if (!r.ok) return errToast(toast, r);
      toast.success(payId ? 'Paiement mis à jour.' : 'Paiement créé.');
      setPayOpen(false);
      void load();
    } finally { setPaySaving(false); }
  };

  const submitPayValidation = async (id: number) => {
    const r = await api.post(`influencer-payments/${id}/submit-validation`, {});
    if (!r.ok) return errToast(toast, r);
    toast.success('Soumis pour validation N1.');
    void load();
  };

  const validatePayN1 = async (id: number, decision: string, comment?: string) => {
    const r = await api.post(`influencer-payments/${id}/validate-n1`, { decision, comment: comment || null });
    if (!r.ok) return errToast(toast, r);
    toast.success(`N1 : ${decision === 'approuve' ? 'Approuvé' : 'Refusé'}.`);
    void load();
  };

  const validatePayN2 = async (id: number, decision: string, comment?: string) => {
    const r = await api.post(`influencer-payments/${id}/validate-n2`, { decision, comment: comment || null });
    if (!r.ok) return errToast(toast, r);
    toast.success(`N2 : ${decision === 'approuve' ? 'Approuvé' : 'Refusé'}.`);
    void load();
  };

  const markPayPaid = async (id: number) => {
    const r = await api.post(`influencer-payments/${id}/mark-paid`, {});
    if (!r.ok) return errToast(toast, r);
    toast.success('Paiement marqué payé.');
    void load();
  };

  const deletePay = async (id: number) => {
    const r = await api.del(`influencer-payments/${id}`);
    if (!r.ok) return errToast(toast, r);
    toast.success('Paiement supprimé.');
    void load();
  };

  /* ──────────────────────── PUBLISHED CONTENT CRUD ──────────────────────── */
  const [pcOpen, setPcOpen] = useState(false);
  const [pcId, setPcId] = useState<number | undefined>();
  const [pcForm, setPcForm] = useState({
    deliverable_id: '', collaboration_id: '', influencer_id: '',
    content_type: 'post', platform: '', content_url: '', screenshot_url: '',
    published_at: '', quantity: '1', notes: '',
    views: '', reach: '', impressions: '', likes: '', comments_count: '', shares: '', saves: '', clicks: '',
  });
  const [pcSaving, setPcSaving] = useState(false);

  const openPc = (id?: number) => {
    setPcId(id);
    setPcForm({
      deliverable_id: '', collaboration_id: '', influencer_id: '',
      content_type: 'post', platform: '', content_url: '', screenshot_url: '',
      published_at: '', quantity: '1', notes: '',
      views: '', reach: '', impressions: '', likes: '', comments_count: '', shares: '', saves: '', clicks: '',
    });
    if (id) void loadPc(id);
    setPcOpen(true);
  };

  const loadPc = async (id: number) => {
    const r = await api.get<R>(`influencer-published-contents/${id}`);
    if (!r.ok) return errToast(toast, r);
    const d = r.data;
    setPcForm({
      deliverable_id: d.deliverable_id ? String(d.deliverable_id) : '',
      collaboration_id: d.collaboration_id ? String(d.collaboration_id) : '',
      influencer_id: d.influencer_id ? String(d.influencer_id) : '',
      content_type: String(d.content_type ?? 'post'), platform: String(d.platform ?? ''),
      content_url: String(d.content_url ?? ''), screenshot_url: String(d.screenshot_url ?? ''),
      published_at: d.published_at ? String(d.published_at).slice(0, 10) : '',
      quantity: String(d.quantity ?? 1), notes: String(d.notes ?? ''),
      views: d.views != null ? String(d.views) : '',
      reach: d.reach != null ? String(d.reach) : '',
      impressions: d.impressions != null ? String(d.impressions) : '',
      likes: d.likes != null ? String(d.likes) : '',
      comments_count: d.comments_count != null ? String(d.comments_count) : '',
      shares: d.shares != null ? String(d.shares) : '',
      saves: d.saves != null ? String(d.saves) : '',
      clicks: d.clicks != null ? String(d.clicks) : '',
    });
  };

  const savePc = async () => {
    const body: R = {
      deliverable_id: Number(pcForm.deliverable_id),
      collaboration_id: Number(pcForm.collaboration_id),
      influencer_id: Number(pcForm.influencer_id),
      content_type: pcForm.content_type, platform: pcForm.platform || null,
      content_url: pcForm.content_url || null, screenshot_url: pcForm.screenshot_url || null,
      published_at: pcForm.published_at || null, quantity: Number(pcForm.quantity || 1),
      notes: pcForm.notes || null,
      views: pcForm.views ? Number(pcForm.views) : null,
      reach: pcForm.reach ? Number(pcForm.reach) : null,
      impressions: pcForm.impressions ? Number(pcForm.impressions) : null,
      likes: pcForm.likes ? Number(pcForm.likes) : null,
      comments_count: pcForm.comments_count ? Number(pcForm.comments_count) : null,
      shares: pcForm.shares ? Number(pcForm.shares) : null,
      saves: pcForm.saves ? Number(pcForm.saves) : null,
      clicks: pcForm.clicks ? Number(pcForm.clicks) : null,
    };
    setPcSaving(true);
    try {
      const r = pcId
        ? await api.patch(`influencer-published-contents/${pcId}`, body)
        : await api.post('influencer-published-contents', body);
      if (!r.ok) return errToast(toast, r);
      toast.success(pcId ? 'Contenu mis à jour.' : 'Contenu enregistré.');
      setPcOpen(false);
      void load();
    } finally { setPcSaving(false); }
  };

  const deletePc = async (id: number) => {
    const r = await api.del(`influencer-published-contents/${id}`);
    if (!r.ok) return errToast(toast, r);
    toast.success('Contenu supprimé.');
    void load();
  };

  /* ──────────────────────── DOCUMENT CRUD ──────────────────────── */
  const [docOpen, setDocOpen] = useState(false);
  const [docId, setDocId] = useState<number | undefined>();
  const [docForm, setDocForm] = useState({
    influencer_id: '', collaboration_id: '', title: '',
    document_type: 'autre', file_url: '', notes: '',
  });
  const [docSaving, setDocSaving] = useState(false);

  const openDoc = (id?: number) => {
    setDocId(id);
    setDocForm({
      influencer_id: '', collaboration_id: '', title: '',
      document_type: 'autre', file_url: '', notes: '',
    });
    if (id) void loadDoc(id);
    setDocOpen(true);
  };

  const loadDoc = async (id: number) => {
    const r = await api.get<R>(`influencer-documents/${id}`);
    if (!r.ok) return errToast(toast, r);
    const d = r.data;
    setDocForm({
      influencer_id: d.influencer_id ? String(d.influencer_id) : '',
      collaboration_id: d.collaboration_id ? String(d.collaboration_id) : '',
      title: String(d.title ?? ''),
      document_type: String(d.document_type ?? 'autre'),
      file_url: String(d.file_url ?? ''), notes: String(d.notes ?? ''),
    });
  };

  const saveDoc = async () => {
    const body: R = {
      influencer_id: Number(docForm.influencer_id),
      collaboration_id: docForm.collaboration_id ? Number(docForm.collaboration_id) : null,
      title: docForm.title, document_type: docForm.document_type,
      file_url: docForm.file_url, notes: docForm.notes || null,
    };
    setDocSaving(true);
    try {
      const r = docId
        ? await api.patch(`influencer-documents/${docId}`, body)
        : await api.post('influencer-documents', body);
      if (!r.ok) return errToast(toast, r);
      toast.success(docId ? 'Document mis à jour.' : 'Document ajouté.');
      setDocOpen(false);
      void load();
    } finally { setDocSaving(false); }
  };

  const deleteDoc = async (id: number) => {
    const r = await api.del(`influencer-documents/${id}`);
    if (!r.ok) return errToast(toast, r);
    toast.success('Document supprimé.');
    void load();
  };

  /* ──────────────────────── Guard ──────────────────────── */
  if (!activeBrandId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Influence" subtitle="Choisissez une marque active." />
        <EmptyState title="Marque requise" description="Sélectionnez une marque dans l'en-tête." />
      </div>
    );
  }

  const canManage = hasPermission('influence.manage');
  const canCreateInf = hasPermission('influence.create');
  const canEditInf = hasPermission('influence.update');
  const canDeleteInf = hasPermission('influence.delete');
  const canCollab = hasPermission('influencer_collaborations.create');
  const canEditCollab = hasPermission('influencer_collaborations.update');
  const canValidateCollab = hasPermission('influencer_collaborations.validate');
  const canDel = hasPermission('influencer_deliverables.create');
  const canShip = hasPermission('influencer_shipments.create');
  const canPay = hasPermission('influencer_payments.create');
  const canValidatePay = hasPermission('influencer_payments.validate');
  const canDoc = hasPermission('influencer_documents.create');

  /* ──────────────────────── TABS ──────────────────────── */
  const spaces: { key: Space; label: string; icon: React.ReactNode }[] = [
    { key: 'pilotage', label: 'Pilotage', icon: <BarChart3 size={16} /> },
    { key: 'influenceuses', label: 'Influenceuses', icon: <Sparkles size={16} /> },
    { key: 'collaborations', label: 'Collaborations', icon: <Handshake size={16} /> },
    { key: 'livrables', label: 'Livrables & Contenus', icon: <ClipboardList size={16} /> },
    { key: 'envois', label: 'Envois produits', icon: <Truck size={16} /> },
    { key: 'paiements', label: 'Paiements', icon: <DollarSign size={16} /> },
    { key: 'documents', label: 'Documents', icon: <FileText size={16} /> },
  ];

  /* ──────────────────────── DASHBOARD STATS ──────────────────────── */
  const dashStats = useMemo(() => {
    if (!dash) return null;
    const infByStatus = (s: string) => influencers.filter(i => String(i.status) === s).length;
    return {
      totalInf: Number(dash.total_influencers ?? influencers.length),
      activeCollabs: Number(dash.active_collaborations ?? dash.active_collabs ?? 0),
      totalSpend: Number(dash.influencer_spend_period ?? dash.total_spend ?? 0),
      totalRevenue: Number(dash.revenue_attributed ?? dash.total_revenue ?? 0),
      avgRoi: Number(dash.avg_roi_percent ?? dash.avg_roi ?? 0),
      openComplaints: Number(dash.open_complaints ?? 0),
      byPlatform: (dash.influencers_by_platform ?? {}) as Record<string, number>,
      pipeline: {
        reperee: infByStatus('reperee'),
        qualifiee: infByStatus('qualifiee'),
        contactee: infByStatus('contactee'),
        en_discussion: infByStatus('en_discussion'),
        en_negociation: infByStatus('en_negociation'),
        active: infByStatus('active'),
      },
    };
  }, [dash, influencers]);

  /* ═══════════════════════════ RENDER ═══════════════════════════ */
  return (
    <div className="space-y-6">
      <PageHeader
        title="Studio Influence"
        subtitle="Gestion complète des influenceuses, collaborations, livrables, envois et paiements."
        right={
          <button type="button" onClick={() => void load()} disabled={loading}
            className="flex items-center gap-1 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        }
      />

      {/* ── Space tabs ── */}
      <div className="flex flex-wrap gap-1 rounded-2xl bg-zinc-50 p-1">
        {spaces.map(s => (
          <button key={s.key} type="button" onClick={() => setSpace(s.key)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              space === s.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-sm text-zinc-400">Chargement…</div>}

      {/* ═══════ PILOTAGE ═══════ */}
      {space === 'pilotage' && dashStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Influenceuses" value={fmtNum(dashStats.totalInf)} />
            <StatCard label="Collaborations actives" value={fmtNum(dashStats.activeCollabs)} />
            <StatCard label="Budget dépensé" value={formatCurrency(dashStats.totalSpend)} />
            <StatCard label="Revenu généré" value={formatCurrency(dashStats.totalRevenue)} />
            <StatCard label="ROI moyen" value={fmtPct(dashStats.avgRoi)} />
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-5">
            <h3 className="mb-3 text-sm font-bold text-zinc-700">Pipeline influenceuses</h3>
            <div className="flex flex-wrap gap-3">
              {(['reperee', 'qualifiee', 'contactee', 'en_discussion', 'en_negociation', 'active'] as const).map(s => (
                <div key={s} className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
                  <StatusBadge value={s} labels={INFLUENCER_STATUS_LABELS} />
                  <span className="text-lg font-black text-zinc-900">{dashStats.pipeline[s]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {dash?.top_influencers && Array.isArray(dash.top_influencers) && (dash.top_influencers as R[]).length > 0 && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-5">
                <h3 className="mb-3 text-sm font-bold text-zinc-700">Top influenceuses par revenu</h3>
                <div className="space-y-2">
                  {(dash.top_influencers as R[]).slice(0, 5).map((row, i) => {
                    const inf = (row.influencer as R | undefined) ?? row;
                    return (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
                        <span className="text-sm font-semibold text-zinc-700">{String(inf.full_name ?? inf.username ?? '—')}</span>
                        <span className="text-sm font-bold text-green-700">{formatCurrency(Number(row.total_rev ?? row.total_revenue ?? 0))}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {Object.keys(dashStats.byPlatform).length > 0 && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-5">
                <h3 className="mb-3 text-sm font-bold text-zinc-700">Répartition par plateforme</h3>
                <div className="space-y-2">
                  {Object.entries(dashStats.byPlatform).sort((a, b) => Number(b[1]) - Number(a[1])).map(([platform, count]) => (
                    <div key={platform} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2">
                      <span className="text-sm font-semibold text-zinc-700 capitalize">{platform}</span>
                      <span className="text-sm font-bold text-zinc-900">{fmtNum(count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {dashStats.openComplaints > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">{dashStats.openComplaints} réclamation(s) ouverte(s)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ INFLUENCEUSES ═══════ */}
      {space === 'influenceuses' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={infStatusFilter} onChange={e => setInfStatusFilter(e.target.value)} className={selClass} style={{ width: 200 }}>
              <option value="">Tous les statuts</option>
              {INF_STATUSES.map(s => <option key={s} value={s}>{INFLUENCER_STATUS_LABELS[s]}</option>)}
            </select>
            {canCreateInf && (
              <button type="button" onClick={() => openInf()} className="flex items-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                <Plus size={14} /> Nouvelle influenceuse
              </button>
            )}
          </div>

          {influencers.length === 0 && !loading ? (
            <EmptyState title="Aucune influenceuse" description="Ajoutez votre première influenceuse." />
          ) : (
            <DataTable
              columns={[
                { header: 'Nom', accessor: (r: R) => (
                  <div>
                    <div className="font-semibold text-zinc-900">{String(r.full_name ?? '—')}</div>
                    {r.username && <div className="text-xs text-zinc-500">@{String(r.username)}</div>}
                  </div>
                )},
                { header: 'Plateforme', accessor: (r: R) => String(r.platform ?? '—') },
                { header: 'Niche', accessor: (r: R) => String(r.niche ?? '—') },
                { header: 'Audience', accessor: (r: R) => fmtNum(r.audience_size) },
                { header: 'Engagement', accessor: (r: R) => r.engagement_rate != null ? fmtPct(r.engagement_rate) : '—' },
                { header: 'Score Q.', accessor: (r: R) => r.qualification_score != null ? `${Number(r.qualification_score).toFixed(1)}/5` : '—' },
                { header: 'Statut', accessor: (r: R) => <StatusBadge value={String(r.status ?? '')} labels={INFLUENCER_STATUS_LABELS} /> },
                { header: 'Actions', accessor: (r: R) => {
                  const id = Number(r.id);
                  const st = String(r.status);
                  return (
                    <div className="flex items-center gap-1">
                      {canEditInf && <button type="button" onClick={() => openInf(id)} className="p-1 text-zinc-500 hover:text-zinc-900"><Pencil size={14} /></button>}
                      {canManage && st !== 'exclue' && (
                        <button type="button" onClick={() => openQualify(id, r)} className="p-1 text-indigo-500 hover:text-indigo-700" title="Qualifier"><Star size={14} /></button>
                      )}
                      {canManage && !['active', 'exclue'].includes(st) && (
                        <button type="button" onClick={() => changeInfStatus(id, 'active')} className="p-1 text-green-500 hover:text-green-700" title="Activer"><UserCheck size={14} /></button>
                      )}
                      {canManage && st !== 'exclue' && (
                        <button type="button" onClick={() => { setExclId(id); setExclReason(''); setExclOpen(true); }} className="p-1 text-red-500 hover:text-red-700" title="Exclure"><UserX size={14} /></button>
                      )}
                      {canDeleteInf && <button type="button" onClick={() => deleteInf(id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
                    </div>
                  );
                }},
              ]}
              data={influencers}
            />
          )}
        </div>
      )}

      {/* ═══════ COLLABORATIONS ═══════ */}
      {space === 'collaborations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={collabStatusFilter} onChange={e => setCollabStatusFilter(e.target.value)} className={selClass} style={{ width: 240 }}>
              <option value="">Tous les statuts</option>
              {COLLAB_STATUSES.map(s => <option key={s} value={s}>{COLLAB_STATUS_LABELS[s]}</option>)}
            </select>
            {canCollab && (
              <button type="button" onClick={() => openCollab()} className="flex items-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                <Plus size={14} /> Nouvelle collaboration
              </button>
            )}
          </div>

          {collabs.length === 0 && !loading ? (
            <EmptyState title="Aucune collaboration" description="Créez votre première collaboration." />
          ) : (
            <DataTable
              columns={[
                { header: 'Titre', accessor: (r: R) => (
                  <div>
                    <div className="font-semibold text-zinc-900">{String(r.title ?? '—')}</div>
                    <div className="text-xs text-zinc-500">{infLabel(r)}</div>
                  </div>
                )},
                { header: 'Type', accessor: (r: R) => statusLabelFr(String(r.collaboration_type ?? ''), COLLAB_TYPE_LABELS) },
                { header: 'Montant', accessor: (r: R) => formatCurrency(Number(r.agreed_amount ?? 0)) },
                { header: 'Période', accessor: (r: R) => {
                  const s = r.start_date ? String(r.start_date).slice(0, 10) : '—';
                  const e = r.end_date ? String(r.end_date).slice(0, 10) : '—';
                  return `${s} → ${e}`;
                }},
                { header: 'Statut', accessor: (r: R) => <StatusBadge value={String(r.status ?? '')} labels={COLLAB_STATUS_LABELS} /> },
                { header: 'Validation', accessor: (r: R) => {
                  const v1 = r.v1_status ? String(r.v1_status) : null;
                  const v2 = r.v2_status ? String(r.v2_status) : null;
                  return (
                    <div className="flex gap-1">
                      {v1 && <Badge color={v1 === 'approuve' ? 'bg-green-50 text-green-700' : v1 === 'refuse' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}>V1:{v1 === 'approuve' ? '✓' : v1 === 'refuse' ? '✗' : '…'}</Badge>}
                      {v2 && <Badge color={v2 === 'approuve' ? 'bg-green-50 text-green-700' : v2 === 'refuse' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}>V2:{v2 === 'approuve' ? '✓' : v2 === 'refuse' ? '✗' : '…'}</Badge>}
                    </div>
                  );
                }},
                { header: 'Actions', accessor: (r: R) => {
                  const id = Number(r.id);
                  const st = String(r.status);
                  return (
                    <div className="flex items-center gap-1">
                      {canEditCollab && <button type="button" onClick={() => openCollab(id)} className="p-1 text-zinc-500 hover:text-zinc-900"><Pencil size={14} /></button>}
                      {canEditCollab && st === 'brouillon' && (
                        <button type="button" onClick={() => requestValidation(id, 'V1')} className="p-1 text-amber-500 hover:text-amber-700" title="Demander V1"><Send size={14} /></button>
                      )}
                      {canValidateCollab && st === 'en_attente_validation' && (
                        <button type="button" onClick={() => openValidation(id, 'V1')} className="p-1 text-green-500 hover:text-green-700" title="Décider V1"><ShieldCheck size={14} /></button>
                      )}
                      {canEditCollab && st === 'en_revue' && (
                        <button type="button" onClick={() => requestValidation(id, 'V2')} className="p-1 text-orange-500 hover:text-orange-700" title="Demander V2"><Send size={14} /></button>
                      )}
                      {canValidateCollab && st === 'contractualisation_en_attente' && (
                        <button type="button" onClick={() => openValidation(id, 'V2')} className="p-1 text-green-500 hover:text-green-700" title="Décider V2"><ShieldCheck size={14} /></button>
                      )}
                      {canEditCollab && ['en_cours', 'en_preparation'].includes(st) && (
                        <button type="button" onClick={() => changeCollabStatus(id, 'en_pause')} className="p-1 text-amber-500 hover:text-amber-700" title="Pause"><Pause size={14} /></button>
                      )}
                      {canEditCollab && st === 'en_pause' && (
                        <button type="button" onClick={() => changeCollabStatus(id, 'en_cours')} className="p-1 text-cyan-500 hover:text-cyan-700" title="Reprendre"><RefreshCw size={14} /></button>
                      )}
                      {canEditCollab && (
                        <button type="button" onClick={() => { setColId(id); void api.post(`influencer-collaborations/${id}/submit-review`, { review_notes: 'Revue soumise', review_rating: 4 }).then(() => { toast.success('Revue soumise.'); void load(); }); }} className="p-1 text-purple-500 hover:text-purple-700" title="Soumettre revue" style={{ display: ['en_cours', 'contractualisee'].includes(st) ? 'block' : 'none' }}><Eye size={14} /></button>
                      )}
                      {canEditCollab && <button type="button" onClick={() => deleteCollab(id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
                    </div>
                  );
                }},
              ]}
              data={collabs}
            />
          )}
        </div>
      )}

      {/* ═══════ LIVRABLES & CONTENUS ═══════ */}
      {space === 'livrables' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {canDel && (
              <button type="button" onClick={() => openDel()} className="flex items-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                <Plus size={14} /> Nouveau livrable
              </button>
            )}
          </div>

          {deliverables.length === 0 && !loading ? (
            <EmptyState title="Aucun livrable" description="Créez des livrables pour vos collaborations." />
          ) : (
            <DataTable
              columns={[
                { header: 'Titre', accessor: (r: R) => (
                  <div>
                    <div className="font-semibold text-zinc-900">{String(r.title ?? '—')}</div>
                    <div className="text-xs text-zinc-500">{collabLabel(r)}</div>
                  </div>
                )},
                { header: 'Type', accessor: (r: R) => String(r.content_type ?? '—') },
                { header: 'Plateforme', accessor: (r: R) => String(r.platform ?? '—') },
                { header: 'Qté', accessor: (r: R) => String(r.quantity ?? 1) },
                { header: 'Échéance', accessor: (r: R) => r.due_date ? String(r.due_date).slice(0, 10) : '—' },
                { header: 'Statut', accessor: (r: R) => <StatusBadge value={String(r.status ?? '')} labels={DELIVERABLE_STATUS_LABELS} /> },
                { header: 'Actions', accessor: (r: R) => (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => openDel(Number(r.id))} className="p-1 text-zinc-500 hover:text-zinc-900"><Pencil size={14} /></button>
                    <button type="button" onClick={() => deleteDel(Number(r.id))} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                )},
              ]}
              data={deliverables}
            />
          )}

          {/* ── Contenus publiés ── */}
          <div className="mt-8 border-t pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-zinc-700">Contenus publiés & Métriques</h3>
              {canDel && (
                <button type="button" onClick={() => openPc()} className="flex items-center gap-1 rounded-xl bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700">
                  <Plus size={12} /> Enregistrer un contenu
                </button>
              )}
            </div>

            {publishedContents.length === 0 && !loading ? (
              <EmptyState title="Aucun contenu publié" description="Enregistrez les contenus publiés avec leurs métriques de performance." />
            ) : (
              <DataTable
                columns={[
                  { header: 'Influenceuse', accessor: (r: R) => infLabel(r) },
                  { header: 'Type', accessor: (r: R) => String(r.content_type ?? '—') },
                  { header: 'Plateforme', accessor: (r: R) => String(r.platform ?? '—') },
                  { header: 'Publié le', accessor: (r: R) => r.published_at ? String(r.published_at).slice(0, 10) : '—' },
                  { header: 'Vues', accessor: (r: R) => r.views != null ? fmtNum(r.views) : '—' },
                  { header: 'Portée', accessor: (r: R) => r.reach != null ? fmtNum(r.reach) : '—' },
                  { header: 'Likes', accessor: (r: R) => r.likes != null ? fmtNum(r.likes) : '—' },
                  { header: 'Clics', accessor: (r: R) => r.clicks != null ? fmtNum(r.clicks) : '—' },
                  { header: 'Actions', accessor: (r: R) => (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openPc(Number(r.id))} className="p-1 text-zinc-500 hover:text-zinc-900"><Pencil size={14} /></button>
                      <button type="button" onClick={() => deletePc(Number(r.id))} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  )},
                ]}
                data={publishedContents}
              />
            )}
          </div>
        </div>
      )}

      {/* ═══════ ENVOIS PRODUITS ═══════ */}
      {space === 'envois' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {canShip && (
              <button type="button" onClick={() => openShip()} className="flex items-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                <Plus size={14} /> Nouvel envoi
              </button>
            )}
          </div>

          {shipments.length === 0 && !loading ? (
            <EmptyState title="Aucun envoi" description="Gérez les envois de produits aux influenceuses." />
          ) : (
            <DataTable
              columns={[
                { header: 'Réf.', accessor: (r: R) => String(r.reference ?? '—') },
                { header: 'Influenceuse', accessor: (r: R) => infLabel(r) },
                { header: 'Collaboration', accessor: (r: R) => collabLabel(r) },
                { header: 'Produits', accessor: (r: R) => {
                  const pj = Array.isArray(r.products_json) ? r.products_json : [];
                  return pj.map((p: R) => `${p.name} x${p.quantity}`).join(', ') || '—';
                }},
                { header: 'Transporteur', accessor: (r: R) => String(r.shipping_company ?? '—') },
                { header: 'Statut', accessor: (r: R) => <StatusBadge value={String(r.status ?? '')} labels={SHIPMENT_STATUS_LABELS} /> },
                { header: 'Actions', accessor: (r: R) => (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => openShip(Number(r.id))} className="p-1 text-zinc-500 hover:text-zinc-900"><Pencil size={14} /></button>
                    <button type="button" onClick={() => deleteShip(Number(r.id))} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                )},
              ]}
              data={shipments}
            />
          )}
        </div>
      )}

      {/* ═══════ PAIEMENTS & COMMISSIONS ═══════ */}
      {space === 'paiements' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {canPay && (
              <button type="button" onClick={() => openPay()} className="flex items-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                <Plus size={14} /> Nouveau paiement
              </button>
            )}
          </div>

          {payments.length === 0 && !loading ? (
            <EmptyState title="Aucun paiement" description="Gérez les rémunérations, bonus et commissions." />
          ) : (
            <DataTable
              columns={[
                { header: 'Réf.', accessor: (r: R) => String(r.reference ?? '—') },
                { header: 'Influenceuse', accessor: (r: R) => infLabel(r) },
                { header: 'Nature', accessor: (r: R) => statusLabelFr(String(r.nature ?? ''), PAYMENT_NATURE_LABELS) },
                { header: 'Montant', accessor: (r: R) => `${formatCurrency(Number(r.amount ?? 0))} ${String(r.currency ?? 'MAD')}` },
                { header: 'Échéance', accessor: (r: R) => r.due_date ? String(r.due_date).slice(0, 10) : '—' },
                { header: 'Statut', accessor: (r: R) => <StatusBadge value={String(r.status ?? '')} labels={PAYMENT_STATUS_LABELS} /> },
                { header: 'Actions', accessor: (r: R) => {
                  const id = Number(r.id);
                  const st = String(r.status);
                  return (
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => openPay(id)} className="p-1 text-zinc-500 hover:text-zinc-900"><Pencil size={14} /></button>
                      {['brouillon', 'rejete'].includes(st) && (
                        <button type="button" onClick={() => submitPayValidation(id)} className="p-1 text-amber-500 hover:text-amber-700" title="Soumettre validation"><Send size={14} /></button>
                      )}
                      {canValidatePay && st === 'en_attente_validation_n1' && (
                        <button type="button" onClick={() => validatePayN1(id, 'approuve')} className="p-1 text-green-500 hover:text-green-700" title="Approuver N1"><CheckCircle2 size={14} /></button>
                      )}
                      {canValidatePay && st === 'en_attente_validation_n1' && (
                        <button type="button" onClick={() => validatePayN1(id, 'refuse')} className="p-1 text-red-500 hover:text-red-700" title="Refuser N1"><XCircle size={14} /></button>
                      )}
                      {canValidatePay && st === 'en_attente_validation_n2' && (
                        <button type="button" onClick={() => validatePayN2(id, 'approuve')} className="p-1 text-green-500 hover:text-green-700" title="Approuver N2"><CheckCircle2 size={14} /></button>
                      )}
                      {canValidatePay && st === 'en_attente_validation_n2' && (
                        <button type="button" onClick={() => validatePayN2(id, 'refuse')} className="p-1 text-red-500 hover:text-red-700" title="Refuser N2"><XCircle size={14} /></button>
                      )}
                      {st === 'valide_n2' && (
                        <button type="button" onClick={() => markPayPaid(id)} className="p-1 text-emerald-500 hover:text-emerald-700" title="Marquer payé"><DollarSign size={14} /></button>
                      )}
                      {['brouillon', 'rejete'].includes(st) && (
                        <button type="button" onClick={() => deletePay(id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                      )}
                    </div>
                  );
                }},
              ]}
              data={payments}
            />
          )}
        </div>
      )}

      {/* ═══════ DOCUMENTS ═══════ */}
      {space === 'documents' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {canDoc && (
              <button type="button" onClick={() => openDoc()} className="flex items-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
                <Plus size={14} /> Nouveau document
              </button>
            )}
          </div>

          {documents.length === 0 && !loading ? (
            <EmptyState title="Aucun document" description="Ajoutez contrats, briefs, factures et autres documents." />
          ) : (
            <DataTable
              columns={[
                { header: 'Titre', accessor: (r: R) => String(r.title ?? '—') },
                { header: 'Type', accessor: (r: R) => statusLabelFr(String(r.document_type ?? ''), DOCUMENT_TYPE_LABELS) },
                { header: 'Influenceuse', accessor: (r: R) => infLabel(r) },
                { header: 'Collaboration', accessor: (r: R) => r.collaboration_id ? collabLabel(r) : '—' },
                { header: 'Ajouté par', accessor: (r: R) => {
                  const u = r.uploaded_by_user as R | undefined;
                  return u ? String(u.name ?? '—') : '—';
                }},
                { header: 'Fichier', accessor: (r: R) => r.file_url ? (
                  <a href={String(r.file_url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Voir</a>
                ) : '—' },
                { header: 'Actions', accessor: (r: R) => (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => openDoc(Number(r.id))} className="p-1 text-zinc-500 hover:text-zinc-900"><Pencil size={14} /></button>
                    <button type="button" onClick={() => deleteDoc(Number(r.id))} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                )},
              ]}
              data={documents}
            />
          )}
        </div>
      )}

      {/* ═══════ MODALS ═══════ */}

      {/* Influencer modal */}
      <Modal open={infOpen} onClose={() => setInfOpen(false)} title={infId ? 'Modifier influenceuse' : 'Nouvelle influenceuse'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet *">
            <input className={inputClass} value={infForm.full_name} onChange={e => setInfForm(p => ({ ...p, full_name: e.target.value }))} />
          </Field>
          <Field label="Username">
            <input className={inputClass} value={infForm.username} onChange={e => setInfForm(p => ({ ...p, username: e.target.value }))} placeholder="@handle" />
          </Field>
          <Field label="Plateforme">
            <select className={selClass} value={infForm.platform} onChange={e => setInfForm(p => ({ ...p, platform: e.target.value }))}>
              <option value="">—</option>
              {PLATFORMS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </Field>
          <Field label="Niche">
            <input className={inputClass} value={infForm.niche} onChange={e => setInfForm(p => ({ ...p, niche: e.target.value }))} />
          </Field>
          <Field label="Ville">
            <input className={inputClass} value={infForm.city} onChange={e => setInfForm(p => ({ ...p, city: e.target.value }))} />
          </Field>
          <Field label="Source">
            <input className={inputClass} value={infForm.source} onChange={e => setInfForm(p => ({ ...p, source: e.target.value }))} placeholder="Instagram, recommandation…" />
          </Field>
          <Field label="Taille audience">
            <input type="number" className={inputClass} value={infForm.audience_size} onChange={e => setInfForm(p => ({ ...p, audience_size: e.target.value }))} />
          </Field>
          <Field label="Taux d'engagement (%)">
            <input type="number" step="0.01" className={inputClass} value={infForm.engagement_rate} onChange={e => setInfForm(p => ({ ...p, engagement_rate: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Bio">
              <textarea className={inputClass} rows={2} value={infForm.bio} onChange={e => setInfForm(p => ({ ...p, bio: e.target.value }))} />
            </Field>
          </div>
          <Field label="Téléphone">
            <input className={inputClass} value={infForm.contact_phone} onChange={e => setInfForm(p => ({ ...p, contact_phone: e.target.value }))} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputClass} value={infForm.contact_email} onChange={e => setInfForm(p => ({ ...p, contact_email: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2 border-t pt-3 mt-1">
            <div className="text-xs font-bold uppercase text-zinc-500 mb-2">Tarifs (MAD)</div>
            <div className="grid grid-cols-5 gap-2">
              {(['Story', 'Reel', 'Post', 'Vidéo', 'Live'] as const).map((l, i) => {
                const k = (['pricing_story', 'pricing_reel', 'pricing_post', 'pricing_video', 'pricing_live'] as const)[i];
                return (
                  <Field key={k} label={l}>
                    <input type="number" className={inputClass} value={infForm[k]} onChange={e => setInfForm(p => ({ ...p, [k]: e.target.value }))} />
                  </Field>
                );
              })}
            </div>
          </div>
          <Field label="Statut">
            <select className={selClass} value={infForm.status} onChange={e => setInfForm(p => ({ ...p, status: e.target.value }))}>
              {INF_STATUSES.map(s => <option key={s} value={s}>{INFLUENCER_STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes internes">
              <textarea className={inputClass} rows={2} value={infForm.notes} onChange={e => setInfForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setInfOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={saveInf} disabled={infSaving || !infForm.full_name.trim()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{infSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </Modal>

      {/* Qualification modal */}
      <Modal open={qualOpen} onClose={() => setQualOpen(false)} title="Qualification influenceuse">
        <div className="space-y-3">
          {QUALIFICATION_DIMS.map(d => (
            <div key={d.key} className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-700">{d.label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} type="button" onClick={() => setQualScores(p => ({ ...p, [d.key]: v }))}
                    className={`w-8 h-8 rounded-lg text-sm font-bold ${qualScores[d.key] === v ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="border-t pt-3 text-center">
            <span className="text-sm text-zinc-500">Score moyen : </span>
            <span className="text-lg font-black text-indigo-700">
              {(Object.values(qualScores).reduce((a, b) => a + b, 0) / Math.max(Object.values(qualScores).length, 1)).toFixed(1)}/5
            </span>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setQualOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={saveQualify} disabled={qualSaving}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{qualSaving ? 'Enregistrement…' : 'Qualifier'}</button>
        </div>
      </Modal>

      {/* Exclude modal */}
      <Modal open={exclOpen} onClose={() => setExclOpen(false)} title="Exclure influenceuse">
        <Field label="Motif d'exclusion *">
          <textarea className={inputClass} rows={3} value={exclReason} onChange={e => setExclReason(e.target.value)} placeholder="Raison de l'exclusion…" />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setExclOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={saveExclude} disabled={exclSaving || !exclReason.trim()}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{exclSaving ? 'Exclusion…' : 'Exclure'}</button>
        </div>
      </Modal>

      {/* Collaboration modal */}
      <Modal open={colOpen} onClose={() => setColOpen(false)} title={colId ? 'Modifier collaboration' : 'Nouvelle collaboration'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Influenceuse *">
            <select className={selClass} value={colForm.influencer_id} onChange={e => setColForm(p => ({ ...p, influencer_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {influencers.filter(i => String(i.status) !== 'exclue').map(i => (
                <option key={String(i.id)} value={String(i.id)}>{String(i.full_name)}</option>
              ))}
            </select>
          </Field>
          <Field label="Campagne">
            <select className={selClass} value={colForm.campaign_id} onChange={e => setColForm(p => ({ ...p, campaign_id: e.target.value }))}>
              <option value="">— Aucune —</option>
              {campaigns.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Titre *">
              <input className={inputClass} value={colForm.title} onChange={e => setColForm(p => ({ ...p, title: e.target.value }))} />
            </Field>
          </div>
          <Field label="Type">
            <select className={selClass} value={colForm.collaboration_type} onChange={e => setColForm(p => ({ ...p, collaboration_type: e.target.value }))}>
              {COLLAB_TYPES.map(t => <option key={t} value={t}>{COLLAB_TYPE_LABELS[t]}</option>)}
            </select>
          </Field>
          <Field label="Montant convenu (MAD)">
            <input type="number" className={inputClass} value={colForm.agreed_amount} onChange={e => setColForm(p => ({ ...p, agreed_amount: e.target.value }))} />
          </Field>
          <Field label="Date début">
            <input type="date" className={inputClass} value={colForm.start_date} onChange={e => setColForm(p => ({ ...p, start_date: e.target.value }))} />
          </Field>
          <Field label="Date fin">
            <input type="date" className={inputClass} value={colForm.end_date} onChange={e => setColForm(p => ({ ...p, end_date: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea className={inputClass} rows={2} value={colForm.description} onChange={e => setColForm(p => ({ ...p, description: e.target.value }))} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Objectifs">
              <textarea className={inputClass} rows={2} value={colForm.objectives} onChange={e => setColForm(p => ({ ...p, objectives: e.target.value }))} />
            </Field>
          </div>
          <Field label="URL Contrat">
            <input className={inputClass} value={colForm.contract_url} onChange={e => setColForm(p => ({ ...p, contract_url: e.target.value }))} />
          </Field>
          <Field label="URL Brief">
            <input className={inputClass} value={colForm.brief_url} onChange={e => setColForm(p => ({ ...p, brief_url: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Livrables attendus (texte libre)">
              <textarea className={inputClass} rows={2} value={colForm.deliverables} onChange={e => setColForm(p => ({ ...p, deliverables: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setColOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={saveCollab} disabled={colSaving || !colForm.title.trim() || !colForm.influencer_id}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{colSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </Modal>

      {/* Validation decision modal */}
      <Modal open={valOpen} onClose={() => setValOpen(false)} title={`Décision ${valTarget.vType}`}>
        <div className="space-y-4">
          <Field label="Décision">
            <select className={selClass} value={valDecision} onChange={e => setValDecision(e.target.value)}>
              <option value="approuve">Approuver</option>
              <option value="refuse">Refuser</option>
            </select>
          </Field>
          <Field label="Commentaire">
            <textarea className={inputClass} rows={3} value={valComment} onChange={e => setValComment(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setValOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={saveValidation} disabled={valSaving}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${valDecision === 'approuve' ? 'bg-green-600' : 'bg-red-600'}`}>
            {valSaving ? 'Enregistrement…' : valDecision === 'approuve' ? 'Approuver' : 'Refuser'}
          </button>
        </div>
      </Modal>

      {/* Deliverable modal */}
      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={delId ? 'Modifier livrable' : 'Nouveau livrable'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Collaboration *">
            <select className={selClass} value={delForm.collaboration_id} onChange={e => setDelForm(p => ({ ...p, collaboration_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {collabs.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.title)}</option>)}
            </select>
          </Field>
          <Field label="Titre *">
            <input className={inputClass} value={delForm.title} onChange={e => setDelForm(p => ({ ...p, title: e.target.value }))} />
          </Field>
          <Field label="Type de contenu">
            <select className={selClass} value={delForm.content_type} onChange={e => setDelForm(p => ({ ...p, content_type: e.target.value }))}>
              {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Plateforme">
            <select className={selClass} value={delForm.platform} onChange={e => setDelForm(p => ({ ...p, platform: e.target.value }))}>
              <option value="">—</option>
              {PLATFORMS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </Field>
          <Field label="Quantité">
            <input type="number" min="1" className={inputClass} value={delForm.quantity} onChange={e => setDelForm(p => ({ ...p, quantity: e.target.value }))} />
          </Field>
          <Field label="Échéance">
            <input type="date" className={inputClass} value={delForm.due_date} onChange={e => setDelForm(p => ({ ...p, due_date: e.target.value }))} />
          </Field>
          <Field label="Statut">
            <select className={selClass} value={delForm.status} onChange={e => setDelForm(p => ({ ...p, status: e.target.value }))}>
              {DELIVERABLE_STATUSES.map(s => <option key={s} value={s}>{DELIVERABLE_STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea className={inputClass} rows={2} value={delForm.description} onChange={e => setDelForm(p => ({ ...p, description: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDelOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={saveDel} disabled={delSaving || !delForm.title.trim() || !delForm.collaboration_id}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{delSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </Modal>

      {/* Shipment modal */}
      <Modal open={shipOpen} onClose={() => setShipOpen(false)} title={shipId ? 'Modifier envoi' : 'Nouvel envoi'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Collaboration *">
            <select className={selClass} value={shipForm.collaboration_id} onChange={e => setShipForm(p => ({ ...p, collaboration_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {collabs.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.title)}</option>)}
            </select>
          </Field>
          <Field label="Influenceuse *">
            <select className={selClass} value={shipForm.influencer_id} onChange={e => setShipForm(p => ({ ...p, influencer_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {influencers.map(i => <option key={String(i.id)} value={String(i.id)}>{String(i.full_name)}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Produits (format : Nom x2, Nom2 x1)">
              <input className={inputClass} value={shipForm.products} onChange={e => setShipForm(p => ({ ...p, products: e.target.value }))} placeholder="Rouge à lèvres x2, Fond de teint x1" />
            </Field>
          </div>
          <Field label="Transporteur">
            <input className={inputClass} value={shipForm.shipping_company} onChange={e => setShipForm(p => ({ ...p, shipping_company: e.target.value }))} />
          </Field>
          <Field label="N° suivi">
            <input className={inputClass} value={shipForm.tracking_number} onChange={e => setShipForm(p => ({ ...p, tracking_number: e.target.value }))} />
          </Field>
          <Field label="Livraison estimée">
            <input type="date" className={inputClass} value={shipForm.estimated_delivery} onChange={e => setShipForm(p => ({ ...p, estimated_delivery: e.target.value }))} />
          </Field>
          <Field label="Statut">
            <select className={selClass} value={shipForm.status} onChange={e => setShipForm(p => ({ ...p, status: e.target.value }))}>
              {SHIPMENT_STATUSES.map(s => <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Adresse de livraison">
              <textarea className={inputClass} rows={2} value={shipForm.delivery_address} onChange={e => setShipForm(p => ({ ...p, delivery_address: e.target.value }))} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea className={inputClass} rows={2} value={shipForm.notes} onChange={e => setShipForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setShipOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={saveShip} disabled={shipSaving || !shipForm.collaboration_id || !shipForm.influencer_id || !shipForm.products.trim()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{shipSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </Modal>

      {/* Payment modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={payId ? 'Modifier paiement' : 'Nouveau paiement'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Collaboration *">
            <select className={selClass} value={payForm.collaboration_id} onChange={e => setPayForm(p => ({ ...p, collaboration_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {collabs.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.title)}</option>)}
            </select>
          </Field>
          <Field label="Influenceuse *">
            <select className={selClass} value={payForm.influencer_id} onChange={e => setPayForm(p => ({ ...p, influencer_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {influencers.map(i => <option key={String(i.id)} value={String(i.id)}>{String(i.full_name)}</option>)}
            </select>
          </Field>
          <Field label="Nature *">
            <select className={selClass} value={payForm.nature} onChange={e => setPayForm(p => ({ ...p, nature: e.target.value }))}>
              {PAYMENT_NATURES.map(n => <option key={n} value={n}>{PAYMENT_NATURE_LABELS[n]}</option>)}
            </select>
          </Field>
          <Field label="Montant *">
            <input type="number" step="0.01" className={inputClass} value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
          </Field>
          <Field label="Devise">
            <input className={inputClass} value={payForm.currency} onChange={e => setPayForm(p => ({ ...p, currency: e.target.value }))} />
          </Field>
          <Field label="Méthode de paiement">
            <input className={inputClass} value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))} placeholder="Virement, chèque…" />
          </Field>
          <Field label="Période début">
            <input type="date" className={inputClass} value={payForm.period_start} onChange={e => setPayForm(p => ({ ...p, period_start: e.target.value }))} />
          </Field>
          <Field label="Période fin">
            <input type="date" className={inputClass} value={payForm.period_end} onChange={e => setPayForm(p => ({ ...p, period_end: e.target.value }))} />
          </Field>
          <Field label="Échéance">
            <input type="date" className={inputClass} value={payForm.due_date} onChange={e => setPayForm(p => ({ ...p, due_date: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea className={inputClass} rows={2} value={payForm.description} onChange={e => setPayForm(p => ({ ...p, description: e.target.value }))} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea className={inputClass} rows={2} value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setPayOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={savePay} disabled={paySaving || !payForm.collaboration_id || !payForm.influencer_id || !payForm.amount}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{paySaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </Modal>

      {/* Published content modal */}
      <Modal open={pcOpen} onClose={() => setPcOpen(false)} title={pcId ? 'Modifier contenu publié' : 'Enregistrer un contenu publié'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Livrable *">
            <select className={selClass} value={pcForm.deliverable_id} onChange={e => setPcForm(p => ({ ...p, deliverable_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {deliverables.map(d => <option key={String(d.id)} value={String(d.id)}>{String(d.title)}</option>)}
            </select>
          </Field>
          <Field label="Collaboration *">
            <select className={selClass} value={pcForm.collaboration_id} onChange={e => setPcForm(p => ({ ...p, collaboration_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {collabs.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.title)}</option>)}
            </select>
          </Field>
          <Field label="Influenceuse *">
            <select className={selClass} value={pcForm.influencer_id} onChange={e => setPcForm(p => ({ ...p, influencer_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {influencers.map(i => <option key={String(i.id)} value={String(i.id)}>{String(i.full_name)}</option>)}
            </select>
          </Field>
          <Field label="Type de contenu">
            <select className={selClass} value={pcForm.content_type} onChange={e => setPcForm(p => ({ ...p, content_type: e.target.value }))}>
              {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Plateforme">
            <select className={selClass} value={pcForm.platform} onChange={e => setPcForm(p => ({ ...p, platform: e.target.value }))}>
              <option value="">—</option>
              {PLATFORMS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </Field>
          <Field label="Date de publication">
            <input type="date" className={inputClass} value={pcForm.published_at} onChange={e => setPcForm(p => ({ ...p, published_at: e.target.value }))} />
          </Field>
          <Field label="URL du contenu">
            <input className={inputClass} value={pcForm.content_url} onChange={e => setPcForm(p => ({ ...p, content_url: e.target.value }))} placeholder="https://…" />
          </Field>
          <Field label="URL capture d'écran">
            <input className={inputClass} value={pcForm.screenshot_url} onChange={e => setPcForm(p => ({ ...p, screenshot_url: e.target.value }))} />
          </Field>
          <div className="sm:col-span-2 border-t pt-3 mt-1">
            <div className="text-xs font-bold uppercase text-zinc-500 mb-2">Métriques de performance</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { k: 'views', l: 'Vues' }, { k: 'reach', l: 'Portée' },
                { k: 'impressions', l: 'Impressions' }, { k: 'likes', l: 'Likes' },
                { k: 'comments_count', l: 'Commentaires' }, { k: 'shares', l: 'Partages' },
                { k: 'saves', l: 'Sauvegardes' }, { k: 'clicks', l: 'Clics' },
              ].map(m => (
                <Field key={m.k} label={m.l}>
                  <input type="number" min="0" className={inputClass}
                    value={(pcForm as R)[m.k] as string}
                    onChange={e => setPcForm(p => ({ ...p, [m.k]: e.target.value }))} />
                </Field>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea className={inputClass} rows={2} value={pcForm.notes} onChange={e => setPcForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setPcOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={savePc} disabled={pcSaving || !pcForm.deliverable_id || !pcForm.collaboration_id || !pcForm.influencer_id}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pcSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </Modal>

      {/* Document modal */}
      <Modal open={docOpen} onClose={() => setDocOpen(false)} title={docId ? 'Modifier document' : 'Nouveau document'}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Influenceuse *">
            <select className={selClass} value={docForm.influencer_id} onChange={e => setDocForm(p => ({ ...p, influencer_id: e.target.value }))}>
              <option value="">— Sélectionner —</option>
              {influencers.map(i => <option key={String(i.id)} value={String(i.id)}>{String(i.full_name)}</option>)}
            </select>
          </Field>
          <Field label="Collaboration">
            <select className={selClass} value={docForm.collaboration_id} onChange={e => setDocForm(p => ({ ...p, collaboration_id: e.target.value }))}>
              <option value="">— Aucune —</option>
              {collabs.map(c => <option key={String(c.id)} value={String(c.id)}>{String(c.title)}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Titre *">
              <input className={inputClass} value={docForm.title} onChange={e => setDocForm(p => ({ ...p, title: e.target.value }))} />
            </Field>
          </div>
          <Field label="Type de document">
            <select className={selClass} value={docForm.document_type} onChange={e => setDocForm(p => ({ ...p, document_type: e.target.value }))}>
              {DOC_TYPES.map(t => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
            </select>
          </Field>
          <Field label="URL du fichier *">
            <input className={inputClass} value={docForm.file_url} onChange={e => setDocForm(p => ({ ...p, file_url: e.target.value }))} placeholder="https://…" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea className={inputClass} rows={2} value={docForm.notes} onChange={e => setDocForm(p => ({ ...p, notes: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setDocOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-semibold text-zinc-600">Annuler</button>
          <button type="button" onClick={saveDoc} disabled={docSaving || !docForm.title.trim() || !docForm.influencer_id || !docForm.file_url.trim()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{docSaving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </Modal>
    </div>
  );
}
