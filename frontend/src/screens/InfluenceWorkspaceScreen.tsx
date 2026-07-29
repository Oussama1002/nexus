import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Handshake,
  LayoutGrid,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
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
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  statusLabelFr,
} from '../lib/statusLabelsFr';

type Tab = 'dash' | 'influencers' | 'collabs' | 'perf' | 'messages' | 'complaints';

type PerfDraft = {
  influencer_id: string;
  influencer_collaboration_id: string;
  metric_date: string;
  action_type: string;
  planned_actions: string;
  completed_actions: string;
  manager_comment: string;
  views: string;
  reach: string;
  likes: string;
  revenue: string;
};

const PF = [
  { v: 'instagram', l: 'Instagram' },
  { v: 'facebook', l: 'Facebook' },
  { v: 'tiktok', l: 'TikTok' },
  { v: 'youtube', l: 'YouTube' },
  { v: 'linkedin', l: 'LinkedIn' },
  { v: 'x', l: 'X' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-bold uppercase text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;
}

function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const now = new Date();
    const year = now.getFullYear();
    const mon = now.getMonth() + 1;
    const last = new Date(year, mon, 0).getDate();
    const mm = String(mon).padStart(2, '0');
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
  }
  const mm = String(m).padStart(2, '0');
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function cleanNumberOrNull(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function influencerLabel(row: Record<string, unknown>): string {
  const inf = (row.influencer as Record<string, unknown> | undefined) ?? null;
  if (!inf) return `#${String(row.influencer_id ?? '—')}`;
  return String(inf.full_name ?? inf.username ?? inf.handle ?? `#${String(row.influencer_id ?? '—')}`);
}

const selClass = 'w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold bg-white text-zinc-900';

export function InfluenceWorkspaceScreen() {
  const { activeBrandId } = useBrand();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('dash');
  const [loading, setLoading] = useState(false);
  const [savingPerf, setSavingPerf] = useState(false);
  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [influencers, setInfluencers] = useState<Record<string, unknown>[]>([]);
  const [collabs, setCollabs] = useState<Record<string, unknown>[]>([]);
  const [perf, setPerf] = useState<Record<string, unknown>[]>([]);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [complaints, setComplaints] = useState<Record<string, unknown>[]>([]);
  const [perfMonth, setPerfMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [perfDraft, setPerfDraft] = useState<PerfDraft>(() => ({
    influencer_id: '',
    influencer_collaboration_id: '',
    metric_date: new Date().toISOString().slice(0, 10),
    action_type: 'video',
    planned_actions: '1',
    completed_actions: '0',
    manager_comment: '',
    views: '',
    reach: '',
    likes: '',
    revenue: '',
  }));

  const [campaigns, setCampaigns] = useState<{ id: number; name: string }[]>([]);

  const errToast = (res: { message: string; errors?: unknown }) => {
    const fe = flattenFieldErrors((res.errors ?? {}) as Record<string, unknown>);
    toast.error(fe.length ? fe.join(' ') : res.message);
  };

  const load = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    try {
      if (tab === 'dash') {
        const r = await api.get<Record<string, unknown>>('dashboards/influence');
        if (r.ok) setDash(r.data);
        else {
          toast.error(r.message);
          setDash(null);
        }
        return;
      }
      if (tab === 'influencers') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>('influencers?per_page=100');
        if (r.ok && isPaginator(r.data)) setInfluencers(r.data.data);
        else {
          if (!r.ok) toast.error(r.message);
          setInfluencers([]);
        }
        return;
      }
      if (tab === 'collabs') {
        const [collabsRes, infRes, campRes] = await Promise.all([
          api.get<LaravelPaginator<Record<string, unknown>>>('influencer-collaborations?per_page=100'),
          api.get<LaravelPaginator<Record<string, unknown>>>('influencers?per_page=100'),
          api.get<LaravelPaginator<{ id: number; name: string }>>('campaigns?per_page=200'),
        ]);
        if (collabsRes.ok && isPaginator(collabsRes.data)) setCollabs(collabsRes.data.data);
        else {
          if (!collabsRes.ok) toast.error(collabsRes.message);
          setCollabs([]);
        }
        if (infRes.ok && isPaginator(infRes.data)) setInfluencers(infRes.data.data);
        if (campRes.ok && isPaginator(campRes.data)) setCampaigns(campRes.data.data);
        return;
      }
      if (tab === 'perf') {
        const { from, to } = monthBounds(perfMonth);
        const [perfRes, influencersRes, collabsRes] = await Promise.all([
          api.get<LaravelPaginator<Record<string, unknown>>>(
            `influencer-performance?per_page=200&date_from=${from}&date_to=${to}`,
          ),
          api.get<LaravelPaginator<Record<string, unknown>>>('influencers?per_page=100'),
          api.get<LaravelPaginator<Record<string, unknown>>>('influencer-collaborations?per_page=100'),
        ]);

        if (perfRes.ok && isPaginator(perfRes.data)) setPerf(perfRes.data.data);
        else {
          if (!perfRes.ok) toast.error(perfRes.message);
          setPerf([]);
        }
        if (influencersRes.ok && isPaginator(influencersRes.data)) setInfluencers(influencersRes.data.data);
        if (collabsRes.ok && isPaginator(collabsRes.data)) setCollabs(collabsRes.data.data);
        return;
      }
      if (tab === 'messages') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>('influencer-messages?per_page=100');
        if (r.ok && isPaginator(r.data)) setMessages(r.data.data);
        else {
          if (!r.ok) toast.error(r.message);
          setMessages([]);
        }
        return;
      }
      if (tab === 'complaints') {
        const [compRes, infRes] = await Promise.all([
          api.get<LaravelPaginator<Record<string, unknown>>>('influencer-complaints?per_page=100'),
          api.get<LaravelPaginator<Record<string, unknown>>>('influencers?per_page=100'),
        ]);
        if (compRes.ok && isPaginator(compRes.data)) setComplaints(compRes.data.data);
        else {
          if (!compRes.ok) toast.error(compRes.message);
          setComplaints([]);
        }
        if (infRes.ok && isPaginator(infRes.data)) setInfluencers(infRes.data.data);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, perfMonth, tab, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ── Influencer CRUD ── */
  const [infOpen, setInfOpen] = useState(false);
  const [infId, setInfId] = useState<number | undefined>();
  const [infForm, setInfForm] = useState({
    full_name: '',
    username: '',
    platform: '',
    niche: '',
    audience_size: '',
    engagement_rate: '',
    pricing_story: '',
    pricing_reel: '',
    pricing_post: '',
    pricing_video: '',
    pricing_live: '',
    contact_phone: '',
    contact_email: '',
    status: 'lead',
  });
  const [infSaving, setInfSaving] = useState(false);

  const openInfluencer = (id?: number) => {
    setInfId(id);
    setInfForm({
      full_name: '', username: '', platform: '', niche: '',
      audience_size: '', engagement_rate: '',
      pricing_story: '', pricing_reel: '', pricing_post: '', pricing_video: '', pricing_live: '',
      contact_phone: '', contact_email: '', status: 'lead',
    });
    if (id) void loadInfluencer(id);
    setInfOpen(true);
  };

  const loadInfluencer = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`influencers/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    const pj = (typeof d.pricing_json === 'object' && d.pricing_json) ? d.pricing_json as Record<string, unknown> : {};
    setInfForm({
      full_name: String(d.full_name ?? ''),
      username: String(d.username ?? ''),
      platform: String(d.platform ?? ''),
      niche: String(d.niche ?? ''),
      audience_size: d.audience_size != null ? String(d.audience_size) : '',
      engagement_rate: d.engagement_rate != null ? String(d.engagement_rate) : '',
      pricing_story: pj.story != null ? String(pj.story) : '',
      pricing_reel: pj.reel != null ? String(pj.reel) : '',
      pricing_post: pj.post != null ? String(pj.post) : '',
      pricing_video: pj.video != null ? String(pj.video) : '',
      pricing_live: pj.live != null ? String(pj.live) : '',
      contact_phone: String(d.contact_phone ?? ''),
      contact_email: String(d.contact_email ?? ''),
      status: String(d.status ?? 'lead'),
    });
  };

  const saveInfluencer = async () => {
    const pricing: Record<string, number> = {};
    if (infForm.pricing_story.trim()) pricing.story = Number(infForm.pricing_story);
    if (infForm.pricing_reel.trim()) pricing.reel = Number(infForm.pricing_reel);
    if (infForm.pricing_post.trim()) pricing.post = Number(infForm.pricing_post);
    if (infForm.pricing_video.trim()) pricing.video = Number(infForm.pricing_video);
    if (infForm.pricing_live.trim()) pricing.live = Number(infForm.pricing_live);
    const body: Record<string, unknown> = {
      full_name: infForm.full_name,
      username: infForm.username || null,
      platform: infForm.platform || null,
      niche: infForm.niche || null,
      audience_size: infForm.audience_size ? Number(infForm.audience_size) : null,
      engagement_rate: infForm.engagement_rate ? Number(infForm.engagement_rate) : null,
      pricing_json: Object.keys(pricing).length > 0 ? pricing : null,
      contact_phone: infForm.contact_phone || null,
      contact_email: infForm.contact_email || null,
      status: infForm.status,
    };
    setInfSaving(true);
    try {
      const r = infId
        ? await api.patch(`influencers/${infId}`, body)
        : await api.post('influencers', body);
      if (!r.ok) return errToast(r);
      toast.success(infId ? 'Influenceur mis à jour.' : 'Influenceur créé.');
      setInfOpen(false);
      void load();
    } finally {
      setInfSaving(false);
    }
  };

  const deleteInfluencer = async (id: number) => {
    const r = await api.del(`influencers/${id}`);
    if (!r.ok) return errToast(r);
    toast.success('Influenceur supprimé.');
    void load();
  };

  /* ── Collaboration CRUD ── */
  const [colOpen, setColOpen] = useState(false);
  const [colId, setColId] = useState<number | undefined>();
  const [colForm, setColForm] = useState({
    influencer_id: '',
    campaign_id: '',
    title: '',
    collaboration_type: 'post',
    status: 'draft',
    deliverables: '',
    contract_url: '',
    agreed_amount: '',
    start_date: '',
    end_date: '',
  });
  const [colSaving, setColSaving] = useState(false);

  const openCollab = (id?: number) => {
    setColId(id);
    setColForm({
      influencer_id: '', campaign_id: '', title: '',
      collaboration_type: 'post', status: 'draft', deliverables: '',
      contract_url: '', agreed_amount: '', start_date: '', end_date: '',
    });
    if (id) void loadCollab(id);
    setColOpen(true);
  };

  const loadCollab = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`influencer-collaborations/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    setColForm({
      influencer_id: d.influencer_id ? String(d.influencer_id) : '',
      campaign_id: d.campaign_id ? String(d.campaign_id) : '',
      title: String(d.title ?? ''),
      collaboration_type: String(d.collaboration_type ?? 'post'),
      status: String(d.status ?? 'draft'),
      deliverables: String(d.deliverables ?? ''),
      contract_url: String(d.contract_url ?? ''),
      agreed_amount: d.agreed_amount != null ? String(d.agreed_amount) : '',
      start_date: d.start_date ? String(d.start_date).slice(0, 10) : '',
      end_date: d.end_date ? String(d.end_date).slice(0, 10) : '',
    });
  };

  const saveCollab = async () => {
    const body: Record<string, unknown> = {
      influencer_id: Number(colForm.influencer_id),
      campaign_id: colForm.campaign_id ? Number(colForm.campaign_id) : null,
      title: colForm.title,
      collaboration_type: colForm.collaboration_type,
      status: colForm.status,
      deliverables: colForm.deliverables || null,
      contract_url: colForm.contract_url || null,
      agreed_amount: colForm.agreed_amount ? Number(colForm.agreed_amount) : 0,
      start_date: colForm.start_date || null,
      end_date: colForm.end_date || null,
    };
    setColSaving(true);
    try {
      const r = colId
        ? await api.patch(`influencer-collaborations/${colId}`, body)
        : await api.post('influencer-collaborations', body);
      if (!r.ok) return errToast(r);
      toast.success(colId ? 'Collaboration mise à jour.' : 'Collaboration créée.');
      setColOpen(false);
      void load();
    } finally {
      setColSaving(false);
    }
  };

  const deleteCollab = async (id: number) => {
    const r = await api.del(`influencer-collaborations/${id}`);
    if (!r.ok) return errToast(r);
    toast.success('Collaboration supprimée.');
    void load();
  };

  /* ── Complaint CRUD ── */
  const [cmpOpen, setCmpOpen] = useState(false);
  const [cmpId, setCmpId] = useState<number | undefined>();
  const [cmpForm, setCmpForm] = useState({
    influencer_id: '',
    influencer_collaboration_id: '',
    title: '',
    category: 'other',
    severity: 'medium',
    description: '',
    status: 'open',
    resolution_notes: '',
  });
  const [cmpSaving, setCmpSaving] = useState(false);

  const openComplaint = (id?: number) => {
    setCmpId(id);
    setCmpForm({
      influencer_id: '', influencer_collaboration_id: '', title: '',
      category: 'other', severity: 'medium', description: '',
      status: 'open', resolution_notes: '',
    });
    if (id) void loadComplaint(id);
    setCmpOpen(true);
  };

  const loadComplaint = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`influencer-complaints/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    setCmpForm({
      influencer_id: d.influencer_id ? String(d.influencer_id) : '',
      influencer_collaboration_id: d.influencer_collaboration_id ? String(d.influencer_collaboration_id) : '',
      title: String(d.title ?? ''),
      category: String(d.category ?? 'other'),
      severity: String(d.severity ?? 'medium'),
      description: String(d.description ?? ''),
      status: String(d.status ?? 'open'),
      resolution_notes: String(d.resolution_notes ?? ''),
    });
  };

  const saveComplaint = async () => {
    const body: Record<string, unknown> = {
      influencer_id: Number(cmpForm.influencer_id),
      influencer_collaboration_id: cmpForm.influencer_collaboration_id
        ? Number(cmpForm.influencer_collaboration_id)
        : null,
      title: cmpForm.title,
      category: cmpForm.category,
      severity: cmpForm.severity,
      description: cmpForm.description || null,
      status: cmpForm.status,
      resolution_notes: cmpForm.resolution_notes || null,
    };
    setCmpSaving(true);
    try {
      const r = cmpId
        ? await api.patch(`influencer-complaints/${cmpId}`, body)
        : await api.post('influencer-complaints', body);
      if (!r.ok) return errToast(r);
      toast.success(cmpId ? 'Plainte mise à jour.' : 'Plainte créée.');
      setCmpOpen(false);
      void load();
    } finally {
      setCmpSaving(false);
    }
  };

  const deleteComplaint = async (id: number) => {
    const r = await api.del(`influencer-complaints/${id}`);
    if (!r.ok) return errToast(r);
    toast.success('Plainte supprimée.');
    void load();
  };

  /* ── Performance ── */
  const perfTotals = useMemo(() => {
    const planned = perf.reduce((sum, row) => sum + asNumber(row.planned_actions), 0);
    const completed = perf.reduce((sum, row) => sum + asNumber(row.completed_actions), 0);
    const remaining = Math.max(planned - completed, 0);
    const rate = planned > 0 ? (completed / planned) * 100 : 0;
    return { planned, completed, remaining, rate };
  }, [perf]);

  const perfByInfluencer = useMemo(() => {
    const rows = new Map<
      string,
      { name: string; planned: number; completed: number; actions: number; comments: number }
    >();

    for (const row of perf) {
      const key = String(row.influencer_id ?? 'unknown');
      const current = rows.get(key) ?? {
        name: influencerLabel(row),
        planned: 0,
        completed: 0,
        actions: 0,
        comments: 0,
      };
      current.actions += 1;
      current.planned += asNumber(row.planned_actions);
      current.completed += asNumber(row.completed_actions);
      if (String(row.manager_comment ?? '').trim() !== '') current.comments += 1;
      rows.set(key, current);
    }

    return Array.from(rows.values())
      .map((item) => ({
        ...item,
        rate: item.planned > 0 ? (item.completed / item.planned) * 100 : 0,
      }))
      .sort((a, b) => b.rate - a.rate);
  }, [perf]);

  async function submitPerformance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!perfDraft.influencer_id) {
      toast.error('Sélectionnez un influenceur.');
      return;
    }

    const planned = Math.max(1, Number(perfDraft.planned_actions || '1'));
    const completed = Math.max(0, Math.min(Number(perfDraft.completed_actions || '0'), planned));

    const payload: Record<string, unknown> = {
      influencer_id: Number(perfDraft.influencer_id),
      influencer_collaboration_id: perfDraft.influencer_collaboration_id
        ? Number(perfDraft.influencer_collaboration_id)
        : null,
      metric_date: perfDraft.metric_date,
      action_type: perfDraft.action_type.trim() || 'video',
      planned_actions: planned,
      completed_actions: completed,
      manager_comment: perfDraft.manager_comment.trim() || null,
      views: cleanNumberOrNull(perfDraft.views),
      reach: cleanNumberOrNull(perfDraft.reach),
      likes: cleanNumberOrNull(perfDraft.likes),
      revenue: cleanNumberOrNull(perfDraft.revenue),
    };

    setSavingPerf(true);
    try {
      const res = await api.post<Record<string, unknown>>('influencer-performance', payload);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success('Action influenceur enregistrée.');
      setPerfDraft((prev) => ({
        ...prev,
        completed_actions: '0',
        manager_comment: '',
        views: '',
        reach: '',
        likes: '',
        revenue: '',
      }));
      await load();
    } finally {
      setSavingPerf(false);
    }
  }

  if (!activeBrandId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Influence" subtitle="Choisissez une marque active." />
        <EmptyState title="Marque requise" description="Sélectionnez une marque dans l'en-tête." />
      </div>
    );
  }

  const canCreateInf = hasPermission('influence.create');
  const canEditInf = hasPermission('influence.update');
  const canDeleteInf = hasPermission('influence.delete');
  const canCreateCollab = hasPermission('influencer_collaborations.create');
  const canEditCollab = hasPermission('influencer_collaborations.update');
  const canDeleteCollab = hasPermission('influencer_collaborations.delete');
  const canCreateComplaint = hasPermission('influencer_complaints.create');
  const canEditComplaint = hasPermission('influencer_complaints.update');
  const canDeleteComplaint = hasPermission('influencer_complaints.delete');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Studio Influence"
        subtitle="Influenceurs, collaborations, performance, messages, plaintes."
        right={
          <div className="flex items-center gap-2">
            {tab === 'influencers' && canCreateInf && (
              <button
                type="button"
                onClick={() => openInfluencer()}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouvel influenceur
              </button>
            )}
            {tab === 'collabs' && canCreateCollab && (
              <button
                type="button"
                onClick={() => openCollab()}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouvelle collaboration
              </button>
            )}
            {tab === 'complaints' && canCreateComplaint && (
              <button
                type="button"
                onClick={() => openComplaint()}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouvelle plainte
              </button>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-zinc-100 pb-2">
        {(
          [
            ['dash', 'Tableau', LayoutGrid],
            ['influencers', 'Influenceurs', Sparkles],
            ['collabs', 'Collabs', Handshake],
            ['perf', 'Performance', BarChart3],
            ['messages', 'Messages', MessageCircle],
            ['complaints', 'Plaintes', AlertTriangle],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id as Tab)}
            className={`px-3 py-2 rounded-xl text-sm font-black inline-flex items-center gap-2 ${
              tab === id ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === 'dash' && loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-3 w-24 bg-zinc-100 rounded mb-2" />
              <div className="h-8 w-16 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {tab === 'dash' && !loading && dash && (
        <div className="space-y-6">
          <p className="text-sm text-zinc-600">
            Période :{' '}
            <span className="font-bold text-zinc-800">
              {(dash.period as { from?: string; to?: string } | undefined)?.from ?? '—'} →{' '}
              {(dash.period as { from?: string; to?: string } | undefined)?.to ?? '—'}
            </span>
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">Influenceurs (total)</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{Number(dash.total_influencers ?? 0)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">Collaborations actives</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{Number(dash.active_collaborations ?? 0)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">Dépenses (période)</p>
              <p className="text-2xl font-black mt-1 tabular-nums">
                {formatCurrency(Number(dash.influencer_spend_period ?? 0))}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">CA attribué</p>
              <p className="text-2xl font-black mt-1 tabular-nums">
                {formatCurrency(Number(dash.revenue_attributed ?? 0))}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">ROI moyen</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{fmtPct(dash.avg_roi_percent as number | null)}</p>
            </div>
            <div className="card p-4">
              <p className="text-[10px] font-black uppercase text-zinc-400">Plaintes ouvertes</p>
              <p className="text-2xl font-black mt-1 tabular-nums">{Number(dash.open_complaints ?? 0)}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-sm font-black mb-3">Top influenceurs (CA, période)</p>
              {Array.isArray(dash.top_influencers) && dash.top_influencers.length > 0 ? (
                <ul className="space-y-2">
                  {(dash.top_influencers as Record<string, unknown>[]).map((row, idx) => {
                    const inf = row.influencer as { full_name?: string; handle?: string } | undefined;
                    const name = inf?.full_name ?? inf?.handle ?? `ID ${row.influencer_id ?? ''}`;
                    const rev = row.total_rev;
                    return (
                      <li
                        key={`${row.influencer_id ?? idx}`}
                        className="flex justify-between gap-4 text-sm border-b border-zinc-50 pb-2 last:border-0"
                      >
                        <span className="font-semibold text-zinc-800 truncate">{name}</span>
                        <span className="font-black tabular-nums shrink-0">
                          {formatCurrency(Number(rev ?? 0))}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">Aucune performance enregistrée sur cette période.</p>
              )}
            </div>

            <div className="card p-4">
              <p className="text-sm font-black mb-3">Influenceurs par plateforme</p>
              {dash.influencers_by_platform &&
              typeof dash.influencers_by_platform === 'object' &&
              !Array.isArray(dash.influencers_by_platform) &&
              Object.keys(dash.influencers_by_platform as object).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dash.influencers_by_platform as Record<string, number>).map(([plat, c]) => (
                    <span
                      key={plat}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 text-sm font-bold text-zinc-800"
                    >
                      {plat}{' '}
                      <span className="text-primary-600 tabular-nums">{Number(c)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Aucun influenceur avec plateforme renseignée.</p>
              )}
            </div>
          </div>

          {Number(dash.total_influencers ?? 0) === 0 && (
            <EmptyState
              title="Pas encore de données influence"
              description="Créez des influenceurs depuis l'onglet Influenceurs pour commencer."
            />
          )}
        </div>
      )}

      {/* ── Influencers Tab ── */}
      {tab === 'influencers' && (
        <DataTable<Record<string, unknown>>
          rows={influencers}
          loading={loading}
          columns={[
            { key: 'n', header: 'Nom', cell: (r) => String(r.full_name ?? '') },
            { key: 'u', header: 'Username', cell: (r) => r.username ? `@${String(r.username)}` : '—' },
            { key: 'p', header: 'Plateforme', cell: (r) => String(r.platform ?? '—') },
            { key: 'ni', header: 'Niche', cell: (r) => String(r.niche ?? '—') },
            {
              key: 'aud',
              header: 'Audience',
              cell: (r) => r.audience_size ? Number(r.audience_size).toLocaleString('fr-FR') : '—',
            },
            { key: 'ph', header: 'Contact', cell: (r) => String(r.contact_email ?? r.contact_phone ?? '—') },
            {
              key: 's',
              header: 'Statut',
              cell: (r) => {
                const s = String(r.status ?? '');
                const color =
                  s === 'active' ? 'bg-emerald-50 text-emerald-700' :
                  s === 'blacklisted' ? 'bg-rose-50 text-rose-700' :
                  s === 'inactive' ? 'bg-zinc-100 text-zinc-600' :
                  'bg-amber-50 text-amber-700';
                return (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>
                    {statusLabelFr(s, INFLUENCER_STATUS_LABELS)}
                  </span>
                );
              },
            },
            ...((canEditInf || canDeleteInf)
              ? [{
                  key: 'actions',
                  header: '',
                  cell: (r: Record<string, unknown>) => (
                    <div className="flex items-center gap-1">
                      {canEditInf && (
                        <button
                          type="button"
                          onClick={() => openInfluencer(Number(r.id))}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteInf && (
                        <button
                          type="button"
                          onClick={() => void deleteInfluencer(Number(r.id))}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ),
                }]
              : []),
          ]}
          emptyTitle="Aucun influenceur pour cette marque"
          emptyDescription="Créez un influenceur pour commencer à suivre vos partenariats."
          emptyAction={
            canCreateInf ? (
              <button
                type="button"
                onClick={() => openInfluencer()}
                className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold"
              >
                Ajouter un influenceur
              </button>
            ) : undefined
          }
        />
      )}

      {/* ── Collabs Tab ── */}
      {tab === 'collabs' && (
        <DataTable<Record<string, unknown>>
          rows={collabs}
          loading={loading}
          columns={[
            { key: 't', header: 'Titre', cell: (r) => String(r.title ?? '') },
            {
              key: 'inf',
              header: 'Influenceur',
              cell: (r) => {
                const inf = r.influencer as Record<string, unknown> | undefined;
                return inf ? String(inf.full_name ?? inf.username ?? '') : '—';
              },
            },
            {
              key: 'type',
              header: 'Type',
              cell: (r) => statusLabelFr(String(r.collaboration_type ?? ''), COLLAB_TYPE_LABELS),
            },
            {
              key: 'a',
              header: 'Montant',
              cell: (r) => r.agreed_amount != null ? formatCurrency(Number(r.agreed_amount)) : '—',
            },
            {
              key: 'dates',
              header: 'Période',
              cell: (r) => {
                const s = r.start_date ? String(r.start_date).slice(0, 10) : '';
                const e = r.end_date ? String(r.end_date).slice(0, 10) : '';
                if (!s && !e) return '—';
                return `${s} → ${e}`;
              },
            },
            {
              key: 'st',
              header: 'Statut',
              cell: (r) => {
                const s = String(r.status ?? '');
                const color =
                  s === 'active' ? 'bg-emerald-50 text-emerald-700' :
                  s === 'completed' ? 'bg-blue-50 text-blue-700' :
                  s === 'cancelled' || s === 'disputed' ? 'bg-rose-50 text-rose-700' :
                  s === 'approved' ? 'bg-teal-50 text-teal-700' :
                  'bg-amber-50 text-amber-700';
                return (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>
                    {statusLabelFr(s, COLLAB_STATUS_LABELS)}
                  </span>
                );
              },
            },
            ...((canEditCollab || canDeleteCollab)
              ? [{
                  key: 'actions',
                  header: '',
                  cell: (r: Record<string, unknown>) => (
                    <div className="flex items-center gap-1">
                      {canEditCollab && (
                        <button
                          type="button"
                          onClick={() => openCollab(Number(r.id))}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteCollab && (
                        <button
                          type="button"
                          onClick={() => void deleteCollab(Number(r.id))}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ),
                }]
              : []),
          ]}
          emptyTitle="Aucune collaboration"
          emptyDescription="Créez une collaboration pour suivre vos partenariats influenceurs."
          emptyAction={
            canCreateCollab ? (
              <button
                type="button"
                onClick={() => openCollab()}
                className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold"
              >
                Nouvelle collaboration
              </button>
            ) : undefined
          }
        />
      )}

      {/* ── Performance Tab ── */}
      {tab === 'perf' && (
        <div className="space-y-4">
          <div className="card p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-black uppercase text-zinc-500">
                Mois de suivi
                <input
                  type="month"
                  value={perfMonth}
                  onChange={(e) => setPerfMonth(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>
              <p className="text-xs text-zinc-500">
                Suivi des livrables réalisés (vidéo, story, live...) par influenceur sur le mois.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="card-muted p-3">
                <p className="text-[10px] uppercase font-black text-zinc-400">Actions prévues</p>
                <p className="text-xl font-black tabular-nums">{perfTotals.planned}</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] uppercase font-black text-zinc-400">Actions réalisées</p>
                <p className="text-xl font-black tabular-nums">{perfTotals.completed}</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] uppercase font-black text-zinc-400">Reste à livrer</p>
                <p className="text-xl font-black tabular-nums">{perfTotals.remaining}</p>
              </div>
              <div className="card-muted p-3">
                <p className="text-[10px] uppercase font-black text-zinc-400">Taux de livraison</p>
                <p className="text-xl font-black tabular-nums">{fmtPct(perfTotals.rate)}</p>
              </div>
            </div>

            <form onSubmit={(e) => void submitPerformance(e)} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <label className="text-xs font-black uppercase text-zinc-500">
                Influenceur
                <select
                  value={perfDraft.influencer_id}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, influencer_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                  required
                >
                  <option value="">— Sélectionner —</option>
                  {influencers.map((i) => (
                    <option key={String(i.id)} value={String(i.id)}>
                      {String(i.full_name ?? i.username ?? i.handle ?? `#${String(i.id)}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Collaboration
                <select
                  value={perfDraft.influencer_collaboration_id}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, influencer_collaboration_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                >
                  <option value="">— Optionnel —</option>
                  {collabs.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {String(c.title ?? `#${String(c.id)}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Action
                <select
                  value={perfDraft.action_type}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, action_type: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 font-bold"
                >
                  <option value="video">Vidéo</option>
                  <option value="story">Story</option>
                  <option value="live">Live</option>
                  <option value="post">Post</option>
                  <option value="reel">Reel</option>
                  <option value="autre">Autre</option>
                </select>
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Date
                <input
                  type="date"
                  value={perfDraft.metric_date}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, metric_date: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                  required
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Prévu
                <input
                  type="number"
                  min={1}
                  value={perfDraft.planned_actions}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, planned_actions: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Réalisé
                <input
                  type="number"
                  min={0}
                  value={perfDraft.completed_actions}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, completed_actions: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500 md:col-span-3">
                Commentaires
                <textarea
                  rows={2}
                  value={perfDraft.manager_comment}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, manager_comment: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                  placeholder="Note de suivi (retard, qualité, remarques...)"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Vues
                <input
                  type="number"
                  min={0}
                  value={perfDraft.views}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, views: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Reach
                <input
                  type="number"
                  min={0}
                  value={perfDraft.reach}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, reach: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                Likes
                <input
                  type="number"
                  min={0}
                  value={perfDraft.likes}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, likes: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <label className="text-xs font-black uppercase text-zinc-500">
                CA attribué
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={perfDraft.revenue}
                  onChange={(e) => setPerfDraft((d) => ({ ...d, revenue: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200"
                />
              </label>

              <div className="md:col-span-3 flex items-end justify-end">
                <button
                  type="submit"
                  disabled={savingPerf}
                  className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60"
                >
                  {savingPerf ? 'Enregistrement...' : 'Enregistrer action'}
                </button>
              </div>
            </form>
          </div>

          <DataTable<Record<string, unknown>>
            rows={perfByInfluencer.map((row) => ({
              influencer: row.name,
              planned: row.planned,
              completed: row.completed,
              actions: row.actions,
              comments_count: row.comments,
              rate: row.rate,
            }))}
            columns={[
              { key: 'inf', header: 'Influenceur', cell: (r) => String(r.influencer ?? '') },
              { key: 'a', header: 'Actions', cell: (r) => String(r.actions ?? 0) },
              { key: 'p', header: 'Prévu', cell: (r) => String(r.planned ?? 0) },
              { key: 'c', header: 'Réalisé', cell: (r) => String(r.completed ?? 0) },
              { key: 'rate', header: 'Livraison %', cell: (r) => fmtPct(asNumber(r.rate)) },
              { key: 'com', header: 'Commentaires', cell: (r) => String(r.comments_count ?? 0) },
            ]}
            loading={loading}
            emptyTitle="Aucun suivi de performance sur ce mois"
            emptyDescription="Ajoutez les actions livrées (vidéo, story, live...) pour suivre la complétion mensuelle par influenceur."
          />

          <DataTable<Record<string, unknown>>
            rows={perf}
            columns={[
              { key: 'd', header: 'Date', cell: (r) => String(r.metric_date ?? '') },
              { key: 'inf', header: 'Influenceur', cell: (r) => influencerLabel(r) },
              { key: 'act', header: 'Action', cell: (r) => String(r.action_type ?? '—') },
              { key: 'pc', header: 'Prévu/Réalisé', cell: (r) => `${asNumber(r.completed_actions)}/${asNumber(r.planned_actions)}` },
              {
                key: 'com',
                header: 'Commentaire',
                cell: (r) => {
                  const text = String(r.manager_comment ?? '').trim();
                  if (!text) return '—';
                  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
                },
              },
              { key: 'rev', header: 'CA', cell: (r) => String(r.revenue ?? '') },
              { key: 'roi', header: 'ROI %', cell: (r) => String(r.roi_percent ?? '') },
            ]}
            loading={loading}
            emptyTitle="Aucune action enregistrée"
            emptyDescription="Le community manager peut logger chaque action réalisée pour contrôler la livraison en fin de mois."
          />
        </div>
      )}

      {/* ── Messages Tab ── */}
      {tab === 'messages' && (
        <DataTable<Record<string, unknown>>
          rows={messages}
          loading={loading}
          columns={[
            { key: 'dir', header: 'Sens', cell: (r) => String(r.direction ?? '') },
            { key: 'ch', header: 'Canal', cell: (r) => String(r.channel ?? '') },
            { key: 'm', header: 'Message', cell: (r) => String(r.message ?? '').slice(0, 80) },
          ]}
          emptyTitle="Aucun message"
          emptyDescription="Les messages avec les influenceurs apparaîtront ici."
        />
      )}

      {/* ── Complaints Tab ── */}
      {tab === 'complaints' && (
        <DataTable<Record<string, unknown>>
          rows={complaints}
          loading={loading}
          columns={[
            { key: 't', header: 'Titre', cell: (r) => String(r.title ?? '') },
            {
              key: 'inf',
              header: 'Influenceur',
              cell: (r) => {
                const inf = r.influencer as Record<string, unknown> | undefined;
                return inf ? String(inf.full_name ?? inf.username ?? '') : '—';
              },
            },
            {
              key: 'cat',
              header: 'Catégorie',
              cell: (r) => statusLabelFr(String(r.category ?? ''), COMPLAINT_CATEGORY_LABELS),
            },
            {
              key: 'sev',
              header: 'Gravité',
              cell: (r) => {
                const s = String(r.severity ?? '');
                const color =
                  s === 'critical' ? 'bg-rose-50 text-rose-700' :
                  s === 'high' ? 'bg-orange-50 text-orange-700' :
                  s === 'medium' ? 'bg-amber-50 text-amber-700' :
                  'bg-zinc-100 text-zinc-600';
                return (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>
                    {statusLabelFr(s, COMPLAINT_SEVERITY_LABELS)}
                  </span>
                );
              },
            },
            {
              key: 'st',
              header: 'Statut',
              cell: (r) => {
                const s = String(r.status ?? '');
                const color =
                  s === 'resolved' || s === 'closed' ? 'bg-emerald-50 text-emerald-700' :
                  s === 'in_review' ? 'bg-amber-50 text-amber-700' :
                  s === 'reopened' ? 'bg-orange-50 text-orange-700' :
                  'bg-rose-50 text-rose-700';
                return (
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>
                    {statusLabelFr(s, COMPLAINT_STATUS_LABELS)}
                  </span>
                );
              },
            },
            ...((canEditComplaint || canDeleteComplaint)
              ? [{
                  key: 'actions',
                  header: '',
                  cell: (r: Record<string, unknown>) => (
                    <div className="flex items-center gap-1">
                      {canEditComplaint && (
                        <button
                          type="button"
                          onClick={() => openComplaint(Number(r.id))}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteComplaint && (
                        <button
                          type="button"
                          onClick={() => void deleteComplaint(Number(r.id))}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-zinc-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ),
                }]
              : []),
          ]}
          emptyTitle="Aucune plainte"
          emptyDescription="Créez une plainte pour signaler un problème avec un influenceur."
          emptyAction={
            canCreateComplaint ? (
              <button
                type="button"
                onClick={() => openComplaint()}
                className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-bold"
              >
                Nouvelle plainte
              </button>
            ) : undefined
          }
        />
      )}

      {/* ══════ MODALS ══════ */}

      {/* ── Influencer Modal ── */}
      <Modal
        open={infOpen}
        onClose={() => setInfOpen(false)}
        title={infId ? 'Modifier influenceur' : 'Nouvel influenceur'}
        panelClassName="max-w-xl"
      >
        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          <Field label="Nom complet *">
            <input
              className={selClass}
              value={infForm.full_name}
              onChange={(e) => setInfForm({ ...infForm, full_name: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Username">
              <input
                className={selClass}
                placeholder="@handle"
                value={infForm.username}
                onChange={(e) => setInfForm({ ...infForm, username: e.target.value })}
              />
            </Field>
            <Field label="Plateforme">
              <select
                className={selClass}
                value={infForm.platform}
                onChange={(e) => setInfForm({ ...infForm, platform: e.target.value })}
              >
                <option value="">—</option>
                {PF.map((p) => (
                  <option key={p.v} value={p.v}>{p.l}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Niche">
            <input
              className={selClass}
              placeholder="beauté, sport, tech..."
              value={infForm.niche}
              onChange={(e) => setInfForm({ ...infForm, niche: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Taille audience">
              <input
                type="number"
                min={0}
                className={selClass}
                value={infForm.audience_size}
                onChange={(e) => setInfForm({ ...infForm, audience_size: e.target.value })}
              />
            </Field>
            <Field label="Taux engagement %">
              <input
                type="number"
                min={0}
                step="0.01"
                className={selClass}
                value={infForm.engagement_rate}
                onChange={(e) => setInfForm({ ...infForm, engagement_rate: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Téléphone">
              <input
                className={selClass}
                value={infForm.contact_phone}
                onChange={(e) => setInfForm({ ...infForm, contact_phone: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                className={selClass}
                value={infForm.contact_email}
                onChange={(e) => setInfForm({ ...infForm, contact_email: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-[11px] font-bold uppercase text-zinc-700 pt-1">Tarifs (MAD)</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Story">
              <input
                type="number"
                min={0}
                className={selClass}
                placeholder="0"
                value={infForm.pricing_story}
                onChange={(e) => setInfForm({ ...infForm, pricing_story: e.target.value })}
              />
            </Field>
            <Field label="Reel">
              <input
                type="number"
                min={0}
                className={selClass}
                placeholder="0"
                value={infForm.pricing_reel}
                onChange={(e) => setInfForm({ ...infForm, pricing_reel: e.target.value })}
              />
            </Field>
            <Field label="Post">
              <input
                type="number"
                min={0}
                className={selClass}
                placeholder="0"
                value={infForm.pricing_post}
                onChange={(e) => setInfForm({ ...infForm, pricing_post: e.target.value })}
              />
            </Field>
            <Field label="Vidéo">
              <input
                type="number"
                min={0}
                className={selClass}
                placeholder="0"
                value={infForm.pricing_video}
                onChange={(e) => setInfForm({ ...infForm, pricing_video: e.target.value })}
              />
            </Field>
            <Field label="Live">
              <input
                type="number"
                min={0}
                className={selClass}
                placeholder="0"
                value={infForm.pricing_live}
                onChange={(e) => setInfForm({ ...infForm, pricing_live: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Statut">
            <select
              className={selClass}
              value={infForm.status}
              onChange={(e) => setInfForm({ ...infForm, status: e.target.value })}
            >
              {Object.entries(INFLUENCER_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            disabled={infSaving || !infForm.full_name.trim()}
            onClick={() => void saveInfluencer()}
            className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black disabled:opacity-60"
          >
            {infSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* ── Collaboration Modal ── */}
      <Modal
        open={colOpen}
        onClose={() => setColOpen(false)}
        title={colId ? 'Modifier collaboration' : 'Nouvelle collaboration'}
        panelClassName="max-w-xl"
      >
        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          <Field label="Influenceur *">
            <select
              className={selClass}
              value={colForm.influencer_id}
              onChange={(e) => setColForm({ ...colForm, influencer_id: e.target.value })}
              required
            >
              <option value="">— Sélectionner —</option>
              {influencers.map((i) => (
                <option key={String(i.id)} value={String(i.id)}>
                  {String(i.full_name ?? i.username ?? `#${String(i.id)}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Titre *">
            <input
              className={selClass}
              value={colForm.title}
              onChange={(e) => setColForm({ ...colForm, title: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <select
                className={selClass}
                value={colForm.collaboration_type}
                onChange={(e) => setColForm({ ...colForm, collaboration_type: e.target.value })}
              >
                {Object.entries(COLLAB_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Montant convenu">
              <input
                type="number"
                min={0}
                step="0.01"
                className={selClass}
                value={colForm.agreed_amount}
                onChange={(e) => setColForm({ ...colForm, agreed_amount: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Campagne">
            <select
              className={selClass}
              value={colForm.campaign_id}
              onChange={(e) => setColForm({ ...colForm, campaign_id: e.target.value })}
            >
              <option value="">— Optionnel —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Livrables">
            <textarea
              className={`${selClass} min-h-[60px]`}
              placeholder="2 reels + 3 stories + 1 post..."
              value={colForm.deliverables}
              onChange={(e) => setColForm({ ...colForm, deliverables: e.target.value })}
            />
          </Field>
          <Field label="URL contrat">
            <input
              className={selClass}
              placeholder="https://..."
              value={colForm.contract_url}
              onChange={(e) => setColForm({ ...colForm, contract_url: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Date début">
              <input
                type="date"
                className={selClass}
                value={colForm.start_date}
                onChange={(e) => setColForm({ ...colForm, start_date: e.target.value })}
              />
            </Field>
            <Field label="Date fin">
              <input
                type="date"
                className={selClass}
                value={colForm.end_date}
                onChange={(e) => setColForm({ ...colForm, end_date: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Statut">
            <select
              className={selClass}
              value={colForm.status}
              onChange={(e) => setColForm({ ...colForm, status: e.target.value })}
            >
              {Object.entries(COLLAB_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            disabled={colSaving || !colForm.influencer_id || !colForm.title.trim()}
            onClick={() => void saveCollab()}
            className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black disabled:opacity-60"
          >
            {colSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>

      {/* ── Complaint Modal ── */}
      <Modal
        open={cmpOpen}
        onClose={() => setCmpOpen(false)}
        title={cmpId ? 'Modifier plainte' : 'Nouvelle plainte'}
        panelClassName="max-w-xl"
      >
        <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
          <Field label="Influenceur *">
            <select
              className={selClass}
              value={cmpForm.influencer_id}
              onChange={(e) => setCmpForm({ ...cmpForm, influencer_id: e.target.value })}
              required
            >
              <option value="">— Sélectionner —</option>
              {influencers.map((i) => (
                <option key={String(i.id)} value={String(i.id)}>
                  {String(i.full_name ?? i.username ?? `#${String(i.id)}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Titre *">
            <input
              className={selClass}
              value={cmpForm.title}
              onChange={(e) => setCmpForm({ ...cmpForm, title: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Catégorie">
              <select
                className={selClass}
                value={cmpForm.category}
                onChange={(e) => setCmpForm({ ...cmpForm, category: e.target.value })}
              >
                {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Gravité">
              <select
                className={selClass}
                value={cmpForm.severity}
                onChange={(e) => setCmpForm({ ...cmpForm, severity: e.target.value })}
              >
                {Object.entries(COMPLAINT_SEVERITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Collaboration (optionnel)">
            <select
              className={selClass}
              value={cmpForm.influencer_collaboration_id}
              onChange={(e) => setCmpForm({ ...cmpForm, influencer_collaboration_id: e.target.value })}
            >
              <option value="">— Aucune —</option>
              {collabs
                .filter((c) => !cmpForm.influencer_id || String(c.influencer_id) === cmpForm.influencer_id)
                .map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {String(c.title ?? `#${String(c.id)}`)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              className={`${selClass} min-h-[80px]`}
              placeholder="Décrivez le problème en détail..."
              value={cmpForm.description}
              onChange={(e) => setCmpForm({ ...cmpForm, description: e.target.value })}
            />
          </Field>
          <Field label="Statut">
            <select
              className={selClass}
              value={cmpForm.status}
              onChange={(e) => setCmpForm({ ...cmpForm, status: e.target.value })}
            >
              {Object.entries(COMPLAINT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          {(cmpForm.status === 'resolved' || cmpForm.status === 'closed') && (
            <Field label="Notes de résolution *">
              <textarea
                className={`${selClass} min-h-[60px]`}
                placeholder="Comment le problème a été résolu..."
                value={cmpForm.resolution_notes}
                onChange={(e) => setCmpForm({ ...cmpForm, resolution_notes: e.target.value })}
                required
              />
            </Field>
          )}
          <button
            type="button"
            disabled={cmpSaving || !cmpForm.influencer_id || !cmpForm.title.trim()}
            onClick={() => void saveComplaint()}
            className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black disabled:opacity-60"
          >
            {cmpSaving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
