import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  LayoutGrid,
  LineChart as LineChartIcon,
  Plus,
  Pencil,
  RefreshCw,
  Send,
  Share2,
  Target,
  TrendingUp,
  Users,
  Kanban,
  Newspaper,
} from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useBrand } from '../../context/BrandContext';
import { useToast } from '../../context/ToastContext';
import * as api from '../../lib/api';
import { isPaginator, type LaravelPaginator } from '../../lib/apiTypes';
import { SocialCrudModals, type SocialCrudHandle } from './SocialCrudModals';

export type SocialSectionId =
  | 'dash'
  | 'accounts'
  | 'strategies'
  | 'calendar'
  | 'production'
  | 'validation'
  | 'cm'
  | 'publications'
  | 'reporting';

const SECTIONS: { id: SocialSectionId; label: string; icon: React.ElementType }[] = [
  { id: 'dash', label: 'Dashboard', icon: LayoutGrid },
  { id: 'accounts', label: 'Comptes sociaux', icon: Share2 },
  { id: 'strategies', label: 'Stratégies', icon: Target },
  { id: 'calendar', label: 'Calendrier contenu', icon: CalendarDays },
  { id: 'production', label: 'Tournages / production', icon: Clapperboard },
  { id: 'validation', label: 'Validation contenu', icon: CheckCircle2 },
  { id: 'cm', label: 'Suivi CM', icon: Users },
  { id: 'publications', label: 'Publications', icon: Newspaper },
  { id: 'reporting', label: 'KPI & reporting', icon: TrendingUp },
];

const PLATFORM_OPTS = [
  { value: '', label: 'Toutes plateformes' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'x', label: 'X' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  planned: 'Planifié',
  in_production: 'En production',
  review: 'En validation',
  approved: 'Approuvé',
  published: 'Publié',
  cancelled: 'Annulé',
};

const CM_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  submitted: 'Soumis',
  validated: 'Validé',
  rejected: 'Rejeté',
};

const PROD_STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  submitted: 'Soumis',
  validated: 'Validé',
  rejected: 'Rejeté',
};

function statusPill(status: string | undefined, labelMap: Record<string, string>) {
  const s = String(status ?? '');
  const label = labelMap[s] ?? s;
  const ok = s === 'approved' || s === 'published' || s === 'validated';
  const review = s === 'review' || s === 'submitted';
  const bad = s === 'rejected' || s === 'cancelled';
  const cls = ok
    ? 'bg-emerald-100 text-emerald-900'
    : review
      ? 'bg-amber-100 text-amber-900'
      : bad
        ? 'bg-red-100 text-red-800'
        : 'bg-zinc-100 text-zinc-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${cls}`}>
      {label}
    </span>
  );
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(d);
  }
}

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/** Calendar filters use `date_from`; invalid strings must not produce Invalid Date (breaks `.toISOString()` etc.). */
function calendarAnchorDate(dateFrom: string): Date {
  const raw = dateFrom.trim();
  if (!raw) return new Date();
  const d = new Date(raw);
  return isValidDate(d) ? d : new Date();
}

const FILTER_SECTIONS: SocialSectionId[] = [
  'dash',
  'reporting',
  'accounts',
  'strategies',
  'calendar',
  'production',
  'validation',
  'cm',
  'publications',
];

export function SocialContentWorkspace() {
  const { activeBrandId } = useBrand();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const crudRef = useRef<SocialCrudHandle>(null);
  const [section, setSection] = useState<SocialSectionId>('dash');
  const [loading, setLoading] = useState(false);
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'day' | 'kanban'>('week');

  const [platform, setPlatform] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [dash, setDash] = useState<Record<string, unknown> | null>(null);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [strategies, setStrategies] = useState<Record<string, unknown>[]>([]);
  const [calendar, setCalendar] = useState<Record<string, unknown>[]>([]);
  const [production, setProduction] = useState<Record<string, unknown>[]>([]);
  const [cm, setCm] = useState<Record<string, unknown>[]>([]);
  const [publications, setPublications] = useState<Record<string, unknown>[]>([]);

  const filterQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (platform) q.set('platform', platform);
    if (assignedUserId.trim()) q.set('assigned_user_id', assignedUserId.trim());
    if (dateFrom) q.set('date_from', dateFrom);
    if (dateTo) q.set('date_to', dateTo);
    return q.toString();
  }, [platform, assignedUserId, dateFrom, dateTo]);

  const withQuery = (path: string, extra?: Record<string, string>) => {
    const q = new URLSearchParams(filterQuery);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    }
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };

  const refreshDashboard = useCallback(async () => {
    if (!activeBrandId) return;
    const path = filterQuery ? `dashboards/social?${filterQuery}` : 'dashboards/social';
    const r = await api.get<Record<string, unknown>>(path);
    if (r.ok) setDash(r.data);
  }, [activeBrandId, filterQuery]);

  const load = useCallback(async () => {
    if (!activeBrandId) return;
    setLoading(true);
    try {
      if (section === 'dash' || section === 'reporting') {
        const r = await api.get<Record<string, unknown>>(withQuery('dashboards/social'));
        if (r.ok) setDash(r.data);
        else {
          toast.error(r.message);
          setDash(null);
        }
      }

      if (section === 'accounts') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>(withQuery('social-accounts', { per_page: '100' }));
        if (r.ok && isPaginator(r.data)) setAccounts(r.data.data);
        else if (!r.ok) toast.error(r.message);
      }

      if (section === 'strategies') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>(withQuery('strategies', { per_page: '100' }));
        if (r.ok && isPaginator(r.data)) setStrategies(r.data.data);
        else if (!r.ok) toast.error(r.message);
      }

      if (section === 'calendar') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>(
          withQuery('content-calendar', { per_page: '500' })
        );
        if (r.ok && isPaginator(r.data)) setCalendar(r.data.data);
        else if (!r.ok) toast.error(r.message);
      }

      if (section === 'production') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>(
          withQuery('content-production', { per_page: '100' })
        );
        if (r.ok && isPaginator(r.data)) setProduction(r.data.data);
        else if (!r.ok) toast.error(r.message);
      }

      if (section === 'validation') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>(
          withQuery('content-calendar', { status: 'review', per_page: '100' })
        );
        if (r.ok && isPaginator(r.data)) setCalendar(r.data.data);
        else if (!r.ok) toast.error(r.message);
      }

      if (section === 'cm') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>(
          withQuery('cm-daily-tracking', { per_page: '100' })
        );
        if (r.ok && isPaginator(r.data)) setCm(r.data.data);
        else if (!r.ok) toast.error(r.message);
      }

      if (section === 'publications') {
        const r = await api.get<LaravelPaginator<Record<string, unknown>>>(
          withQuery('social-publications', { per_page: '100' })
        );
        if (r.ok && isPaginator(r.data)) setPublications(r.data.data);
        else if (!r.ok) toast.error(r.message);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBrandId, section, filterQuery, toast]);

  const handleMutationSaved = useCallback(() => {
    void refreshDashboard();
    void load();
  }, [refreshDashboard, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = dash?.kpis as Record<string, number> | undefined;
  const charts = dash?.charts as Record<string, unknown> | undefined;

  const statusChartData = useMemo(() => {
    const raw = charts?.contenus_par_statut as Record<string, number> | undefined;
    if (!raw) return [];
    return Object.entries(raw).map(([name, value]) => ({
      name: STATUS_LABELS[name] ?? name,
      value,
    }));
  }, [charts]);

  const platformChartData = useMemo(() => {
    const raw = charts?.publications_par_plateforme as Record<string, number> | undefined;
    if (!raw) return [];
    return Object.entries(raw).map(([name, value]) => ({ name, value }));
  }, [charts]);

  const weeklyData = useMemo(() => {
    const raw = charts?.performance_hebdomadaire as { date: string; published: number }[] | undefined;
    return raw ?? [];
  }, [charts]);

  const cmActivity = useMemo(() => {
    return (charts?.activite_cm as { cm_name?: string; avg_completion?: number; posts?: number }[]) ?? [];
  }, [charts]);

  const onWorkflow = useCallback(
    async (id: number, action: 'submit-review' | 'approve' | 'request-revision' | 'reject') => {
      const paths = {
        'submit-review': `content-calendar/${id}/submit-review`,
        approve: `content-calendar/${id}/approve`,
        'request-revision': `content-calendar/${id}/request-revision`,
        reject: `content-calendar/${id}/reject`,
      };
      const r = await api.post(paths[action]);
      if (r.ok) {
        toast.success(r.message || 'OK');
        void refreshDashboard();
        void load();
      } else toast.error(r.message);
    },
    [refreshDashboard, load, toast],
  );

  const canApproveProduction = hasPermission('content_production.approve');
  const canApproveCmTracking = hasPermission('cm_tracking.approve');

  const setTodayRange = () => {
    const iso = new Date().toISOString().slice(0, 10);
    setDateFrom(iso);
    setDateTo(iso);
  };

  const setThisWeekRange = () => {
    const today = new Date();
    const start = startOfWeek(today);
    const end = addDays(start, 6);
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(end.toISOString().slice(0, 10));
  };

  const onProductionValidate = useCallback(
    async (id: number, status: 'validated' | 'rejected') => {
      const r = await api.patch(`content-production/${id}`, { status });
      if (r.ok) {
        toast.success(r.message || 'OK');
        void refreshDashboard();
        void load();
      } else toast.error(r.message);
    },
    [refreshDashboard, load, toast],
  );

  const onCmValidate = useCallback(
    async (id: number, status: 'validated' | 'rejected') => {
      const r = await api.patch(`cm-daily-tracking/${id}`, { status });
      if (r.ok) {
        toast.success(r.message || 'OK');
        void refreshDashboard();
        void load();
      } else toast.error(r.message);
    },
    [refreshDashboard, load, toast],
  );

  const calendarByStatus = useMemo(() => {
    const buckets: Record<string, Record<string, unknown>[]> = {};
    for (const row of calendar) {
      const st = String(row.status ?? 'draft');
      if (!buckets[st]) buckets[st] = [];
      buckets[st].push(row);
    }
    return buckets;
  }, [calendar]);

  const monthGrid = useMemo(() => {
    const ref = calendarAnchorDate(dateFrom);
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const gridStart = startOfWeek(start);
    const weeks: Date[][] = [];
    let cur = gridStart;
    for (let n = 0; n < 8; n++) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) week.push(addDays(cur, i));
      weeks.push(week);
      cur = addDays(cur, 7);
      if (week[6] >= end) break;
    }
    return { weeks, label: ref.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) };
  }, [dateFrom]);

  const itemsForDay = (day: Date) => {
    const key = day.toDateString();
    return calendar.filter((c) => {
      const p = c.planned_at as string | null;
      if (!p) return false;
      const d = new Date(p);
      return d.toDateString() === key;
    });
  };

  if (!activeBrandId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Social & contenu" subtitle="Choisissez une marque active." />
        <EmptyState title="Marque requise" description="Sélectionnez une marque dans l’en-tête." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social & contenu"
        subtitle="Planning type Meta Planner, workflows CM → SMM, production et reporting."
        right={
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        }
      />

      <div className="flex flex-col xl:flex-row gap-6">
        <nav className="xl:w-56 shrink-0 space-y-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition-colors ${
                section === id ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 space-y-4 min-w-0">
          {FILTER_SECTIONS.includes(section) && (
            <div className="card p-4 flex flex-wrap gap-3 items-end">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Plateforme
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="mt-1 block w-full md:w-44 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold bg-white"
                >
                  {PLATFORM_OPTS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                CM (user id)
                <input
                  value={assignedUserId}
                  onChange={(e) => setAssignedUserId(e.target.value)}
                  placeholder="ex. 12"
                  className="mt-1 block w-full md:w-28 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold bg-white"
                />
              </label>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Du
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1 block rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold bg-white"
                />
              </label>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                Au
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1 block rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold bg-white"
                />
              </label>
            </div>
          )}

          {(section === 'dash' || section === 'reporting') && loading && !dash && (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-3 w-28 bg-zinc-100 rounded mb-3" />
                  <div className="h-8 w-20 bg-zinc-100 rounded" />
                </div>
              ))}
            </div>
          )}

          {(section === 'dash' || section === 'reporting') && !loading && !dash && (
            <EmptyState
              title="Impossible de charger les données"
              description="L’API dashboards/social n’a pas répondu ou vous n’avez pas les permissions (social_accounts.view). Vérifiez le backend, la marque active et réessayez."
              action={
                <button
                  type="button"
                  onClick={() => void load()}
                  className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Réessayer
                </button>
              }
            />
          )}

          {section === 'dash' && dash && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {[
                  ['Contenus planifiés', kpis?.contenus_planifies],
                  ['Contenus publiés', kpis?.contenus_publies],
                  ['En attente validation', kpis?.contenus_attente_validation],
                  ['Stories publiées', kpis?.stories_publiees],
                  ['Posts publiés', kpis?.posts_publies],
                  ['Lives réalisés', kpis?.lives_realises],
                  ['Tournages en cours', kpis?.tournages_en_cours],
                  ['Taux completion CM %', kpis?.taux_completion_cm_pct],
                  ['Performance contenu', kpis?.performance_contenu_score],
                  ['Reach total', kpis?.reach_total],
                  ['Engagement', kpis?.engagement_total],
                  ['Taux validation %', kpis?.taux_validation_pct],
                ].map(([label, val]) => (
                  <div key={label as string} className="card p-4">
                    <p className="text-[10px] font-black uppercase text-zinc-400">{label as string}</p>
                    <p className="text-xl font-black mt-1 tabular-nums">{val ?? '—'}</p>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="card p-4">
                  <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Contenus par statut
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="rgb(59 130 246)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Publications par plateforme
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={platformChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="rgb(34 197 94)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card p-4 lg:col-span-2">
                  <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                    <LineChartIcon className="w-4 h-4" />
                    Performance hebdomadaire (publications / jour)
                  </h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="published" name="Publiés" stroke="rgb(59 130 246)" strokeWidth={2} dot />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card p-4 lg:col-span-2">
                  <h3 className="text-sm font-black mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Activité CM
                  </h3>
                  <DataTable
                    rows={cmActivity}
                    loading={loading}
                    density="compact"
                    columns={[
                      { key: 'n', header: 'CM', cell: (r) => String(r.cm_name ?? r.cm_user_id ?? '') },
                      { key: 'c', header: 'Complétion %', cell: (r) => String(r.avg_completion ?? '') },
                      { key: 'p', header: 'Posts', cell: (r) => String(r.posts ?? '') },
                      { key: 's', header: 'Stories', cell: (r) => String(r.stories ?? '') },
                      { key: 'l', header: 'Lives', cell: (r) => String(r.lives ?? '') },
                    ]}
                    emptyTitle="Pas d’activité CM"
                    emptyDescription="Les données apparaissent avec le suivi quotidien CM."
                  />
                </div>
              </div>
            </>
          )}

          {section === 'reporting' && dash && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">
                Synthèse engagement et validation sur la période filtrée (identique au tableau de bord, vue reporting).
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['Reach total', kpis?.reach_total],
                  ['Engagement', kpis?.engagement_total],
                  ['Posts publiés', kpis?.posts_publies],
                  ['Stories', kpis?.stories_publiees],
                  ['Top plateforme', platformChartData[0]?.name ?? '—'],
                  ['Taux validation %', kpis?.taux_validation_pct],
                  ['Complétion CM %', kpis?.taux_completion_cm_pct],
                  ['Contenus validés (approx.)', kpis?.taux_validation_pct],
                ].map(([label, val]) => (
                  <div key={label as string} className="card p-4">
                    <p className="text-[10px] font-black uppercase text-zinc-400">{label as string}</p>
                    <p className="text-lg font-black mt-1">{String(val ?? '—')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'accounts' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                {hasPermission('social_accounts.create') && (
                  <button
                    type="button"
                    onClick={() => crudRef.current?.openAccount()}
                    className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nouveau compte
                  </button>
                )}
              </div>
              <DataTable<Record<string, unknown>>
                rows={accounts}
                loading={loading}
                emptyAction={
                  hasPermission('social_accounts.create') ? (
                    <button
                      type="button"
                      onClick={() => crudRef.current?.openAccount()}
                      className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Créer un compte
                    </button>
                  ) : undefined
                }
                columns={[
                  {
                    key: 'platform',
                    header: 'Plateforme',
                    cell: (r) => String(r.platform ?? ''),
                  },
                  {
                    key: 'account_name',
                    header: 'Nom / compte',
                    cell: (r) => String(r.account_name ?? ''),
                  },
                  {
                    key: 'handle',
                    header: '@handle',
                    cell: (r) => String(r.handle ?? '—'),
                  },
                  {
                    key: 'profile_url',
                    header: 'Profil',
                    cell: (r) =>
                      r.profile_url ? (
                        <a
                          href={String(r.profile_url)}
                          className="text-primary-600 font-semibold truncate max-w-[140px] inline-block"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Lien
                        </a>
                      ) : (
                        '—'
                      ),
                  },
                  {
                    key: 'resp',
                    header: 'Responsable',
                    cell: (r) => {
                      const resp = r.responsible as { name?: string } | undefined;
                      return resp?.name ?? '—';
                    },
                  },
                  {
                    key: 'api',
                    header: 'API',
                    cell: (r) => (r.api_connected ? 'Oui' : 'Non'),
                  },
                  {
                    key: 'fol',
                    header: 'Followers',
                    cell: (r) => String(r.follower_count ?? '—'),
                  },
                  {
                    key: 'status',
                    header: 'Statut',
                    cell: (r) => statusPill(String(r.status), { active: 'Actif', inactive: 'Inactif' }),
                  },
                  ...(hasPermission('social_accounts.update')
                    ? ([
                        {
                          key: 'actions',
                          header: '',
                          className: 'w-14',
                          cell: (r: Record<string, unknown>) => (
                            <button
                              type="button"
                              title="Modifier"
                              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
                              onClick={() => crudRef.current?.openAccount(Number(r.id))}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ),
                        },
                      ] as const)
                    : []),
                ]}
                emptyTitle="Aucun compte social"
                emptyDescription="Ajoutez les comptes Meta, TikTok, etc. pour cette marque."
              />
            </div>
          )}

          {section === 'strategies' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                {hasPermission('strategies.create') && (
                  <button
                    type="button"
                    onClick={() => crudRef.current?.openStrategy()}
                    className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nouvelle stratégie
                  </button>
                )}
              </div>
              <DataTable<Record<string, unknown>>
                rows={strategies}
                loading={loading}
                emptyAction={
                  hasPermission('strategies.create') ? (
                    <button
                      type="button"
                      onClick={() => crudRef.current?.openStrategy()}
                      className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Créer une stratégie
                    </button>
                  ) : undefined
                }
                columns={[
                  { key: 'title', header: 'Titre', cell: (r) => String(r.title ?? '') },
                  {
                    key: 'period',
                    header: 'Période',
                    cell: (r) =>
                      `${fmtDate(r.period_start as string)} → ${fmtDate(r.period_end as string)}`,
                  },
                  {
                    key: 'obj',
                    header: 'Objectif',
                    cell: (r) => String(r.marketing_objective ?? '—').slice(0, 80),
                  },
                  {
                    key: 'status',
                    header: 'Statut',
                    cell: (r) => statusPill(String(r.status), { draft: 'Brouillon', review: 'Revue', approved: 'Approuvé', archived: 'Archivé' }),
                  },
                  {
                    key: 'cm',
                    header: 'CM assigné',
                    cell: (r) => {
                      const cmUser = r.assigned_cm as { name?: string } | undefined;
                      return cmUser?.name ?? '—';
                    },
                  },
                  ...(hasPermission('strategies.update')
                    ? ([
                        {
                          key: 'actions',
                          header: '',
                          className: 'w-14',
                          cell: (r: Record<string, unknown>) => (
                            <button
                              type="button"
                              title="Modifier"
                              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
                              onClick={() => crudRef.current?.openStrategy(Number(r.id))}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ),
                        },
                      ] as const)
                    : []),
                ]}
                emptyTitle="Aucune stratégie"
                emptyDescription="Définissez objectifs, période et CM pour piloter le contenu."
              />
            </div>
          )}

          {section === 'calendar' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['month', 'Mois', CalendarDays],
                      ['week', 'Semaine', CalendarDays],
                      ['day', 'Jour', CalendarDays],
                      ['kanban', 'Kanban', Kanban],
                    ] as const
                  ).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCalendarView(id)}
                      className={`px-3 py-2 rounded-xl text-xs font-black inline-flex items-center gap-2 ${
                        calendarView === id ? 'bg-primary-600 text-white' : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={setTodayRange}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  >
                    Aujourd&apos;hui
                  </button>
                  <button
                    type="button"
                    onClick={setThisWeekRange}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  >
                    Cette semaine
                  </button>
                  {hasPermission('content_calendar.create') && (
                    <button
                      type="button"
                      onClick={() => crudRef.current?.openCalendar()}
                      className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-xs font-black inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Nouveau contenu
                    </button>
                  )}
                </div>
              </div>

              {calendarView === 'kanban' && (
                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
                  {['planned', 'in_production', 'review', 'approved', 'published'].map((st) => (
                    <div key={st} className="card p-3 min-h-[200px]">
                      <p className="text-[11px] font-black uppercase text-zinc-500 mb-2">
                        {STATUS_LABELS[st] ?? st}
                      </p>
                      <div className="space-y-2">
                        {(calendarByStatus[st] ?? []).map((row) => (
                          <button
                            key={String(row.id)}
                            type="button"
                            className="w-full text-left rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 text-sm hover:bg-zinc-100 transition-colors"
                            onClick={() => crudRef.current?.openCalendar(Number(row.id))}
                          >
                            <p className="font-black">{String(row.title ?? '')}</p>
                            <p className="text-xs text-zinc-500 mt-1">
                              {String(row.content_type ?? '')} · {fmtDateTime(row.planned_at as string)}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {calendarView === 'month' && (
                <div className="card p-4 overflow-x-auto">
                  <p className="text-sm font-black mb-4 capitalize">{monthGrid.label}</p>
                  <div className="grid grid-cols-7 gap-1 min-w-[720px]">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                      <div key={d} className="text-[10px] font-black text-zinc-400 text-center py-1">
                        {d}
                      </div>
                    ))}
                    {monthGrid.weeks.flatMap((week, wi) =>
                      week.map((day, di) => {
                        const items = itemsForDay(day);
                        const muted = day.getMonth() !== calendarAnchorDate(dateFrom).getMonth();
                        return (
                          <div
                            key={`${wi}-${di}-${isValidDate(day) ? day.getTime() : 'inv'}`}
                            className={`min-h-[100px] rounded-xl border p-2 text-xs ${muted ? 'opacity-40 bg-zinc-50' : 'bg-white border-zinc-100'}`}
                          >
                            <p className="font-black text-zinc-700">{day.getDate()}</p>
                            <div className="mt-1 space-y-1">
                              {items.slice(0, 3).map((it) => (
                                <div key={String(it.id)} className="truncate rounded-lg bg-primary-50 text-primary-800 px-1.5 py-0.5">
                                  {String(it.title ?? '')}
                                </div>
                              ))}
                              {items.length > 3 && (
                                <p className="text-[10px] text-zinc-400">+{items.length - 3}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {calendarView === 'week' && (
                <div className="card p-4">
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const base = startOfWeek(calendarAnchorDate(dateFrom));
                      const day = addDays(base, i);
                      const items = itemsForDay(day);
                      return (
                        <div key={i} className="rounded-xl border border-zinc-100 p-2 min-h-[220px]">
                          <p className="text-[11px] font-black text-zinc-500">
                            {day.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                          </p>
                          <div className="mt-2 space-y-2">
                            {items.map((it) => (
                              <div key={String(it.id)} className="rounded-lg bg-zinc-50 p-2 text-xs">
                                <p className="font-bold">{String(it.title ?? '')}</p>
                                <p className="text-[10px] text-zinc-500">{fmtDateTime(it.planned_at as string)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {calendarView === 'day' && (
                <div className="card p-4 space-y-3">
                  <p className="text-sm font-black">
                    {calendarAnchorDate(dateFrom).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                  {calendar
                    .filter((c) => {
                      const p = c.planned_at as string | null;
                      if (!p) return false;
                      const d = new Date(p).toDateString();
                      const ref = calendarAnchorDate(dateFrom).toDateString();
                      return d === ref;
                    })
                    .map((row) => (
                      <div key={String(row.id)} className="flex justify-between gap-4 rounded-2xl border border-zinc-100 p-4">
                        <div>
                          <p className="font-black">{String(row.title ?? '')}</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            {String(row.content_type ?? '')} · {fmtDateTime(row.planned_at as string)}
                          </p>
                        </div>
                        <span className="text-xs font-bold uppercase text-primary-600 shrink-0">
                          {STATUS_LABELS[String(row.status)] ?? row.status}
                        </span>
                      </div>
                    ))}
                  {calendar.filter((c) => {
                    const p = c.planned_at as string | null;
                    if (!p) return false;
                    return new Date(p).toDateString() === calendarAnchorDate(dateFrom).toDateString();
                  }).length === 0 && (
                    <EmptyState title="Rien ce jour" description="Changez la date « Du » ou ajoutez du contenu." />
                  )}
                </div>
              )}

              <DataTable<Record<string, unknown>>
                rows={calendar}
                loading={loading}
                emptyAction={
                  hasPermission('content_calendar.create') ? (
                    <button
                      type="button"
                      onClick={() => crudRef.current?.openCalendar()}
                      className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Planifier un contenu
                    </button>
                  ) : undefined
                }
                columns={[
                  { key: 't', header: 'Titre', cell: (r) => String(r.title ?? '') },
                  { key: 'type', header: 'Type', cell: (r) => String(r.content_type ?? '') },
                  {
                    key: 'plat',
                    header: 'Plateforme',
                    cell: (r) => {
                      const sa = r.social_account as { platform?: string } | undefined;
                      const direct = r.platform as string | undefined;
                      return direct || sa?.platform || '—';
                    },
                  },
                  {
                    key: 'cm',
                    header: 'CM',
                    cell: (r) => {
                      const a = r.assignee as { name?: string } | undefined;
                      return a?.name ?? '—';
                    },
                  },
                  { key: 'when', header: 'Publication', cell: (r) => fmtDateTime(r.planned_at as string) },
                  {
                    key: 'st',
                    header: 'Statut',
                    cell: (r) => statusPill(String(r.status), STATUS_LABELS),
                  },
                  {
                    key: 'wf',
                    header: 'Workflow',
                    cell: (r) => (
                      <div className="flex flex-wrap gap-1">
                        {String(r.status) !== 'review' && ['draft', 'planned', 'in_production'].includes(String(r.status)) && (
                          <button
                            type="button"
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-zinc-100"
                            onClick={() => void onWorkflow(Number(r.id), 'submit-review')}
                          >
                            <Send className="w-3 h-3 inline mr-1" />
                            Soumettre
                          </button>
                        )}
                      </div>
                    ),
                  },
                  ...(hasPermission('content_calendar.update')
                    ? ([
                        {
                          key: 'edit',
                          header: '',
                          className: 'w-14',
                          cell: (r: Record<string, unknown>) => (
                            <button
                              type="button"
                              title="Modifier"
                              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
                              onClick={() => crudRef.current?.openCalendar(Number(r.id))}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ),
                        },
                      ] as const)
                    : []),
                ]}
                emptyTitle="Aucun contenu sur cette période"
                emptyDescription="Élargissez les filtres dates ou créez une entrée au calendrier."
              />
            </div>
          )}

          {section === 'production' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                {hasPermission('content_production.create') && (
                  <button
                    type="button"
                    onClick={() => crudRef.current?.openProduction()}
                    className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nouvelle tâche
                  </button>
                )}
              </div>
              <DataTable<Record<string, unknown>>
                rows={production}
                loading={loading}
                emptyAction={
                  hasPermission('content_production.create') ? (
                    <button
                      type="button"
                      onClick={() => crudRef.current?.openProduction()}
                      className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Créer une tâche
                    </button>
                  ) : undefined
                }
                columns={[
                  { key: 'title', header: 'Titre', cell: (r) => String(r.title ?? '') },
                  { key: 'type', header: 'Type', cell: (r) => String(r.production_type ?? '') },
                  { key: 'loc', header: 'Lieu', cell: (r) => String(r.location ?? '—') },
                  { key: 'd', header: 'Date', cell: (r) => fmtDate(r.shoot_date as string) },
                  {
                    key: 'st',
                    header: 'Statut',
                    cell: (r) => statusPill(String(r.status), PROD_STATUS_LABELS),
                  },
                  {
                    key: 'val',
                    header: 'Validation',
                    cell: (r) =>
                      canApproveProduction && String(r.status) === 'submitted' ? (
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800"
                            onClick={() => void onProductionValidate(Number(r.id), 'validated')}
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-red-100 text-red-800"
                            onClick={() => void onProductionValidate(Number(r.id), 'rejected')}
                          >
                            Rejeter
                          </button>
                        </div>
                      ) : (
                        '—'
                      ),
                  },
                  ...(hasPermission('content_production.update')
                    ? ([
                        {
                          key: 'actions',
                          header: '',
                          className: 'w-14',
                          cell: (r: Record<string, unknown>) => (
                            <button
                              type="button"
                              title="Modifier"
                              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
                              onClick={() => crudRef.current?.openProduction(Number(r.id))}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ),
                        },
                      ] as const)
                    : []),
                ]}
                emptyTitle="Aucune tâche de production"
                emptyDescription="Liez un créneau au calendrier éditorial pour suivre tournage ou montage."
              />
            </div>
          )}

          {section === 'validation' && (
            <DataTable<Record<string, unknown>>
              rows={calendar}
              loading={loading}
              columns={[
                { key: 'title', header: 'Contenu', cell: (r) => String(r.title ?? '') },
                {
                  key: 'cm',
                  header: 'CM',
                  cell: (r) => {
                    const a = r.assignee as { name?: string } | undefined;
                    return a?.name ?? '—';
                  },
                },
                { key: 'sub', header: 'Soumis / prévu', cell: (r) => fmtDateTime(r.planned_at as string) },
                {
                  key: 'st',
                  header: 'Statut',
                  cell: (r) => statusPill(String(r.status), STATUS_LABELS),
                },
                {
                  key: 'smm',
                  header: 'Validateur',
                  cell: (r) => {
                    const v = r.validated_by_user as { name?: string } | undefined;
                    return v?.name ?? '—';
                  },
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  cell: (r) =>
                    hasPermission('content_calendar.approve') ? (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800"
                          onClick={() => void onWorkflow(Number(r.id), 'approve')}
                        >
                          Approuver
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-amber-100 text-amber-900"
                          onClick={() => void onWorkflow(Number(r.id), 'request-revision')}
                        >
                          Révision
                        </button>
                        <button
                          type="button"
                          className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-red-100 text-red-800"
                          onClick={() => void onWorkflow(Number(r.id), 'reject')}
                        >
                          Rejeter
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-400 font-semibold">Validation réservée SMM / Admin</span>
                    ),
                },
                ...(hasPermission('content_calendar.update')
                  ? ([
                      {
                        key: 'edit',
                        header: '',
                        className: 'w-14',
                        cell: (r: Record<string, unknown>) => (
                          <button
                            type="button"
                            title="Modifier"
                            className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
                            onClick={() => crudRef.current?.openCalendar(Number(r.id))}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        ),
                      },
                    ] as const)
                  : []),
              ]}
              emptyTitle="File vide"
              emptyDescription="Aucun contenu en statut « revue »."
            />
          )}

          {section === 'cm' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                {hasPermission('cm_tracking.create') && (
                  <button
                    type="button"
                    onClick={() => crudRef.current?.openCm()}
                    className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nouveau suivi
                  </button>
                )}
              </div>
              <DataTable<Record<string, unknown>>
                rows={cm}
                loading={loading}
                emptyAction={
                  hasPermission('cm_tracking.create') ? (
                    <button
                      type="button"
                      onClick={() => crudRef.current?.openCm()}
                      className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Enregistrer un suivi
                    </button>
                  ) : undefined
                }
                columns={[
                  {
                    key: 'cm',
                    header: 'CM',
                    cell: (r) => {
                      const u = r.cm_user as { name?: string } | undefined;
                      return u?.name ?? String(r.cm_user_id ?? '');
                    },
                  },
                  { key: 'd', header: 'Date', cell: (r) => String(r.work_date ?? '') },
                  { key: 'p', header: 'Posts', cell: (r) => String(r.posts_done ?? '') },
                  { key: 's', header: 'Stories', cell: (r) => String(r.stories_done ?? '') },
                  { key: 'l', header: 'Lives', cell: (r) => String(r.lives_done ?? '') },
                  { key: 'tasks', header: 'Tâches', cell: (r) => String(r.tasks_done ?? '') },
                  { key: 'pct', header: 'Complétion %', cell: (r) => String(r.completion_percentage ?? '') },
                  {
                    key: 'st',
                    header: 'Statut',
                    cell: (r) => statusPill(String(r.status), CM_STATUS_LABELS),
                  },
                  {
                    key: 'val',
                    header: 'Validation',
                    cell: (r) =>
                      canApproveCmTracking && String(r.status) === 'submitted' ? (
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800"
                            onClick={() => void onCmValidate(Number(r.id), 'validated')}
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-red-100 text-red-800"
                            onClick={() => void onCmValidate(Number(r.id), 'rejected')}
                          >
                            Rejeter
                          </button>
                        </div>
                      ) : (
                        '—'
                      ),
                  },
                  ...(hasPermission('cm_tracking.update')
                    ? ([
                        {
                          key: 'actions',
                          header: '',
                          className: 'w-14',
                          cell: (r: Record<string, unknown>) => (
                            <button
                              type="button"
                              title="Modifier"
                              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
                              onClick={() => crudRef.current?.openCm(Number(r.id))}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ),
                        },
                      ] as const)
                    : []),
                ]}
                emptyTitle="Pas de suivi CM"
                emptyDescription="Les CM saisissent posts, stories et complétion pour la journée."
              />
            </div>
          )}

          {section === 'publications' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                {hasPermission('social_publications.create') && (
                  <button
                    type="button"
                    onClick={() => crudRef.current?.openPublication()}
                    className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Nouvelle publication
                  </button>
                )}
              </div>
              <DataTable<Record<string, unknown>>
                rows={publications}
                loading={loading}
                emptyAction={
                  hasPermission('social_publications.create') ? (
                    <button
                      type="button"
                      onClick={() => crudRef.current?.openPublication()}
                      className="px-5 py-2.5 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Enregistrer une publication
                    </button>
                  ) : undefined
                }
                columns={[
                  { key: 'title', header: 'Contenu', cell: (r) => String(r.title ?? '') },
                  { key: 'plat', header: 'Plateforme', cell: (r) => String(r.platform ?? '') },
                  { key: 'pub', header: 'Publié', cell: (r) => fmtDateTime(r.published_at as string) },
                  { key: 'reach', header: 'Reach', cell: (r) => String(r.reach ?? '—') },
                  { key: 'likes', header: 'Likes', cell: (r) => String(r.likes ?? '—') },
                  { key: 'com', header: 'Commentaires', cell: (r) => String(r.comments ?? '—') },
                  { key: 'sha', header: 'Partages', cell: (r) => String(r.shares ?? '—') },
                  ...(hasPermission('social_publications.update')
                    ? ([
                        {
                          key: 'actions',
                          header: '',
                          className: 'w-14',
                          cell: (r: Record<string, unknown>) => (
                            <button
                              type="button"
                              title="Modifier"
                              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
                              onClick={() => crudRef.current?.openPublication(Number(r.id))}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          ),
                        },
                      ] as const)
                    : []),
                ]}
                emptyTitle="Aucune publication enregistrée"
                emptyDescription="Saisissez les métriques après diffusion ou connectez l’API plus tard."
              />
            </div>
          )}
        </div>
      </div>

      <SocialCrudModals
        ref={crudRef}
        activeBrandId={activeBrandId}
        toast={toast}
        onSaved={handleMutationSaved}
      />
    </div>
  );
}
