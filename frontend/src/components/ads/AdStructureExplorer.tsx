import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { DataTable, type Column } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';
import { StatusChip } from '../ui/StatusChip';
import { formatCurrency } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';
import * as api from '../../lib/api';

export type StructureRollup = {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  messages: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
};

type AdSetRow = {
  id: number;
  name: string;
  external_ad_set_id: string | null;
  status: string | null;
  effective_status: string | null;
  optimization_goal: string | null;
  billing_event: string | null;
  bid_strategy: string | null;
  daily_budget: string | null;
  lifetime_budget: string | null;
  targeting_summary: string | null;
  ads_count: number;
  metrics_rollups: StructureRollup | null;
};

type AdRow = {
  id: number;
  name: string;
  status: string | null;
  effective_status: string | null;
  creative_name: string | null;
  creative_title: string | null;
  creative_body: string | null;
  creative_thumbnail_url: string | null;
  creative_permalink: string | null;
  creative_call_to_action: string | null;
  metrics_rollups: StructureRollup | null;
};

/** ACTIVE / PAUSED / … → libellé + couleur façon Ads Manager. */
function deliveryChip(status: string | null): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  const s = (status ?? '').toUpperCase();
  if (s === 'ACTIVE') return { label: 'Diffusion active', tone: 'success' };
  if (s === 'PAUSED' || s === 'ADSET_PAUSED' || s === 'CAMPAIGN_PAUSED') return { label: 'En pause', tone: 'warning' };
  if (s === 'PENDING_REVIEW' || s === 'IN_PROCESS') return { label: 'En vérification', tone: 'neutral' };
  if (s === 'DISAPPROVED' || s === 'WITH_ISSUES') return { label: 'Refusée', tone: 'danger' };
  if (s === 'ARCHIVED' || s === 'DELETED') return { label: 'Archivée', tone: 'neutral' };
  return { label: s ? s.toLowerCase().replace(/_/g, ' ') : '—', tone: 'neutral' };
}

const AD_INPUT = 'mt-1.5 w-full px-4 py-3 rounded-xl border border-zinc-300 bg-white text-sm font-medium text-zinc-900';
const AD_LABEL = 'block text-sm font-bold text-zinc-900';

/** Appels à l'action acceptés par Meta pour une publicité avec lien. */
const CTA_OPTIONS = [
  { value: 'SHOP_NOW', label: 'Acheter' },
  { value: 'ORDER_NOW', label: 'Commander' },
  { value: 'LEARN_MORE', label: 'En savoir plus' },
  { value: 'WHATSAPP_MESSAGE', label: 'Envoyer un message WhatsApp' },
  { value: 'MESSAGE_PAGE', label: 'Envoyer un message' },
  { value: 'CONTACT_US', label: 'Nous contacter' },
  { value: 'CALL_NOW', label: 'Appeler' },
  { value: 'SIGN_UP', label: "S'inscrire" },
  { value: 'GET_OFFER', label: "Obtenir l'offre" },
];

const GOALS: Record<string, string> = {
  OFFSITE_CONVERSIONS: 'Conversions',
  LINK_CLICKS: 'Clics sortants',
  LEAD_GENERATION: 'Prospects',
  IMPRESSIONS: 'Impressions',
  REACH: 'Couverture',
  CONVERSATIONS: 'Conversations',
  THRUPLAY: 'Vues de vidéo',
  LANDING_PAGE_VIEWS: 'Vues de page de destination',
};

function num(v: number | null | undefined, digits = 0): string {
  if (v == null) return '—';
  return v.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Colonnes de métriques communes aux ensembles et aux publicités. */
function metricColumns<T extends { metrics_rollups: StructureRollup | null }>(currency: string): Column<T>[] {
  const m = (r: T) => r.metrics_rollups;
  return [
    {
      key: 'spend',
      header: 'Montant dépensé',
      className: 'text-right',
      cell: (r) => <span className="font-black">{m(r) ? formatCurrency(m(r)!.spend, currency) : '—'}</span>,
    },
    { key: 'reach', header: 'Couverture', className: 'text-right', cell: (r) => <span>{num(m(r)?.reach)}</span> },
    { key: 'impr', header: 'Impressions', className: 'text-right', cell: (r) => <span>{num(m(r)?.impressions)}</span> },
    { key: 'clicks', header: 'Clics', className: 'text-right', cell: (r) => <span>{num(m(r)?.clicks)}</span> },
    {
      key: 'ctr',
      header: 'CTR',
      className: 'text-right',
      cell: (r) => <span>{m(r)?.ctr != null ? `${num(m(r)!.ctr, 2)} %` : '—'}</span>,
    },
    { key: 'leads', header: 'Résultats', className: 'text-right', cell: (r) => <span>{num(m(r)?.leads)}</span> },
    {
      key: 'cpl',
      header: 'Coût par résultat',
      className: 'text-right',
      cell: (r) => <span>{m(r)?.cpl != null ? formatCurrency(m(r)!.cpl!, currency) : '—'}</span>,
    },
    {
      key: 'cpc',
      header: 'CPC',
      className: 'text-right',
      cell: (r) => <span>{m(r)?.cpc != null ? formatCurrency(m(r)!.cpc!, currency) : '—'}</span>,
    },
    {
      key: 'cpm',
      header: 'CPM',
      className: 'text-right',
      cell: (r) => <span>{m(r)?.cpm != null ? formatCurrency(m(r)!.cpm!, currency) : '—'}</span>,
    },
  ];
}

/**
 * Campagne → ensembles de publicités → publicités, avec les mêmes colonnes
 * que le gestionnaire de publicités Meta.
 */
export function AdStructureExplorer({
  campaignId,
  campaignName,
  periodFrom,
  periodTo,
  canSync,
  onBack,
}: {
  campaignId: number;
  campaignName: string;
  periodFrom: string;
  periodTo: string;
  canSync: boolean;
  onBack: () => void;
}) {
  const toast = useToast();
  const [adSets, setAdSets] = useState<AdSetRow[]>([]);
  const [ads, setAds] = useState<AdRow[]>([]);
  const [openAdSet, setOpenAdSet] = useState<{ id: number; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // L'ensemble qui recevra la publicite : jamais demande, toujours deduit du
  // contexte (l'ensemble ouvert, ou la ligne sur laquelle on a clique).
  const [createTarget, setCreateTarget] = useState<{ id: number; name: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    message: '',
    title: '',
    link: '',
    cta: '',
    imageBase64: '',
    imagePreview: '',
  });
  // Devise du compte publicitaire Meta (souvent USD), pas celle des commandes.
  const [currency, setCurrency] = useState('USD');
  const [adSetOpen, setAdSetOpen] = useState(false);
  const [adSetError, setAdSetError] = useState<string | null>(null);
  const [adSetForm, setAdSetForm] = useState({ name: '', daily_budget: '', age_min: '18', age_max: '65', countries: 'MA' });

  const qs = useMemo(
    () => new URLSearchParams({ metrics_from: periodFrom, metrics_to: periodTo }).toString(),
    [periodFrom, periodTo],
  );

  const loadAdSets = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ ad_sets: AdSetRow[]; currency?: string }>(`campaigns/${campaignId}/ad-sets?${qs}`);
    setLoading(false);
    if (res.ok && res.data) {
      setAdSets(res.data.ad_sets ?? []);
      if (res.data.currency) setCurrency(res.data.currency);
    }
  }, [campaignId, qs]);

  const loadAds = useCallback(
    async (adSetId: number) => {
      setLoading(true);
      const res = await api.get<{ ads: AdRow[]; currency?: string }>(`ad-sets/${adSetId}/ads?${qs}`);
      setLoading(false);
      if (res.ok && res.data) {
        setAds(res.data.ads ?? []);
        if (res.data.currency) setCurrency(res.data.currency);
      }
    },
    [qs],
  );

  useEffect(() => {
    void loadAdSets();
  }, [loadAdSets]);

  useEffect(() => {
    if (openAdSet) void loadAds(openAdSet.id);
  }, [openAdSet, loadAds]);

  async function sync() {
    setSyncing(true);
    const res = await api.post(`ad-structure/sync?${qs}`, {});
    setSyncing(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(res.message);
    await loadAdSets();
    if (openAdSet) await loadAds(openAdSet.id);
  }

  /** Le fichier est lu en base64 : Meta l'accepte tel quel sur /adimages. */
  async function pickImage(file: File | null) {
    if (!file) {
      setForm((f) => ({ ...f, imageBase64: '', imagePreview: '' }));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setCreateError('Image trop lourde : 4 Mo maximum.');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('lecture impossible'));
      reader.readAsDataURL(file);
    });
    setCreateError(null);
    setForm((f) => ({ ...f, imageBase64: dataUrl, imagePreview: dataUrl }));
  }

  async function publishAdSet() {
    setAdSetError(null);
    setPublishing(true);
    const res = await api.post(`campaigns/${campaignId}/ad-sets`, {
      name: adSetForm.name,
      daily_budget: Number(adSetForm.daily_budget),
      age_min: Number(adSetForm.age_min),
      age_max: Number(adSetForm.age_max),
      countries: adSetForm.countries.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
    });
    setPublishing(false);
    if (!res.ok) { setAdSetError(res.message); return; }
    toast.success(res.message);
    setAdSetOpen(false);
    setAdSetForm({ name: '', daily_budget: '', age_min: '18', age_max: '65', countries: 'MA' });
    await loadAdSets();
  }

  async function publishAd() {
    const targetId = createTarget?.id ?? openAdSet?.id ?? 0;
    if (!targetId) {
      setCreateError('Ensemble de publicités introuvable : rouvrez-le et réessayez.');
      return;
    }
    if (!form.name.trim() || !form.message.trim()) {
      setCreateError('Le nom et le texte de la publicité sont obligatoires.');
      return;
    }
    setPublishing(true);
    setCreateError(null);

    const res = await api.post(`ad-sets/${targetId}/ads`, {
      name: form.name.trim(),
      message: form.message.trim(),
      title: form.title.trim() || null,
      link: form.link.trim() || null,
      call_to_action: form.cta || null,
      image_base64: form.imageBase64 || null,
    });

    setPublishing(false);
    if (!res.ok) {
      setCreateError(res.message);
      toast.error(res.message);
      return;
    }

    toast.success(res.message);
    setCreateOpen(false);
    setForm({ name: '', message: '', title: '', link: '', cta: '', imageBase64: '', imagePreview: '' });
    setCreateTarget(null);
    if (openAdSet) {
      await loadAds(openAdSet.id);
    } else {
      await loadAdSets();
    }
  }

  const adSetColumns: Column<AdSetRow>[] = [
    {
      key: 'name',
      header: 'Ensemble de publicités',
      cell: (r) => (
        <button
          type="button"
          onClick={() => setOpenAdSet({ id: r.id, name: r.name })}
          className="text-left font-black text-primary-600 hover:underline"
        >
          {r.name}
          <span className="block text-[11px] font-medium text-zinc-500">
            {r.ads_count} publicité{r.ads_count > 1 ? 's' : ''}
            {r.targeting_summary ? ` · ${r.targeting_summary}` : ''}
          </span>
        </button>
      ),
    },
    {
      key: 'delivery',
      header: 'Diffusion',
      cell: (r) => {
        const chip = deliveryChip(r.effective_status ?? r.status);
        return <StatusChip tone={chip.tone}>{chip.label}</StatusChip>;
      },
    },
    {
      key: 'budget',
      header: 'Budget',
      className: 'text-right',
      cell: (r) => {
        const daily = r.daily_budget ? Number(r.daily_budget) : null;
        const lifetime = r.lifetime_budget ? Number(r.lifetime_budget) : null;
        if (daily) return <span className="font-bold">{formatCurrency(daily, currency)} <span className="text-[10px] text-zinc-400">/ jour</span></span>;
        if (lifetime) return <span className="font-bold">{formatCurrency(lifetime, currency)} <span className="text-[10px] text-zinc-400">total</span></span>;
        return <span className="text-zinc-400">—</span>;
      },
    },
    {
      key: 'goal',
      header: 'Optimisation',
      cell: (r) => <span className="text-xs font-semibold text-zinc-600">{GOALS[r.optimization_goal ?? ''] ?? r.optimization_goal ?? '—'}</span>,
    },
    ...metricColumns<AdSetRow>(currency),
    {
      key: 'newAd',
      header: '',
      className: 'text-right',
      cell: (r) =>
        canSync && r.external_ad_set_id ? (
          <button
            type="button"
            title={`Créer une publicité dans « ${r.name} »`}
            onClick={() => {
              setCreateError(null);
              setCreateTarget({ id: r.id, name: r.name });
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-black text-primary-700 hover:bg-primary-100"
          >
            <Plus className="w-3 h-3" /> Publicité
          </button>
        ) : null,
    },
  ];

  const adColumns: Column<AdRow>[] = [
    {
      key: 'name',
      header: 'Publicité',
      cell: (r) => (
        <div className="flex items-start gap-3">
          {r.creative_thumbnail_url ? (
            <img src={r.creative_thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-zinc-200 shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-black text-zinc-900 truncate">{r.name}</p>
            {r.creative_title && <p className="text-[11px] font-bold text-zinc-600 truncate">{r.creative_title}</p>}
            {r.creative_body && <p className="text-[11px] text-zinc-500 line-clamp-2">{r.creative_body}</p>}
            {r.creative_permalink && (
              <a
                href={r.creative_permalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 hover:underline"
              >
                Voir la publication <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'delivery',
      header: 'Diffusion',
      cell: (r) => {
        const chip = deliveryChip(r.effective_status ?? r.status);
        return <StatusChip tone={chip.tone}>{chip.label}</StatusChip>;
      },
    },
    {
      key: 'cta',
      header: 'Appel à l’action',
      cell: (r) => <span className="text-xs font-semibold text-zinc-600">{r.creative_call_to_action?.replace(/_/g, ' ').toLowerCase() ?? '—'}</span>,
    },
    ...metricColumns<AdRow>(currency),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (openAdSet ? setOpenAdSet(null) : onBack())}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-sm font-black text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">
              {openAdSet ? 'Publicités de l’ensemble' : 'Ensembles de publicités'}
            </p>
            <p className="text-lg font-black text-zinc-900">{openAdSet ? openAdSet.name : campaignName}</p>
          </div>
        </div>
        {canSync && (
          <div className="flex flex-wrap gap-2">
            {openAdSet && (
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateTarget(openAdSet);
                  setCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-primary-200 bg-primary-50 text-primary-700 text-sm font-black"
              >
                <Plus className="w-4 h-4" /> Nouvelle publicité
              </button>
            )}
            {!openAdSet && (
              <button
                type="button"
                onClick={() => { setAdSetError(null); setAdSetOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-primary-200 bg-primary-50 text-primary-700 text-sm font-black"
              >
                <Plus className="w-4 h-4" /> Nouvel ensemble de publicités
              </button>
            )}
            <button
              type="button"
              onClick={() => void sync()}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Import…' : 'Importer depuis Meta'}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm font-bold text-zinc-500">Chargement…</div>
      ) : openAdSet ? (
        ads.length === 0 ? (
          <EmptyState
            title="Aucune publicité"
            description="Lancez « Importer depuis Meta » pour récupérer les publicités et leurs créatifs."
          />
        ) : (
          <DataTable<AdRow> rows={ads} columns={adColumns} density="comfortable" emptyTitle="Aucune publicité" />
        )
      ) : adSets.length === 0 ? (
        <EmptyState
          title="Aucun ensemble de publicités"
          description="Lancez « Importer depuis Meta » pour récupérer les ensembles, les publicités et leurs statistiques."
        />
      ) : (
        <DataTable<AdSetRow> rows={adSets} columns={adSetColumns} density="comfortable" emptyTitle="Aucun ensemble" />
      )}

      <Modal
        open={adSetOpen}
        title="Nouvel ensemble de publicités"
        subtitle={`Créé EN PAUSE dans « ${campaignName} » — le ciblage fin se règle ensuite dans Ads Manager.`}
        onClose={() => setAdSetOpen(false)}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdSetOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-300 font-black text-sm text-zinc-900">
              Annuler
            </button>
            <button
              type="button"
              disabled={publishing || !adSetForm.name.trim() || !adSetForm.daily_budget}
              onClick={() => void publishAdSet()}
              className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm disabled:opacity-50"
            >
              {publishing ? 'Envoi à Meta…' : 'Créer sur Meta'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {adSetError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              {adSetError}
            </div>
          )}

          <label className={AD_LABEL}>
            Nom de l’ensemble *
            <input className={AD_INPUT} value={adSetForm.name} onChange={(e) => setAdSetForm({ ...adSetForm, name: e.target.value })} />
          </label>

          <label className={AD_LABEL}>
            Budget quotidien ({currency}) *
            <input type="number" min="1" step="1" className={AD_INPUT} value={adSetForm.daily_budget} onChange={(e) => setAdSetForm({ ...adSetForm, daily_budget: e.target.value })} />
          </label>

          <label className={AD_LABEL}>
            Pays ciblés (codes ISO, séparés par des virgules)
            <input className={AD_INPUT} value={adSetForm.countries} onChange={(e) => setAdSetForm({ ...adSetForm, countries: e.target.value })} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={AD_LABEL}>
              Âge minimum
              <input type="number" min="13" max="65" className={AD_INPUT} value={adSetForm.age_min} onChange={(e) => setAdSetForm({ ...adSetForm, age_min: e.target.value })} />
            </label>
            <label className={AD_LABEL}>
              Âge maximum
              <input type="number" min="13" max="65" className={AD_INPUT} value={adSetForm.age_max} onChange={(e) => setAdSetForm({ ...adSetForm, age_max: e.target.value })} />
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        title="Nouvelle publicité"
        subtitle={
          createTarget
            ? `Créée EN PAUSE dans « ${createTarget.name} » — à vérifier dans Ads Manager avant activation.`
            : 'Créée EN PAUSE — à vérifier dans Ads Manager avant activation.'
        }
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 py-3 rounded-xl border border-zinc-300 font-black text-sm text-zinc-900">
              Annuler
            </button>
            <button
              type="button"
              disabled={publishing}
              onClick={() => void publishAd()}
              className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-black text-sm disabled:opacity-50"
            >
              {publishing ? 'Envoi à Meta…' : 'Créer sur Meta'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {createError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              {createError}
            </div>
          )}

          <label className={AD_LABEL}>
            Nom de la publicité *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={AD_INPUT} />
          </label>

          <label className={AD_LABEL}>
            Texte de la publicité *
            <textarea
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className={AD_INPUT}
            />
          </label>

          <label className={AD_LABEL}>
            Titre affiché
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={AD_INPUT} />
          </label>

          <label className={AD_LABEL}>
            Lien de destination
            <input
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://…"
              className={AD_INPUT}
            />
          </label>

          <label className={AD_LABEL}>
            Appel à l’action
            <select value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} className={AD_INPUT}>
              <option value="">— Aucun</option>
              {CTA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className={AD_LABEL}>
            Visuel
            <input type="file" accept="image/*" onChange={(e) => void pickImage(e.target.files?.[0] ?? null)} className={AD_INPUT} />
            <span className="mt-1 block text-[11px] font-semibold text-zinc-500">
              L’image est envoyée dans la bibliothèque du compte publicitaire Meta.
            </span>
          </label>

          {form.imagePreview && (
            <img src={form.imagePreview} alt="" className="w-full h-40 object-cover rounded-xl border border-zinc-200" />
          )}
        </div>
      </Modal>
    </div>
  );
}
