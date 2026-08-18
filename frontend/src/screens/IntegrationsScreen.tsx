import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import {
  DeliveryPanel,
  IntegrationsPanel,
  MetaPanel,
  WhatsappPanel,
} from '../components/settings/center/CenterPanels';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { validateSettingsSection } from '../lib/settingsCenterValidation';
import type {
  DeliveryModel,
  IntegrationsModel,
  MetaModel,
  SectionModel,
  SettingsCenterSection,
  WhatsappModel,
  WhatsappPhoneNumber,
  SavedWhatsappNumber,
} from '../lib/settingsCenterApi';
import { cn } from '../lib/utils';

type IntegrationSection = 'integrations' | 'delivery' | 'whatsapp' | 'meta';

const TABS: { id: IntegrationSection; label: string; description: string }[] = [
  { id: 'integrations', label: 'Intégrations', description: 'E-mail, SMS, fichiers, webhooks' },
  { id: 'delivery', label: 'Livraison', description: 'Transporteurs, règles, COD' },
  { id: 'whatsapp', label: 'WhatsApp', description: 'API, automatisation, modèles' },
  { id: 'meta', label: 'Meta & pub', description: 'Business Manager, pubs, KPIs' },
];

export function IntegrationsScreen() {
  const toast = useToast();
  const { activeBrandId, activeBrand } = useBrand();
  const { hasPermission, isAdmin } = useAuth();
  const canView = hasPermission('settings.view');
  const canUpdate = hasPermission('settings.update');

  const [section, setSection] = useState<IntegrationSection>('integrations');
  const [model, setModel] = useState<SectionModel | null>(null);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [testLoading, setTestLoading] = useState<'smtp' | 'whatsapp' | 'meta' | 'delivery' | null>(null);
  const [connectingFb, setConnectingFb] = useState(false);

  const dirty = model !== null && JSON.stringify(model) !== baseline;

  useEffect(() => {
    if (!activeBrandId || !canView) return;
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
      setModel(res.data);
      setBaseline(JSON.stringify(res.data));
    })();
    return () => { cancelled = true; };
  }, [activeBrandId, canView, section, toast, reloadToken]);

  async function save() {
    if (!canUpdate || !activeBrandId || model === null) return;
    const validationErrors = validateSettingsSection(section as SettingsCenterSection, model);
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
    const data = res.data ?? model;
    setModel(data);
    setBaseline(JSON.stringify(data));
  }

  function resetLocal() {
    setModel(null);
    setReloadToken((t) => t + 1);
  }

  async function runConnectionTest(kind: 'smtp' | 'whatsapp' | 'meta' | 'delivery') {
    if (!canUpdate) return;
    setTestLoading(kind);
    const res = await api.post<unknown>(`settings/center/test/${kind}`, {});
    setTestLoading(null);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
  }

  const fetchWhatsappNumbers = useCallback(async (): Promise<WhatsappPhoneNumber[]> => {
    const res = await api.get<{ numbers: WhatsappPhoneNumber[] }>('whatsapp/phone-numbers');
    if (!res.ok || !res.data) {
      const msg = res.message || 'Impossible de récupérer les numéros WhatsApp.';
      toast.error(msg);
      throw new Error(msg);
    }
    toast.success(res.message);
    return res.data.numbers ?? [];
  }, [toast]);

  const listSavedWhatsappNumbers = useCallback(async (): Promise<SavedWhatsappNumber[]> => {
    const res = await api.get<{ numbers: SavedWhatsappNumber[] }>('whatsapp/numbers');
    if (!res.ok || !res.data) {
      toast.error(res.message || 'Impossible de charger les numéros importés.');
      throw new Error(res.message);
    }
    return res.data.numbers ?? [];
  }, [toast]);

  const addWhatsappNumber = useCallback(async (n: WhatsappPhoneNumber): Promise<boolean> => {
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
  }, [model, toast]);

  const setDefaultWhatsappNumber = useCallback(async (id: number): Promise<boolean> => {
    const res = await api.patch(`whatsapp/numbers/${id}`, { is_default: true });
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    return res.ok;
  }, [toast]);

  const deleteWhatsappNumber = useCallback(async (id: number): Promise<boolean> => {
    const res = await api.del(`whatsapp/numbers/${id}`);
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    return res.ok;
  }, [toast]);

  async function connectFacebook() {
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
        toast.error("Connexion Facebook refusée par l'utilisateur.");
      } else if (oauth === 'exchange_failed') {
        toast.error("Échec de l'échange de token Facebook.");
      } else if (oauth === 'missing_config') {
        toast.error('Configuration Meta incomplète (App ID / App Secret manquant).');
      } else {
        toast.error('Erreur de connexion Facebook.');
      }
      setSection('meta');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center text-sm font-medium text-zinc-600 shadow-sm">
        Vous n'avez pas accès aux intégrations.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] pb-32">
      <PageHeader
        title="Intégrations"
        subtitle="Connectez vos outils externes — e-mail, SMS, livraison, WhatsApp et Meta."
      />

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        <aside className="xl:col-span-3">
          <nav className="rounded-2xl border border-zinc-200/80 bg-white p-2 shadow-sm space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSection(tab.id);
                  setModel(null);
                  setLoading(true);
                }}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl transition-all border border-transparent',
                  section === tab.id
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-900/10 border-primary-700'
                    : 'hover:bg-zinc-50 text-zinc-700 border-transparent',
                )}
              >
                <p className={cn('text-sm font-semibold', section === tab.id ? 'text-white' : 'text-zinc-900')}>{tab.label}</p>
                <p className={cn('text-[11px] mt-0.5 font-medium', section === tab.id ? 'text-primary-100' : 'text-zinc-500')}>
                  {tab.description}
                </p>
              </button>
            ))}
          </nav>
        </aside>

        <div className="xl:col-span-9 space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white flex flex-col items-center justify-center py-24 shadow-sm">
              <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
              <p className="mt-4 text-sm font-medium text-zinc-500">Chargement…</p>
            </div>
          ) : model === null ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500 shadow-sm">Impossible de charger cette section.</div>
          ) : (
            <>
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
                  brandName={activeBrand?.name ?? ''}
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
            </>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/90 bg-white/90 backdrop-blur-lg px-6 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs font-semibold text-zinc-500">
            {dirty ? 'Modifications non enregistrées' : 'Toutes les modifications sont enregistrées'}
          </p>
          <div className="flex flex-wrap gap-2">
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
              disabled={!canUpdate || !dirty || saving || loading || model === null}
              className="px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md shadow-primary-900/10 hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
