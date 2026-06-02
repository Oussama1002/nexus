import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Modal } from '../ui/Modal';
import { DocumentUploadField } from '../ui/DocumentUploadField';
import * as api from '../../lib/api';
import { isPaginator, type LaravelPaginator } from '../../lib/apiTypes';
import { flattenFieldErrors } from '../../lib/formErrors';
import type { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  CM_TRACKING_STATUS_LABELS,
  CONTENT_CALENDAR_STATUS_LABELS,
  PRODUCTION_STATUS_LABELS,
  STRATEGY_STATUS_LABELS,
} from '../../lib/statusLabelsFr';

type Toast = ReturnType<typeof useToast>;

export type SocialCrudHandle = {
  openAccount: (id?: number) => void;
  openStrategy: (id?: number) => void;
  openCalendar: (id?: number) => void;
  openProduction: (id?: number) => void;
  openCm: (id?: number) => void;
  openPublication: (id?: number) => void;
};

type Props = {
  activeBrandId: string | null;
  toast: Toast;
  onSaved: () => void;
};

const PF = [
  { v: 'instagram', l: 'Instagram' },
  { v: 'facebook', l: 'Facebook' },
  { v: 'tiktok', l: 'TikTok' },
  { v: 'youtube', l: 'YouTube' },
  { v: 'linkedin', l: 'LinkedIn' },
  { v: 'x', l: 'X' },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export const SocialCrudModals = forwardRef<SocialCrudHandle, Props>(function SocialCrudModals(
  { activeBrandId, toast, onSaved },
  ref,
) {
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; platform: string; account_name: string }[]>([]);
  const [strategies, setStrategies] = useState<{ id: number; title: string }[]>([]);
  const [calendarItems, setCalendarItems] = useState<{ id: number; title: string }[]>([]);

  const loadDropdowns = useCallback(async () => {
    if (!activeBrandId) return;
    const [u, a, s, c] = await Promise.all([
      api.get<{ id: number; name: string }[]>('directory/social-users?roles=community_manager,smm,admin'),
      api.get<LaravelPaginator<{ id: number; platform: string; account_name: string }>>('social-accounts?per_page=200'),
      api.get<LaravelPaginator<{ id: number; title: string }>>('strategies?per_page=200'),
      api.get<LaravelPaginator<{ id: number; title: string }>>('content-calendar?per_page=300'),
    ]);
    if (u.ok && Array.isArray(u.data)) setUsers(u.data);
    if (a.ok && isPaginator(a.data)) setAccounts(a.data.data);
    if (s.ok && isPaginator(s.data)) setStrategies(s.data.data);
    if (c.ok && isPaginator(c.data)) setCalendarItems(c.data.data);
  }, [activeBrandId]);

  useEffect(() => {
    void loadDropdowns();
  }, [loadDropdowns]);

  const { hasPermission } = useAuth();
  const canApproveCalendar = hasPermission('content_calendar.approve');
  const canApproveProduction = hasPermission('content_production.approve');
  const canApproveCm = hasPermission('cm_tracking.approve');

  const errToast = (res: { ok: false; message: string; errors?: unknown }) => {
    const fe = flattenFieldErrors((res.errors ?? {}) as Record<string, unknown>);
    toast.error(fe.length ? fe.join(' ') : res.message);
  };

  /* —— Social account —— */
  const [accOpen, setAccOpen] = useState(false);
  const [accId, setAccId] = useState<number | undefined>();
  const [accForm, setAccForm] = useState({
    platform: 'instagram',
    account_name: '',
    handle: '',
    profile_url: '',
    responsible_user_id: '',
    api_connected: false,
    follower_count: '',
    status: 'active',
  });

  const loadAccount = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`social-accounts/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    setAccForm({
      platform: String(d.platform ?? 'instagram'),
      account_name: String(d.account_name ?? ''),
      handle: String(d.handle ?? ''),
      profile_url: String(d.profile_url ?? ''),
      responsible_user_id: d.responsible_user_id ? String(d.responsible_user_id) : '',
      api_connected: !!d.api_connected,
      follower_count: d.follower_count != null ? String(d.follower_count) : '',
      status: String(d.status ?? 'active'),
    });
  };

  const saveAccount = async () => {
    const body = {
      platform: accForm.platform,
      account_name: accForm.account_name || 'Compte',
      handle: accForm.handle || null,
      profile_url: accForm.profile_url || null,
      responsible_user_id: accForm.responsible_user_id ? Number(accForm.responsible_user_id) : null,
      api_connected: accForm.api_connected,
      follower_count: accForm.follower_count ? Number(accForm.follower_count) : null,
      status: accForm.status as 'active' | 'inactive',
    };
    const r = accId
      ? await api.patch(`social-accounts/${accId}`, body)
      : await api.post('social-accounts', body);
    if (!r.ok) return errToast(r);
    toast.success(accId ? 'Compte mis à jour.' : 'Compte créé.');
    setAccOpen(false);
    onSaved();
    void loadDropdowns();
  };

  /* —— Strategy —— */
  const [stOpen, setStOpen] = useState(false);
  const [stId, setStId] = useState<number | undefined>();
  const [stForm, setStForm] = useState({
    title: '',
    marketing_objective: '',
    target_audience: '',
    key_message: '',
    platforms: '',
    expected_kpis: '',
    budget: '',
    period_start: '',
    period_end: '',
    assigned_cm_id: '',
    status: 'draft',
    document_path: '',
  });

  const loadStrategy = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`strategies/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    const plats = Array.isArray(d.platforms) ? (d.platforms as string[]).join(',') : '';
    setStForm({
      title: String(d.title ?? ''),
      marketing_objective: String(d.marketing_objective ?? ''),
      target_audience: String(d.target_audience ?? ''),
      key_message: String(d.key_message ?? ''),
      platforms: plats,
      expected_kpis: String(d.expected_kpis ?? ''),
      budget: d.budget != null ? String(d.budget) : '',
      period_start: d.period_start ? String(d.period_start).slice(0, 10) : '',
      period_end: d.period_end ? String(d.period_end).slice(0, 10) : '',
      assigned_cm_id: d.assigned_cm_id ? String(d.assigned_cm_id) : '',
      status: String(d.status ?? 'draft'),
      document_path: String(d.document_path ?? ''),
    });
  };

  const saveStrategy = async () => {
    const platforms = stForm.platforms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const body: Record<string, unknown> = {
      title: stForm.title,
      marketing_objective: stForm.marketing_objective || null,
      target_audience: stForm.target_audience || null,
      key_message: stForm.key_message || null,
      platforms,
      expected_kpis: stForm.expected_kpis || null,
      budget: stForm.budget ? Number(stForm.budget) : null,
      period_start: stForm.period_start || null,
      period_end: stForm.period_end || null,
      assigned_cm_id: stForm.assigned_cm_id ? Number(stForm.assigned_cm_id) : null,
      status: stForm.status,
      document_path: stForm.document_path || null,
    };
    const r = stId ? await api.patch(`strategies/${stId}`, body) : await api.post('strategies', body);
    if (!r.ok) return errToast(r);
    toast.success(stId ? 'Stratégie mise à jour.' : 'Stratégie créée.');
    setStOpen(false);
    onSaved();
    void loadDropdowns();
  };

  /* —— Calendar —— */
  const [calOpen, setCalOpen] = useState(false);
  const [calId, setCalId] = useState<number | undefined>();
  const [calForm, setCalForm] = useState({
    title: '',
    content_type: 'post',
    platform: '',
    caption: '',
    planned_at: '',
    social_account_id: '',
    strategy_id: '',
    assigned_to: '',
    attachments_json: '',
    status: 'planned',
  });

  const loadCalendar = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`content-calendar/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    setCalForm({
      title: String(d.title ?? ''),
      content_type: String(d.content_type ?? 'post'),
      platform: String(d.platform ?? ''),
      caption: String(d.caption ?? ''),
      planned_at: d.planned_at ? String(d.planned_at).slice(0, 16) : '',
      social_account_id: d.social_account_id ? String(d.social_account_id) : '',
      strategy_id: d.strategy_id ? String(d.strategy_id) : '',
      assigned_to: d.assigned_to ? String(d.assigned_to) : '',
      attachments_json: d.attachments_json ? JSON.stringify(d.attachments_json, null, 0) : '',
      status: String(d.status ?? 'planned'),
    });
  };

  const saveCalendar = async () => {
    let attachments: unknown = null;
    if (calForm.attachments_json.trim()) {
      try {
        attachments = JSON.parse(calForm.attachments_json) as unknown;
      } catch {
        toast.error('JSON pièces jointes invalide.');
        return;
      }
    }
    const body: Record<string, unknown> = {
      title: calForm.title,
      content_type: calForm.content_type,
      platform: calForm.platform || null,
      caption: calForm.caption || null,
      planned_at: calForm.planned_at ? new Date(calForm.planned_at).toISOString() : null,
      social_account_id: calForm.social_account_id ? Number(calForm.social_account_id) : null,
      strategy_id: calForm.strategy_id ? Number(calForm.strategy_id) : null,
      assigned_to: calForm.assigned_to ? Number(calForm.assigned_to) : null,
      attachments_json: attachments,
      status: calForm.status,
    };
    const r = calId ? await api.patch(`content-calendar/${calId}`, body) : await api.post('content-calendar', body);
    if (!r.ok) return errToast(r);
    toast.success(calId ? 'Contenu mis à jour.' : 'Contenu créé.');
    setCalOpen(false);
    onSaved();
    void loadDropdowns();
  };

  /* —— Production —— */
  const [prOpen, setPrOpen] = useState(false);
  const [prId, setPrId] = useState<number | undefined>();
  const [prForm, setPrForm] = useState({
    title: '',
    production_type: 'shooting',
    content_calendar_id: '',
    owner_user_id: '',
    location: '',
    shoot_date: '',
    asset_path: '',
    crew_notes: '',
    status: 'todo',
  });

  const loadProduction = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`content-production/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    setPrForm({
      title: String(d.title ?? ''),
      production_type: String(d.production_type ?? 'shooting'),
      content_calendar_id: d.content_calendar_id ? String(d.content_calendar_id) : '',
      owner_user_id: d.owner_user_id ? String(d.owner_user_id) : '',
      location: String(d.location ?? ''),
      shoot_date: d.shoot_date ? String(d.shoot_date).slice(0, 16) : '',
      asset_path: String(d.asset_path ?? ''),
      crew_notes: String(d.crew_notes ?? ''),
      status: String(d.status ?? 'todo'),
    });
  };

  const saveProduction = async () => {
    const body: Record<string, unknown> = {
      title: prForm.title,
      production_type: prForm.production_type,
      content_calendar_id: prForm.content_calendar_id ? Number(prForm.content_calendar_id) : null,
      owner_user_id: prForm.owner_user_id ? Number(prForm.owner_user_id) : null,
      location: prForm.location || null,
      shoot_date: prForm.shoot_date ? new Date(prForm.shoot_date).toISOString() : null,
      asset_path: prForm.asset_path || null,
      crew_notes: prForm.crew_notes || null,
      status: prForm.status,
    };
    const r = prId ? await api.patch(`content-production/${prId}`, body) : await api.post('content-production', body);
    if (!r.ok) return errToast(r);
    toast.success(prId ? 'Tournage mis à jour.' : 'Tournage créé.');
    setPrOpen(false);
    onSaved();
  };

  /* —— CM tracking —— */
  const [cmOpen, setCmOpen] = useState(false);
  const [cmTId, setCmTId] = useState<number | undefined>();
  const [cmForm, setCmForm] = useState({
    cm_user_id: '',
    work_date: '',
    tasks_done: '',
    posts_done: '',
    stories_done: '',
    lives_done: '',
    notes: '',
    completion_percentage: '',
    status: 'pending',
  });

  const loadCm = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`cm-daily-tracking/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    setCmForm({
      cm_user_id: String(d.cm_user_id ?? ''),
      work_date: d.work_date ? String(d.work_date).slice(0, 10) : '',
      tasks_done: d.tasks_done != null ? String(d.tasks_done) : '',
      posts_done: d.posts_done != null ? String(d.posts_done) : '',
      stories_done: d.stories_done != null ? String(d.stories_done) : '',
      lives_done: d.lives_done != null ? String(d.lives_done) : '',
      notes: String(d.notes ?? ''),
      completion_percentage: d.completion_percentage != null ? String(d.completion_percentage) : '',
      status: String(d.status ?? 'pending'),
    });
  };

  const saveCm = async () => {
    const body: Record<string, unknown> = {
      cm_user_id: Number(cmForm.cm_user_id),
      work_date: cmForm.work_date,
      tasks_done: cmForm.tasks_done ? Number(cmForm.tasks_done) : 0,
      posts_done: cmForm.posts_done ? Number(cmForm.posts_done) : 0,
      stories_done: cmForm.stories_done ? Number(cmForm.stories_done) : 0,
      lives_done: cmForm.lives_done ? Number(cmForm.lives_done) : 0,
      notes: cmForm.notes || null,
      completion_percentage: cmForm.completion_percentage ? Number(cmForm.completion_percentage) : null,
      status: cmForm.status,
    };
    const r = cmTId
      ? await api.patch(`cm-daily-tracking/${cmTId}`, body)
      : await api.post('cm-daily-tracking', body);
    if (!r.ok) return errToast(r);
    toast.success(cmTId ? 'Suivi mis à jour.' : 'Suivi enregistré.');
    setCmOpen(false);
    onSaved();
  };

  /* —— Publication —— */
  const [pubOpen, setPubOpen] = useState(false);
  const [pubId, setPubId] = useState<number | undefined>();
  const [pubForm, setPubForm] = useState({
    content_calendar_id: '',
    social_account_id: '',
    platform: 'instagram',
    title: '',
    published_at: '',
    reach: '',
    impressions: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
    clicks: '',
    notes: '',
  });

  const loadPub = async (id: number) => {
    const r = await api.get<Record<string, unknown>>(`social-publications/${id}`);
    if (!r.ok) return errToast(r);
    const d = r.data;
    setPubForm({
      content_calendar_id: d.content_calendar_id ? String(d.content_calendar_id) : '',
      social_account_id: d.social_account_id ? String(d.social_account_id) : '',
      platform: String(d.platform ?? 'instagram'),
      title: String(d.title ?? ''),
      published_at: d.published_at ? String(d.published_at).slice(0, 16) : '',
      reach: d.reach != null ? String(d.reach) : '',
      impressions: d.impressions != null ? String(d.impressions) : '',
      likes: d.likes != null ? String(d.likes) : '',
      comments: d.comments != null ? String(d.comments) : '',
      shares: d.shares != null ? String(d.shares) : '',
      saves: d.saves != null ? String(d.saves) : '',
      clicks: d.clicks != null ? String(d.clicks) : '',
      notes: String(d.notes ?? ''),
    });
  };

  const savePub = async () => {
    const body: Record<string, unknown> = {
      content_calendar_id: pubForm.content_calendar_id ? Number(pubForm.content_calendar_id) : null,
      social_account_id: pubForm.social_account_id ? Number(pubForm.social_account_id) : null,
      platform: pubForm.platform,
      title: pubForm.title || null,
      published_at: pubForm.published_at ? new Date(pubForm.published_at).toISOString() : null,
      reach: pubForm.reach ? Number(pubForm.reach) : null,
      impressions: pubForm.impressions ? Number(pubForm.impressions) : null,
      likes: pubForm.likes ? Number(pubForm.likes) : null,
      comments: pubForm.comments ? Number(pubForm.comments) : null,
      shares: pubForm.shares ? Number(pubForm.shares) : null,
      saves: pubForm.saves ? Number(pubForm.saves) : null,
      clicks: pubForm.clicks ? Number(pubForm.clicks) : null,
      notes: pubForm.notes || null,
    };
    const r = pubId ? await api.patch(`social-publications/${pubId}`, body) : await api.post('social-publications', body);
    if (!r.ok) return errToast(r);
    toast.success(pubId ? 'Publication mise à jour.' : 'Publication créée.');
    setPubOpen(false);
    onSaved();
  };

  useImperativeHandle(
    ref,
    () => ({
      openAccount: (id) => {
        setAccId(id);
        setAccForm({
          platform: 'instagram',
          account_name: '',
          handle: '',
          profile_url: '',
          responsible_user_id: '',
          api_connected: false,
          follower_count: '',
          status: 'active',
        });
        if (id) void loadAccount(id);
        setAccOpen(true);
      },
      openStrategy: (id) => {
        setStId(id);
        setStForm({
          title: '',
          marketing_objective: '',
          target_audience: '',
          key_message: '',
          platforms: '',
          expected_kpis: '',
          budget: '',
          period_start: '',
          period_end: '',
          assigned_cm_id: '',
          status: 'draft',
          document_path: '',
        });
        if (id) void loadStrategy(id);
        setStOpen(true);
      },
      openCalendar: (id) => {
        setCalId(id);
        setCalForm({
          title: '',
          content_type: 'post',
          platform: '',
          caption: '',
          planned_at: '',
          social_account_id: '',
          strategy_id: '',
          assigned_to: '',
          attachments_json: '',
          status: 'planned',
        });
        if (id) void loadCalendar(id);
        setCalOpen(true);
      },
      openProduction: (id) => {
        setPrId(id);
        setPrForm({
          title: '',
          production_type: 'shooting',
          content_calendar_id: '',
          owner_user_id: '',
          location: '',
          shoot_date: '',
          asset_path: '',
          crew_notes: '',
          status: 'todo',
        });
        if (id) void loadProduction(id);
        setPrOpen(true);
      },
      openCm: (id) => {
        setCmTId(id);
        setCmForm({
          cm_user_id: '',
          work_date: new Date().toISOString().slice(0, 10),
          tasks_done: '',
          posts_done: '',
          stories_done: '',
          lives_done: '',
          notes: '',
          completion_percentage: '',
          status: 'pending',
        });
        if (id) void loadCm(id);
        setCmOpen(true);
      },
      openPublication: (id) => {
        setPubId(id);
        setPubForm({
          content_calendar_id: '',
          social_account_id: '',
          platform: 'instagram',
          title: '',
          published_at: '',
          reach: '',
          impressions: '',
          likes: '',
          comments: '',
          shares: '',
          saves: '',
          clicks: '',
          notes: '',
        });
        if (id) void loadPub(id);
        setPubOpen(true);
      },
    }),
    [],
  );

  const selClass = 'w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold bg-white';

  const cmUsers = useMemo(() => users, [users]);

  if (!activeBrandId) return null;

  return (
    <>
      <Modal open={accOpen} onClose={() => setAccOpen(false)} title={accId ? 'Modifier le compte' : 'Nouveau compte social'} panelClassName="max-w-lg">
        <div className="space-y-3">
          <Field label="Plateforme">
            <select className={selClass} value={accForm.platform} onChange={(e) => setAccForm({ ...accForm, platform: e.target.value })}>
              {PF.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nom du compte *">
            <input className={selClass} value={accForm.account_name} onChange={(e) => setAccForm({ ...accForm, account_name: e.target.value })} />
          </Field>
          <Field label="Handle">
            <input className={selClass} value={accForm.handle} onChange={(e) => setAccForm({ ...accForm, handle: e.target.value })} />
          </Field>
          <Field label="URL profil">
            <input className={selClass} value={accForm.profile_url} onChange={(e) => setAccForm({ ...accForm, profile_url: e.target.value })} />
          </Field>
          <Field label="Responsable (user id)">
            <select
              className={selClass}
              value={accForm.responsible_user_id}
              onChange={(e) => setAccForm({ ...accForm, responsible_user_id: e.target.value })}
            >
              <option value="">—</option>
              {cmUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={accForm.api_connected}
              onChange={(e) => setAccForm({ ...accForm, api_connected: e.target.checked })}
            />
            API connectée
          </label>
          <Field label="Followers">
            <input
              type="number"
              className={selClass}
              value={accForm.follower_count}
              onChange={(e) => setAccForm({ ...accForm, follower_count: e.target.value })}
            />
          </Field>
          <Field label="Statut">
            <select className={selClass} value={accForm.status} onChange={(e) => setAccForm({ ...accForm, status: e.target.value })}>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </Field>
          <button type="button" onClick={() => void saveAccount()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={stOpen} onClose={() => setStOpen(false)} title={stId ? 'Modifier stratégie' : 'Nouvelle stratégie'} panelClassName="max-w-xl">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <Field label="Titre *">
            <input className={selClass} value={stForm.title} onChange={(e) => setStForm({ ...stForm, title: e.target.value })} />
          </Field>
          <Field label="Objectif">
            <textarea className={`${selClass} min-h-[60px]`} value={stForm.marketing_objective} onChange={(e) => setStForm({ ...stForm, marketing_objective: e.target.value })} />
          </Field>
          <Field label="Audience cible">
            <textarea className={`${selClass} min-h-[50px]`} value={stForm.target_audience} onChange={(e) => setStForm({ ...stForm, target_audience: e.target.value })} />
          </Field>
          <Field label="Message clé">
            <input className={selClass} value={stForm.key_message} onChange={(e) => setStForm({ ...stForm, key_message: e.target.value })} />
          </Field>
          <Field label="Plateformes (csv)">
            <input className={selClass} placeholder="instagram,facebook" value={stForm.platforms} onChange={(e) => setStForm({ ...stForm, platforms: e.target.value })} />
          </Field>
          <Field label="KPIs attendus">
            <textarea className={selClass} value={stForm.expected_kpis} onChange={(e) => setStForm({ ...stForm, expected_kpis: e.target.value })} />
          </Field>
          <Field label="Budget">
            <input type="number" className={selClass} value={stForm.budget} onChange={(e) => setStForm({ ...stForm, budget: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Début">
              <input type="date" className={selClass} value={stForm.period_start} onChange={(e) => setStForm({ ...stForm, period_start: e.target.value })} />
            </Field>
            <Field label="Fin">
              <input type="date" className={selClass} value={stForm.period_end} onChange={(e) => setStForm({ ...stForm, period_end: e.target.value })} />
            </Field>
          </div>
          <Field label="CM assigné">
            <select className={selClass} value={stForm.assigned_cm_id} onChange={(e) => setStForm({ ...stForm, assigned_cm_id: e.target.value })}>
              <option value="">—</option>
              {cmUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select className={selClass} value={stForm.status} onChange={(e) => setStForm({ ...stForm, status: e.target.value })}>
              {['draft', 'review', 'approved', 'archived'].map((s) => (
                <option key={s} value={s}>
                  {STRATEGY_STATUS_LABELS[s] ?? s}
                </option>
              ))}
            </select>
          </Field>
          <DocumentUploadField
            label="Document"
            value={stForm.document_path}
            onChange={(v) => setStForm({ ...stForm, document_path: v })}
            uploadPath="strategies/upload-document"
            extraFormFields={stId ? { strategy_id: String(stId) } : undefined}
          />
          <button type="button" onClick={() => void saveStrategy()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={calOpen} onClose={() => setCalOpen(false)} title={calId ? 'Modifier contenu' : 'Nouveau contenu'} panelClassName="max-w-xl">
        <div className="space-y-3 max-h-[75vh] overflow-y-auto">
          <Field label="Titre *">
            <input className={selClass} value={calForm.title} onChange={(e) => setCalForm({ ...calForm, title: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className={selClass} value={calForm.content_type} onChange={(e) => setCalForm({ ...calForm, content_type: e.target.value })}>
              {['post', 'story', 'reel', 'live', 'video', 'carousel'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plateforme (filtre)">
            <select className={selClass} value={calForm.platform} onChange={(e) => setCalForm({ ...calForm, platform: e.target.value })}>
              <option value="">—</option>
              {PF.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Caption">
            <textarea className={`${selClass} min-h-[70px]`} value={calForm.caption} onChange={(e) => setCalForm({ ...calForm, caption: e.target.value })} />
          </Field>
          <Field label="Date / heure prévue">
            <input
              type="datetime-local"
              className={selClass}
              value={calForm.planned_at}
              onChange={(e) => setCalForm({ ...calForm, planned_at: e.target.value })}
            />
          </Field>
          <Field label="Compte social">
            <select className={selClass} value={calForm.social_account_id} onChange={(e) => setCalForm({ ...calForm, social_account_id: e.target.value })}>
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.platform} — {a.account_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stratégie">
            <select className={selClass} value={calForm.strategy_id} onChange={(e) => setCalForm({ ...calForm, strategy_id: e.target.value })}>
              <option value="">—</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assigné à">
            <select className={selClass} value={calForm.assigned_to} onChange={(e) => setCalForm({ ...calForm, assigned_to: e.target.value })}>
              <option value="">—</option>
              {cmUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pièces jointes (JSON)">
            <textarea className={`${selClass} font-mono text-xs`} value={calForm.attachments_json} onChange={(e) => setCalForm({ ...calForm, attachments_json: e.target.value })} />
          </Field>
          <Field label="Statut">
            <select className={selClass} value={calForm.status} onChange={(e) => setCalForm({ ...calForm, status: e.target.value })}>
              {(['draft', 'planned', 'in_production', 'review', 'approved', 'published', 'cancelled'] as const)
                .filter(
                  (s) =>
                    canApproveCalendar ||
                    !['approved', 'published'].includes(s) ||
                    s === calForm.status,
                )
                .map((s) => (
                  <option key={s} value={s}>
                    {CONTENT_CALENDAR_STATUS_LABELS[s] ?? s}
                  </option>
                ))}
            </select>
          </Field>
          <button type="button" onClick={() => void saveCalendar()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={prOpen} onClose={() => setPrOpen(false)} title={prId ? 'Modifier production' : 'Nouvelle tâche production'} panelClassName="max-w-lg">
        <div className="space-y-3">
          <Field label="Titre *">
            <input className={selClass} value={prForm.title} onChange={(e) => setPrForm({ ...prForm, title: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className={selClass} value={prForm.production_type} onChange={(e) => setPrForm({ ...prForm, production_type: e.target.value })}>
              {['shooting', 'editing', 'design', 'copywriting', 'live_preparation'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contenu (calendrier)">
            <select className={selClass} value={prForm.content_calendar_id} onChange={(e) => setPrForm({ ...prForm, content_calendar_id: e.target.value })}>
              <option value="">—</option>
              {calendarItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsable">
            <select className={selClass} value={prForm.owner_user_id} onChange={(e) => setPrForm({ ...prForm, owner_user_id: e.target.value })}>
              <option value="">—</option>
              {cmUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lieu">
            <input className={selClass} value={prForm.location} onChange={(e) => setPrForm({ ...prForm, location: e.target.value })} />
          </Field>
          <Field label="Date / heure">
            <input type="datetime-local" className={selClass} value={prForm.shoot_date} onChange={(e) => setPrForm({ ...prForm, shoot_date: e.target.value })} />
          </Field>
          <Field label="Asset URL">
            <input className={selClass} value={prForm.asset_path} onChange={(e) => setPrForm({ ...prForm, asset_path: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea className={selClass} value={prForm.crew_notes} onChange={(e) => setPrForm({ ...prForm, crew_notes: e.target.value })} />
          </Field>
          <Field label="Statut">
            <select className={selClass} value={prForm.status} onChange={(e) => setPrForm({ ...prForm, status: e.target.value })}>
              {(['todo', 'in_progress', 'submitted', 'validated', 'rejected'] as const)
                .filter(
                  (s) =>
                    canApproveProduction || !['validated', 'rejected'].includes(s) || s === prForm.status,
                )
                .map((s) => (
                  <option key={s} value={s}>
                    {PRODUCTION_STATUS_LABELS[s] ?? s}
                  </option>
                ))}
            </select>
          </Field>
          <button type="button" onClick={() => void saveProduction()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={cmOpen} onClose={() => setCmOpen(false)} title={cmTId ? 'Modifier suivi CM' : 'Suivi CM'} panelClassName="max-w-lg">
        <div className="space-y-3">
          <Field label="CM *">
            <select className={selClass} value={cmForm.cm_user_id} onChange={(e) => setCmForm({ ...cmForm, cm_user_id: e.target.value })}>
              <option value="">—</option>
              {cmUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date *">
            <input type="date" className={selClass} value={cmForm.work_date} onChange={(e) => setCmForm({ ...cmForm, work_date: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tâches faites">
              <input type="number" className={selClass} value={cmForm.tasks_done} onChange={(e) => setCmForm({ ...cmForm, tasks_done: e.target.value })} />
            </Field>
            <Field label="Posts">
              <input type="number" className={selClass} value={cmForm.posts_done} onChange={(e) => setCmForm({ ...cmForm, posts_done: e.target.value })} />
            </Field>
            <Field label="Stories">
              <input type="number" className={selClass} value={cmForm.stories_done} onChange={(e) => setCmForm({ ...cmForm, stories_done: e.target.value })} />
            </Field>
            <Field label="Lives">
              <input type="number" className={selClass} value={cmForm.lives_done} onChange={(e) => setCmForm({ ...cmForm, lives_done: e.target.value })} />
            </Field>
          </div>
          <Field label="Complétion %">
            <input type="number" className={selClass} value={cmForm.completion_percentage} onChange={(e) => setCmForm({ ...cmForm, completion_percentage: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea className={selClass} value={cmForm.notes} onChange={(e) => setCmForm({ ...cmForm, notes: e.target.value })} />
          </Field>
          <Field label="Statut">
            <select className={selClass} value={cmForm.status} onChange={(e) => setCmForm({ ...cmForm, status: e.target.value })}>
              {(['pending', 'submitted', 'validated', 'rejected'] as const)
                .filter((s) => canApproveCm || !['validated', 'rejected'].includes(s) || s === cmForm.status)
                .map((s) => (
                  <option key={s} value={s}>
                    {CM_TRACKING_STATUS_LABELS[s] ?? s}
                  </option>
                ))}
            </select>
          </Field>
          <button type="button" onClick={() => void saveCm()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Enregistrer
          </button>
        </div>
      </Modal>

      <Modal open={pubOpen} onClose={() => setPubOpen(false)} title={pubId ? 'Modifier publication' : 'Nouvelle publication'} panelClassName="max-w-xl">
        <div className="space-y-3 max-h-[75vh] overflow-y-auto">
          <Field label="Contenu calendrier">
            <select className={selClass} value={pubForm.content_calendar_id} onChange={(e) => setPubForm({ ...pubForm, content_calendar_id: e.target.value })}>
              <option value="">—</option>
              {calendarItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Compte social">
            <select className={selClass} value={pubForm.social_account_id} onChange={(e) => setPubForm({ ...pubForm, social_account_id: e.target.value })}>
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.platform} — {a.account_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Plateforme *">
            <select className={selClass} value={pubForm.platform} onChange={(e) => setPubForm({ ...pubForm, platform: e.target.value })}>
              {PF.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Titre">
            <input className={selClass} value={pubForm.title} onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })} />
          </Field>
          <Field label="Publié le">
            <input type="datetime-local" className={selClass} value={pubForm.published_at} onChange={(e) => setPubForm({ ...pubForm, published_at: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {(['reach', 'impressions', 'likes', 'comments', 'shares', 'saves', 'clicks'] as const).map((k) => (
              <Field key={k} label={k}>
                <input type="number" className={selClass} value={pubForm[k]} onChange={(e) => setPubForm({ ...pubForm, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <Field label="Notes">
            <textarea className={selClass} value={pubForm.notes} onChange={(e) => setPubForm({ ...pubForm, notes: e.target.value })} />
          </Field>
          <button type="button" onClick={() => void savePub()} className="w-full py-3 rounded-2xl bg-primary-600 text-white font-black">
            Enregistrer
          </button>
        </div>
      </Modal>
    </>
  );
});
