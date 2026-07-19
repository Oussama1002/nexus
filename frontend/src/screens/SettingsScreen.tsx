import React, { useEffect, useMemo, useState } from 'react';
import { History, Loader2, RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';
import {
  CataloguePanel,
  DeliveryPanel,
  FinancePanel,
  GeneralPanel,
  IntegrationsPanel,
  MetaPanel,
  SecurityPanel,
  WhatsappPanel,
} from '../components/settings/center/CenterPanels';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';
import { validateSettingsSection } from '../lib/settingsCenterValidation';
import type {
  CatalogueModel,
  DeliveryModel,
  FinanceModel,
  GeneralModel,
  IntegrationsModel,
  MetaModel,
  SectionModel,
  SecurityModel,
  SettingsCenterSection,
  WhatsappModel,
  WhatsappPhoneNumber,
  SavedWhatsappNumber,
} from '../lib/settingsCenterApi';
import { mergeSidebarVisibility, notifySidebarNavUpdated } from '../lib/sidebarNavCatalog';
import { cn } from '../lib/utils';

type SettingsAuditApiRow = {
  id: number;
  section: string;
  updated_at: string | null;
  updated_by: { id: number; name: string; email: string } | null;
};

const SECTION_LABEL_FR: Record<SettingsCenterSection, string> = {
  general: 'Général',
  catalogue: 'Catalogue',
  integrations: 'Intégrations',
  delivery: 'Livraison',
  whatsapp: 'WhatsApp',
  meta: 'Meta & pub',
  finance: 'Finance',
  security: 'Sécurité',
};

const NAV: { id: SettingsCenterSection; label: string; description: string }[] = [
  { id: 'general', label: 'Général', description: 'Entreprise, système, marque, workflows' },
  { id: 'catalogue', label: 'Catalogue', description: 'Catégories produits, types, fournisseurs' },
  { id: 'integrations', label: 'Intégrations', description: 'E-mail, SMS, fichiers, webhooks' },
  { id: 'delivery', label: 'Livraison', description: 'Transporteurs, règles, COD' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'API, automatisation, modèles' },
  { id: 'meta', label: 'Meta & pub', description: 'Business Manager, pubs, KPIs' },
  { id: 'finance', label: 'Finance', description: 'TVA, facturation, charges' },
  { id: 'security', label: 'Sécurité', description: 'Sessions, mots de passe, audit' },
];

export function SettingsScreen() {
  const toast = useToast();
  const { activeBrandId } = useBrand();
  const { hasPermission, isAdmin } = useAuth();
  const canView = hasPermission('settings.view');
  const canUpdate = hasPermission('settings.update');

  const [section, setSection] = useState<SettingsCenterSection>('general');
  const [model, setModel] = useState<SectionModel | null>(null);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  /** Incrémenté pour forcer un re-fetch sans changer de section (Réinitialiser). */
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<SettingsAuditApiRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [testLoading, setTestLoading] = useState<'smtp' | 'whatsapp' | 'meta' | 'delivery' | null>(null);
  const [connectingFb, setConnectingFb] = useState(false);

  const navItems = useMemo(() => NAV.filter((n) => n.id !== 'security' || isAdmin), [isAdmin]);

  useEffect(() => {
    if (section === 'security' && !isAdmin) setSection('general');
  }, [section, isAdmin]);

  const dirty = model !== null && JSON.stringify(model) !== baseline;

  useEffect(() => {
    if (!activeBrandId || activeBrandId === "all" || !canView) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await api.get<SectionModel>(`settings/center/${encodeURIComponent(section)}`);
      if (cancelled) return;
      setLoading(false);
      if (!res.ok || !res.data) {
        toast.error(res.message);
        setModel(null);
        return;
      }
      let data = res.data;
      if (section === 'general' && data && 'navigation' in data) {
        const g = data as GeneralModel;
        data = {
          ...g,
          navigation: { items: mergeSidebarVisibility(g.navigation?.items) },
        } as SectionModel;
      }
      if (section === 'catalogue' && data) {
        const c = data as CatalogueModel;
        data = {
          productCategories: c.productCategories ?? [],
          productTypes: c.productTypes ?? [],
          supplierCategories: c.supplierCategories ?? [],
        } as SectionModel;
      }
      setModel(data);
      setBaseline(JSON.stringify(data));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrandId, canView, section, toast, reloadToken]);

  async function save() {
    if (!canUpdate || !activeBrandId || activeBrandId === "all" || model === null) return;
    if (section === 'security' && !isAdmin) {
      toast.error('La section Sécurité est réservée aux administrateurs.');
      return;
    }
    const validationErrors = validateSettingsSection(section, model);
    if (validationErrors.length) {
      toast.error(validationErrors.join(' '));
      return;
    }
    setSaving(true);
    const res = await api.put<SectionModel>(`settings/center/${encodeURIComponent(section)}`, model as Record<string, unknown>);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success('Modifications enregistrées.');
    let data = res.data ?? model;
    if (section === 'general' && data && 'navigation' in data) {
      const g = data as GeneralModel;
      data = {
        ...g,
        navigation: { items: mergeSidebarVisibility(g.navigation?.items) },
      } as SectionModel;
      notifySidebarNavUpdated();
    }
    setModel(data);
    setBaseline(JSON.stringify(data));
  }

  function resetLocal() {
    setModel(null);
    setReloadToken((t) => t + 1);
  }

  async function openAudit() {
    setAuditOpen(true);
    setAuditLoading(true);
    const res = await api.get<LaravelPaginator<SettingsAuditApiRow>>('settings/center/audit-history?per_page=80');
    setAuditLoading(false);
    if (res.ok && res.data && isPaginator<SettingsAuditApiRow>(res.data)) {
      setAuditRows(res.data.data);
    } else {
      setAuditRows([]);
      if (!res.ok) toast.error(res.message);
    }
  }

  async function runConnectionTest(kind: 'smtp' | 'whatsapp' | 'meta' | 'delivery') {
    if (!canUpdate) return;
    setTestLoading(kind);
    const res = await api.post<unknown>(`settings/center/test/${kind}`, {});
    setTestLoading(null);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  }

  async function fetchWhatsappNumbers(): Promise<WhatsappPhoneNumber[]> {
    const res = await api.get<{ numbers: WhatsappPhoneNumber[] }>('whatsapp/phone-numbers');
    if (!res.ok || !res.data) {
      const msg = res.message || 'Impossible de récupérer les numéros WhatsApp.';
      toast.error(msg);
      // Throw so the panel does not show a misleading "Aucun numéro trouvé".
      throw new Error(msg);
    }
    const numbers = res.data.numbers ?? [];
    toast.success(res.message);
    return numbers;
  }

  async function listSavedWhatsappNumbers(): Promise<SavedWhatsappNumber[]> {
    const res = await api.get<{ numbers: SavedWhatsappNumber[] }>('whatsapp/numbers');
    if (!res.ok || !res.data) {
      toast.error(res.message || 'Impossible de charger les numéros importés.');
      throw new Error(res.message);
    }
    return res.data.numbers ?? [];
  }

  async function addWhatsappNumber(n: WhatsappPhoneNumber): Promise<boolean> {
    const res = await api.post('whatsapp/numbers', {
      phone_id: n.id,
      display_number: n.display_phone_number,
      verified_name: n.verified_name,
      label: n.display_phone_number || n.verified_name || n.id,
      waba_id: model && 'connection' in model ? (model as WhatsappModel).connection.businessAccountId : undefined,
    });
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    return res.ok;
  }

  async function setDefaultWhatsappNumber(id: number): Promise<boolean> {
    const res = await api.patch(`whatsapp/numbers/${id}`, { is_default: true });
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    return res.ok;
  }

  async function deleteWhatsappNumber(id: number): Promise<boolean> {
    const res = await api.del(`whatsapp/numbers/${id}`);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    return res.ok;
  }

  async function connectFacebook() {
    if (!activeBrandId || activeBrandId === "all") {
      toast.error("Veuillez sélectionner une marque spécifique.");
      return;
    }
    setConnectingFb(true);
    const res = await api.get<{ url: string }>('meta/oauth/url');
    setConnectingFb(false);
    if (!res.ok || !res.data?.url) {
      toast.error(res.message || 'Impossible de générer le lien de connexion Meta.');
      return;
    }
    window.location.href = res.data.url;
  }


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('oauth');
    const sec = params.get('section');
    if (oauth && sec === 'meta') {
      if (oauth === 'success') {
        toast.success('Compte Facebook connecté avec succès !');
        setReloadToken((t) => t + 1);
      } else if (oauth === 'denied') {
        toast.error('Connexion Facebook refusée par l\'utilisateur.');
      } else if (oauth === 'exchange_failed') {
        toast.error('Échec de l\'échange de token Facebook.');
      } else if (oauth === 'missing_config') {
        toast.error('Configuration Meta incomplète (App ID / App Secret manquant).');
      } else {
        toast.error('Erreur de connexion Facebook.');
      }
      setSection('meta');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const sidebarNote =
    section === 'security' && !isAdmin ? 'Les modifications de sécurité nécessitent un compte administrateur.' : null;

  if (!canView) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm font-medium text-zinc-600 shadow-sm">
        Vous n’avez pas accès aux paramètres.
      </div>
    );
  }

  if (!activeBrandId || activeBrandId === "all") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm font-medium text-zinc-600 shadow-sm">
        {"Sélectionnez une marque spécifique pour configurer le centre de paramètres."}
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] pb-32">
      <PageHeader
        title="Centre de paramètres"
        subtitle="Réglages métier par marque — présentation alignée sur les produits SaaS modernes. Les secrets ne sont jamais renvoyés en clair ; les indicateurs « configuré » confirment une valeur stockée."
      />

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        <aside className="xl:col-span-3">
          <nav className="rounded-2xl border border-zinc-200/80 bg-white p-2 shadow-sm space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setModel(null);
                  setLoading(true);
                }}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl transition-all border border-transparent',
                  section === item.id
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-900/10 border-primary-700'
                    : 'hover:bg-zinc-50 text-zinc-700 border-transparent',
                )}
              >
                <p className={cn('text-sm font-semibold', section === item.id ? 'text-white' : 'text-zinc-900')}>{item.label}</p>
                <p className={cn('text-[11px] mt-0.5 font-medium', section === item.id ? 'text-primary-100' : 'text-zinc-500')}>
                  {item.description}
                </p>
              </button>
            ))}
          </nav>
        </aside>

        <div className="xl:col-span-9 space-y-6">
          {sidebarNote && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">{sidebarNote}</div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white flex flex-col items-center justify-center py-24 shadow-sm">
              <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
              <p className="mt-4 text-sm font-medium text-zinc-500">Chargement des réglages…</p>
            </div>
          ) : model === null ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500 shadow-sm">Impossible de charger cette section.</div>
          ) : (
            <>
              {section === 'general' && (
                <GeneralPanel
                  value={model as GeneralModel}
                  onChange={setModel}
                  disabled={!canUpdate}
                  onLogoUploaded={(logoUrl) => {
                    setModel((prev) => {
                      if (!prev) return prev;
                      const g = prev as GeneralModel;
                      const next = { ...g, company: { ...g.company, logoUrl } };
                      setBaseline(JSON.stringify(next));
                      return next;
                    });
                    toast.success('Logo enregistré.');
                  }}
                />
              )}
              {section === 'catalogue' && (
                <CataloguePanel
                  value={model as CatalogueModel}
                  onChange={setModel}
                  disabled={!canUpdate}
                />
              )}
              {section === 'integrations' && (
                <IntegrationsPanel
                  value={model as IntegrationsModel}
                  onChange={setModel}
                  disabled={!canUpdate}
                  isAdmin={isAdmin}
                  onTestSmtp={canUpdate ? () => void runConnectionTest('smtp') : undefined}
                  smtpTesting={testLoading === 'smtp'}
                />
              )}
              {section === 'delivery' && (
                <DeliveryPanel
                  value={model as DeliveryModel}
                  onChange={setModel}
                  disabled={!canUpdate}
                  isAdmin={isAdmin}
                  onTestDelivery={canUpdate ? () => void runConnectionTest('delivery') : undefined}
                  deliveryTesting={testLoading === 'delivery'}
                />
              )}
              {section === 'whatsapp' && (
                <WhatsappPanel
                  value={model as WhatsappModel}
                  onChange={setModel}
                  disabled={!canUpdate}
                  isAdmin={isAdmin}
                  onTestWhatsapp={canUpdate ? () => void runConnectionTest('whatsapp') : undefined}
                  whatsappTesting={testLoading === 'whatsapp'}
                  onFetchNumbers={canUpdate ? fetchWhatsappNumbers : undefined}
                  onListSavedNumbers={listSavedWhatsappNumbers}
                  onAddNumber={canUpdate ? addWhatsappNumber : undefined}
                  onSetDefault={canUpdate ? setDefaultWhatsappNumber : undefined}
                  onDeleteNumber={canUpdate ? deleteWhatsappNumber : undefined}
                />
              )}
              {section === 'meta' && (
                <MetaPanel
                  value={model as MetaModel}
                  onChange={setModel}
                  disabled={!canUpdate}
                  isAdmin={isAdmin}
                  onTestMeta={canUpdate ? () => void runConnectionTest('meta') : undefined}
                  metaTesting={testLoading === 'meta'}
                  onConnectFacebook={canUpdate ? connectFacebook : undefined}
                  connectingFacebook={connectingFb}
                />
              )}
              {section === 'finance' && (
                <FinancePanel value={model as FinanceModel} onChange={setModel} disabled={!canUpdate} />
              )}
              {section === 'security' && (
                <SecurityPanel value={model as SecurityModel} onChange={setModel} disabled={!canUpdate || !isAdmin} />
              )}
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/90 bg-white/90 backdrop-blur-lg px-6 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs font-semibold text-zinc-500">
            {dirty ? 'Modifications non enregistrées' : 'Toutes les modifications sont enregistrées'}
            {section === 'security' && !isAdmin && ' · Sécurité : réservée aux administrateurs'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void openAudit()}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold inline-flex items-center gap-2 hover:bg-zinc-50 text-zinc-800"
            >
              <History className="w-4 h-4" /> Historique
            </button>
            <button
              type="button"
              onClick={() => void resetLocal()}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-semibold inline-flex items-center gap-2 hover:bg-zinc-50 disabled:opacity-50 text-zinc-800"
            >
              <RotateCcw className="w-4 h-4" /> Réinitialiser
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!canUpdate || !dirty || saving || loading || model === null || (section === 'security' && !isAdmin)}
              className="px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md shadow-primary-900/10 hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={auditOpen}
        title="Historique des réglages"
        subtitle="Sections modifiées — aucune valeur ni clé technique affichée."
        onClose={() => setAuditOpen(false)}
      >
        <div className="max-h-[min(70vh,480px)] overflow-y-auto space-y-2">
          {auditLoading ? (
            <p className="text-sm text-zinc-500">Chargement…</p>
          ) : auditRows.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune entrée récente.</p>
          ) : (
            auditRows.map((r) => {
              const sec = r.section as SettingsCenterSection;
              const label = SECTION_LABEL_FR[sec] ?? r.section;
              return (
                <div key={r.id} className="rounded-xl border border-zinc-100 px-4 py-3 text-sm bg-zinc-50/50">
                  <p className="font-semibold text-zinc-900">{label}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {r.updated_at ? new Date(r.updated_at).toLocaleString('fr-FR') : '—'} · {r.updated_by?.name ?? '—'}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </Modal>

    </div>
  );
}
