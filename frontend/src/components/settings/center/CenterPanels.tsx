import React from 'react';
import type {
  DeliveryModel,
  FinanceModel,
  GeneralModel,
  IntegrationsModel,
  MetaModel,
  SecurityModel,
  WhatsappModel,
} from '../../../lib/settingsCenterApi';
import { SIDEBAR_NAV_CATALOG, mergeSidebarVisibility } from '../../../lib/sidebarNavCatalog';
import { ConnectionTestButton, SectionCard, SecretField, TextField, ToggleRow } from './SettingsUi';

export function GeneralPanel({
  value,
  onChange,
  disabled,
}: {
  value: GeneralModel;
  onChange: (v: GeneralModel) => void;
  disabled: boolean;
}) {
  const p = (patch: Partial<GeneralModel>) => onChange({ ...value, ...patch });
  const navItems = mergeSidebarVisibility(value.navigation?.items);
  return (
    <div className="space-y-8">
      <SectionCard title="Entreprise" description="Informations légales et de contact visibles côté métier.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Nom entreprise" value={value.company.name} onChange={(v) => p({ company: { ...value.company, name: v } })} disabled={disabled} />
          <TextField label="Logo (URL)" hint="Image HTTPS" value={value.company.logoUrl} onChange={(v) => p({ company: { ...value.company, logoUrl: v } })} disabled={disabled} />
          <TextField label="Téléphone" value={value.company.phone} onChange={(v) => p({ company: { ...value.company, phone: v } })} disabled={disabled} />
          <TextField label="E-mail" value={value.company.email} onChange={(v) => p({ company: { ...value.company, email: v } })} disabled={disabled} />
          <div className="md:col-span-2">
            <TextField label="Adresse" value={value.company.address} onChange={(v) => p({ company: { ...value.company, address: v } })} disabled={disabled} multiline />
          </div>
          <TextField label="Ville" value={value.company.city} onChange={(v) => p({ company: { ...value.company, city: v } })} disabled={disabled} />
          <TextField label="Site web" value={value.company.website} onChange={(v) => p({ company: { ...value.company, website: v } })} disabled={disabled} />
          <TextField label="ICE" value={value.company.ice} onChange={(v) => p({ company: { ...value.company, ice: v } })} disabled={disabled} />
          <TextField label="IF" value={value.company.ifNumber} onChange={(v) => p({ company: { ...value.company, ifNumber: v } })} disabled={disabled} />
          <TextField label="RC" value={value.company.rc} onChange={(v) => p({ company: { ...value.company, rc: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="Système" description="Fuseau, langue et formats d’affichage.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Fuseau horaire" hint="ex. Africa/Casablanca" value={value.system.timezone} onChange={(v) => p({ system: { ...value.system, timezone: v } })} disabled={disabled} />
          <TextField label="Langue par défaut" value={value.system.defaultLanguage} onChange={(v) => p({ system: { ...value.system, defaultLanguage: v } })} disabled={disabled} />
          <TextField label="Devise" hint="MAD" value={value.system.currency} onChange={(v) => p({ system: { ...value.system, currency: v } })} disabled={disabled} />
          <TextField label="Format de date" hint="ex. dd/MM/yyyy" value={value.system.dateFormat} onChange={(v) => p({ system: { ...value.system, dateFormat: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="Branding" description="Apparence du CRM pour vos équipes.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Couleur principale" hint="#RRGGBB" value={value.branding.primaryColor} onChange={(v) => p({ branding: { ...value.branding, primaryColor: v } })} disabled={disabled} />
          <TextField label="Nom CRM affiché" value={value.branding.crmDisplayName} onChange={(v) => p({ branding: { ...value.branding, crmDisplayName: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="Workflow" description="Valeurs par défaut pour les parcours lead et commande.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Statut lead par défaut" value={value.workflow.defaultLeadStatus} onChange={(v) => p({ workflow: { ...value.workflow, defaultLeadStatus: v } })} disabled={disabled} />
          <TextField label="Statut commande par défaut" value={value.workflow.defaultOrderStatus} onChange={(v) => p({ workflow: { ...value.workflow, defaultOrderStatus: v } })} disabled={disabled} />
          <TextField label="SLA lead (heures)" value={value.workflow.leadSlaHours} onChange={(v) => p({ workflow: { ...value.workflow, leadSlaHours: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard
        title="Menu latéral"
        description="Choisissez les entrées visibles dans la barre latérale pour cette marque. Les droits utilisateur s’appliquent toujours : masquer un module ne donne pas d’accès supplémentaire."
        actions={
          !disabled ? (
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs font-bold uppercase tracking-wide text-primary-700 hover:underline"
                onClick={() =>
                  p({
                    navigation: {
                      items: mergeSidebarVisibility(
                        Object.fromEntries(SIDEBAR_NAV_CATALOG.map((e) => [e.key, true])),
                      ),
                    },
                  })
                }
              >
                Tout afficher
              </button>
              <button
                type="button"
                className="text-xs font-bold uppercase tracking-wide text-zinc-500 hover:underline"
                onClick={() =>
                  p({
                    navigation: {
                      items: mergeSidebarVisibility(
                        Object.fromEntries(SIDEBAR_NAV_CATALOG.map((e) => [e.key, false])),
                      ),
                    },
                  })
                }
              >
                Tout masquer
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {Object.entries(
            SIDEBAR_NAV_CATALOG.reduce<Record<string, (typeof SIDEBAR_NAV_CATALOG)[number][]>>((acc, entry) => {
              (acc[entry.groupLabel] ??= []).push(entry);
              return acc;
            }, {}),
          ).map(([groupLabel, entries]) => (
            <div key={groupLabel}>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2 px-1">{groupLabel}</p>
              <div className="space-y-1">
                {entries.map((entry) => (
                  <ToggleRow
                    key={entry.key}
                    label={entry.label}
                    checked={navItems[entry.key] !== false}
                    onChange={(checked) => {
                      const items = { ...navItems, [entry.key]: checked };
                      p({ navigation: { items } });
                    }}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export function IntegrationsPanel({
  value,
  onChange,
  disabled,
  isAdmin,
  onTestSmtp,
  smtpTesting,
}: {
  value: IntegrationsModel;
  onChange: (v: IntegrationsModel) => void;
  disabled: boolean;
  isAdmin: boolean;
  onTestSmtp?: () => void;
  smtpTesting?: boolean;
}) {
  const p = (patch: Partial<IntegrationsModel>) => onChange({ ...value, ...patch });
  const sec = !disabled && isAdmin;
  return (
    <div className="space-y-8">
      <SectionCard
        title="E-mail (SMTP)"
        description="Envoi des notifications et factures par e-mail."
        actions={
          onTestSmtp ? (
            <ConnectionTestButton label="Tester SMTP" onClick={onTestSmtp} disabled={disabled} loading={smtpTesting} />
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Hôte SMTP" value={value.email.smtpHost} onChange={(v) => p({ email: { ...value.email, smtpHost: v } })} disabled={disabled} />
          <TextField label="Port" value={value.email.smtpPort} onChange={(v) => p({ email: { ...value.email, smtpPort: v } })} disabled={disabled} />
          <TextField label="Utilisateur" value={value.email.smtpUser} onChange={(v) => p({ email: { ...value.email, smtpUser: v } })} disabled={disabled} />
          <SecretField
            label="Mot de passe"
            configured={value.email.smtpPasswordConfigured}
            value={value.email.smtpPassword}
            onChange={(v) => p({ email: { ...value.email, smtpPassword: v } })}
            disabled={!sec}
          />
          <TextField label="Chiffrement" hint="TLS / SSL" value={value.email.smtpEncryption} onChange={(v) => p({ email: { ...value.email, smtpEncryption: v } })} disabled={disabled} />
          <TextField label="Nom expéditeur" value={value.email.senderName} onChange={(v) => p({ email: { ...value.email, senderName: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="SMS" description="Fournisseur de SMS transactionnels.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Fournisseur" value={value.sms.provider} onChange={(v) => p({ sms: { ...value.sms, provider: v } })} disabled={disabled} />
          <SecretField label="Clé API" configured={value.sms.apiKeyConfigured} value={value.sms.apiKey} onChange={(v) => p({ sms: { ...value.sms, apiKey: v } })} disabled={!sec} />
          <TextField label="Expéditeur" value={value.sms.sender} onChange={(v) => p({ sms: { ...value.sms, sender: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="Stockage des fichiers" description="Pièces jointes, images produit, factures PDF.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Fournisseur" hint="local, s3, cloudinary…" value={value.storage.provider} onChange={(v) => p({ storage: { ...value.storage, provider: v } })} disabled={disabled} />
          <TextField label="Bucket / conteneur" value={value.storage.bucket} onChange={(v) => p({ storage: { ...value.storage, bucket: v } })} disabled={disabled} />
          <SecretField label="Access key" configured={value.storage.accessKeyConfigured} value={value.storage.accessKey} onChange={(v) => p({ storage: { ...value.storage, accessKey: v } })} disabled={!sec} />
          <SecretField label="Secret key" configured={value.storage.secretKeyConfigured} value={value.storage.secretKey} onChange={(v) => p({ storage: { ...value.storage, secretKey: v } })} disabled={!sec} />
        </div>
      </SectionCard>
      <SectionCard title="Webhooks" description="Notifications vers vos systèmes externes.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <TextField label="URL webhook" value={value.webhooks.url} onChange={(v) => p({ webhooks: { ...value.webhooks, url: v } })} disabled={disabled} />
          </div>
          <SecretField label="Secret webhook" configured={value.webhooks.secretConfigured} value={value.webhooks.secret} onChange={(v) => p({ webhooks: { ...value.webhooks, secret: v } })} disabled={!sec} />
        </div>
      </SectionCard>
    </div>
  );
}

export function DeliveryPanel({
  value,
  onChange,
  disabled,
  isAdmin,
  onTestDelivery,
  deliveryTesting,
}: {
  value: DeliveryModel;
  onChange: (v: DeliveryModel) => void;
  disabled: boolean;
  isAdmin: boolean;
  onTestDelivery?: () => void;
  deliveryTesting?: boolean;
}) {
  const p = (patch: Partial<DeliveryModel>) => onChange({ ...value, ...patch });
  const sec = !disabled && isAdmin;
  return (
    <div className="space-y-8">
      <SectionCard title="Comportement par défaut">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Société de livraison par défaut" hint="Identifiant interne" value={value.defaults.defaultCarrierId} onChange={(v) => p({ defaults: { ...value.defaults, defaultCarrierId: v } })} disabled={disabled} />
          <TextField label="Frais livraison par défaut" value={value.defaults.defaultShippingFee} onChange={(v) => p({ defaults: { ...value.defaults, defaultShippingFee: v } })} disabled={disabled} />
          <TextField label="Délai moyen (jours)" value={value.defaults.averageDeliveryDays} onChange={(v) => p({ defaults: { ...value.defaults, averageDeliveryDays: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="Règles d’expédition">
        <div className="space-y-2">
          <ToggleRow label="Activer assurance" checked={value.rules.insuranceEnabled} onChange={(v) => p({ rules: { ...value.rules, insuranceEnabled: v } })} disabled={disabled} />
          <ToggleRow label="Autoriser ouverture du colis" checked={value.rules.allowOpenPackage} onChange={(v) => p({ rules: { ...value.rules, allowOpenPackage: v } })} disabled={disabled} />
          <ToggleRow label="Générer automatiquement le n° de suivi" checked={value.rules.autoTrackingNumber} onChange={(v) => p({ rules: { ...value.rules, autoTrackingNumber: v } })} disabled={disabled} />
          <ToggleRow label="Synchroniser le suivi automatiquement" checked={value.rules.autoSyncTracking} onChange={(v) => p({ rules: { ...value.rules, autoSyncTracking: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard
        title="API transporteurs"
        description="Sendit et Ameex — identifiants pour créer et suivre les colis."
        actions={
          onTestDelivery ? (
            <ConnectionTestButton label="Tester la connexion" onClick={onTestDelivery} disabled={disabled} loading={deliveryTesting} />
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary-700">Sendit</p>
            <TextField label="URL API" value={value.carriers.sendit.apiUrl} onChange={(v) => p({ carriers: { ...value.carriers, sendit: { ...value.carriers.sendit, apiUrl: v } } })} disabled={disabled} />
            <SecretField label="Clé publique" configured={value.carriers.sendit.publicKeyConfigured} value={value.carriers.sendit.publicKey} onChange={(v) => p({ carriers: { ...value.carriers, sendit: { ...value.carriers.sendit, publicKey: v } } })} disabled={!sec} />
            <SecretField label="Clé secrète" configured={value.carriers.sendit.secretKeyConfigured} value={value.carriers.sendit.secretKey} onChange={(v) => p({ carriers: { ...value.carriers, sendit: { ...value.carriers.sendit, secretKey: v } } })} disabled={!sec} />
          </div>
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-primary-700">Ameex</p>
            <TextField label="URL API" value={value.carriers.ameex.apiUrl} onChange={(v) => p({ carriers: { ...value.carriers, ameex: { ...value.carriers.ameex, apiUrl: v } } })} disabled={disabled} />
            <SecretField label="Clé API (C-Api-Key)" configured={value.carriers.ameex.apiKeyConfigured} value={value.carriers.ameex.apiKey} onChange={(v) => p({ carriers: { ...value.carriers, ameex: { ...value.carriers.ameex, apiKey: v } } })} disabled={!sec} />
          </div>
        </div>
      </SectionCard>
      <SectionCard title="COD">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Délai réconciliation (jours)" value={value.cod.reconciliationDelayDays} onChange={(v) => p({ cod: { ...value.cod, reconciliationDelayDays: v } })} disabled={disabled} />
          <TextField label="Tolérance litige" value={value.cod.disputeTolerance} onChange={(v) => p({ cod: { ...value.cod, disputeTolerance: v } })} disabled={disabled} />
        </div>
      </SectionCard>
    </div>
  );
}

export function WhatsappPanel({
  value,
  onChange,
  disabled,
  isAdmin,
  onTestWhatsapp,
  whatsappTesting,
}: {
  value: WhatsappModel;
  onChange: (v: WhatsappModel) => void;
  disabled: boolean;
  isAdmin: boolean;
  onTestWhatsapp?: () => void;
  whatsappTesting?: boolean;
}) {
  const p = (patch: Partial<WhatsappModel>) => onChange({ ...value, ...patch });
  const sec = !disabled && isAdmin;
  return (
    <div className="space-y-8">
      <SectionCard
        title="Connexion"
        description="Identifiants API WhatsApp Business."
        actions={
          onTestWhatsapp ? (
            <ConnectionTestButton label="Tester WhatsApp" onClick={onTestWhatsapp} disabled={disabled} loading={whatsappTesting} />
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Fournisseur" value={value.connection.provider} onChange={(v) => p({ connection: { ...value.connection, provider: v } })} disabled={disabled} />
          <TextField label="URL de base API" hint="https://graph.facebook.com/…" value={value.connection.apiBaseUrl} onChange={(v) => p({ connection: { ...value.connection, apiBaseUrl: v } })} disabled={disabled} />
          <TextField label="Numéro professionnel" value={value.connection.businessNumber} onChange={(v) => p({ connection: { ...value.connection, businessNumber: v } })} disabled={disabled} />
          <TextField label="Business Account ID (WABA)" value={value.connection.businessAccountId} onChange={(v) => p({ connection: { ...value.connection, businessAccountId: v } })} disabled={disabled} />
          <SecretField label="Jeton API" configured={value.connection.apiTokenConfigured} value={value.connection.apiToken} onChange={(v) => p({ connection: { ...value.connection, apiToken: v } })} disabled={!sec} />
          <TextField label="Phone ID" value={value.connection.phoneId} onChange={(v) => p({ connection: { ...value.connection, phoneId: v } })} disabled={disabled} />
          <SecretField label="Jeton de vérification webhook" configured={value.connection.webhookVerifyConfigured} value={value.connection.webhookVerifyToken} onChange={(v) => p({ connection: { ...value.connection, webhookVerifyToken: v } })} disabled={!sec} />
          <div className="md:col-span-2">
            <TextField label="URL webhook (référence)" hint="À déclarer chez Meta / fournisseur" value={value.connection.webhookUrlHint} onChange={(v) => p({ connection: { ...value.connection, webhookUrlHint: v } })} disabled={disabled} />
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Automatisation">
        <div className="space-y-2 mb-6">
          <ToggleRow label="Création automatique de lead" checked={value.automation.autoCreateLead} onChange={(v) => p({ automation: { ...value.automation, autoCreateLead: v } })} disabled={disabled} />
          <ToggleRow label="Assignation automatique des conversations" checked={value.automation.autoAssignConversation} onChange={(v) => p({ automation: { ...value.automation, autoAssignConversation: v } })} disabled={disabled} />
          <ToggleRow label="Réponses automatiques" checked={value.automation.autoReplies} onChange={(v) => p({ automation: { ...value.automation, autoReplies: v } })} disabled={disabled} />
        </div>
        <TextField label="Message d’accueil par défaut" value={value.automation.defaultWelcomeMessage} onChange={(v) => p({ automation: { ...value.automation, defaultWelcomeMessage: v } })} disabled={disabled} multiline />
      </SectionCard>
      <SectionCard title="Modèles de messages">
        <div className="grid grid-cols-1 gap-5">
          <TextField label="Confirmation commande" value={value.templates.orderConfirmation} onChange={(v) => p({ templates: { ...value.templates, orderConfirmation: v } })} disabled={disabled} multiline />
          <TextField label="Livraison" value={value.templates.delivery} onChange={(v) => p({ templates: { ...value.templates, delivery: v } })} disabled={disabled} multiline />
          <TextField label="Relance" value={value.templates.followUp} onChange={(v) => p({ templates: { ...value.templates, followUp: v } })} disabled={disabled} multiline />
          <TextField label="Upsell" value={value.templates.upsell} onChange={(v) => p({ templates: { ...value.templates, upsell: v } })} disabled={disabled} multiline />
        </div>
      </SectionCard>
    </div>
  );
}

export function MetaPanel({
  value,
  onChange,
  disabled,
  isAdmin,
  onTestMeta,
  metaTesting,
}: {
  value: MetaModel;
  onChange: (v: MetaModel) => void;
  disabled: boolean;
  isAdmin: boolean;
  onTestMeta?: () => void;
  metaTesting?: boolean;
}) {
  const p = (patch: Partial<MetaModel>) => onChange({ ...value, ...patch });
  const sec = !disabled && isAdmin;
  return (
    <div className="space-y-8">
      <SectionCard
        title="Identifiants Meta"
        actions={
          onTestMeta ? (
            <ConnectionTestButton label="Tester Meta" onClick={onTestMeta} disabled={disabled} loading={metaTesting} />
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Meta App ID" value={value.credentials.appId} onChange={(v) => p({ credentials: { ...value.credentials, appId: v } })} disabled={disabled} />
          <SecretField label="Meta App Secret" configured={value.credentials.appSecretConfigured} value={value.credentials.appSecret} onChange={(v) => p({ credentials: { ...value.credentials, appSecret: v } })} disabled={!sec} />
          <SecretField label="Meta Access Token" configured={value.credentials.accessTokenConfigured} value={value.credentials.accessToken} onChange={(v) => p({ credentials: { ...value.credentials, accessToken: v } })} disabled={!sec} />
          <TextField label="Meta Business ID" value={value.credentials.businessId} onChange={(v) => p({ credentials: { ...value.credentials, businessId: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="Publicités">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Fenêtre d’attribution (jours)" value={value.ads.attributionWindowDays} onChange={(v) => p({ ads: { ...value.ads, attributionWindowDays: v } })} disabled={disabled} />
          <TextField label="Fréquence synchro (minutes)" value={value.ads.syncFrequencyMinutes} onChange={(v) => p({ ads: { ...value.ads, syncFrequencyMinutes: v } })} disabled={disabled} />
          <TextField label="Devise" value={value.ads.currency} onChange={(v) => p({ ads: { ...value.ads, currency: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="Objectifs KPI">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <TextField label="CAC cible" value={value.targets.cac} onChange={(v) => p({ targets: { ...value.targets, cac: v } })} disabled={disabled} />
          <TextField label="CPA cible" value={value.targets.cpa} onChange={(v) => p({ targets: { ...value.targets, cpa: v } })} disabled={disabled} />
          <TextField label="ROAS cible" value={value.targets.roas} onChange={(v) => p({ targets: { ...value.targets, roas: v } })} disabled={disabled} />
        </div>
      </SectionCard>
    </div>
  );
}

export function FinancePanel({
  value,
  onChange,
  disabled,
}: {
  value: FinanceModel;
  onChange: (v: FinanceModel) => void;
  disabled: boolean;
}) {
  const p = (patch: Partial<FinanceModel>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-8">
      <SectionCard title="Paramètres globaux">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="TVA %" value={value.global.taxPercent} onChange={(v) => p({ global: { ...value.global, taxPercent: v } })} disabled={disabled} />
          <TextField label="Préfixe facture" value={value.global.invoicePrefix} onChange={(v) => p({ global: { ...value.global, invoicePrefix: v } })} disabled={disabled} />
          <div className="md:col-span-2">
            <ToggleRow label="Numérotation facture automatique" checked={value.global.invoiceAutoNumbering} onChange={(v) => p({ global: { ...value.global, invoiceAutoNumbering: v } })} disabled={disabled} />
          </div>
        </div>
      </SectionCard>
      <SectionCard title="COD">
        <TextField label="Délai COD (jours)" value={value.cod.delayDays} onChange={(v) => p({ cod: { ...value.cod, delayDays: v } })} disabled={disabled} />
      </SectionCard>
      <SectionCard title="Charges">
        <div className="grid grid-cols-1 gap-5">
          <TextField label="Catégories de charges" value={value.charges.categories} onChange={(v) => p({ charges: { ...value.charges, categories: v } })} disabled={disabled} multiline />
          <TextField label="Validation des dépenses" value={value.charges.expenseValidation} onChange={(v) => p({ charges: { ...value.charges, expenseValidation: v } })} disabled={disabled} multiline />
        </div>
      </SectionCard>
      <SectionCard title="Comptabilité">
        <ToggleRow label="Activer l’export comptable" checked={value.accounting.enableExport} onChange={(v) => p({ accounting: { ...value.accounting, enableExport: v } })} disabled={disabled} />
        <div className="mt-4">
          <TextField label="Format d’export" hint="CSV, Excel…" value={value.accounting.exportFormat} onChange={(v) => p({ accounting: { ...value.accounting, exportFormat: v } })} disabled={disabled} />
        </div>
      </SectionCard>
    </div>
  );
}

export function SecurityPanel({
  value,
  onChange,
  disabled,
}: {
  value: SecurityModel;
  onChange: (v: SecurityModel) => void;
  disabled: boolean;
}) {
  const p = (patch: Partial<SecurityModel>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-8">
      <SectionCard title="Authentification">
        <div className="space-y-2 mb-6">
          <ToggleRow label="Activer l’authentification à deux facteurs (2FA)" checked={value.auth.enable2fa} onChange={(v) => p({ auth: { ...value.auth, enable2fa: v } })} disabled={disabled} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Durée de session (minutes)" value={value.auth.sessionTimeoutMinutes} onChange={(v) => p({ auth: { ...value.auth, sessionTimeoutMinutes: v } })} disabled={disabled} />
          <TextField label="Tentatives de connexion max" value={value.auth.maxLoginAttempts} onChange={(v) => p({ auth: { ...value.auth, maxLoginAttempts: v } })} disabled={disabled} />
        </div>
      </SectionCard>
      <SectionCard title="Politique de mot de passe">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextField label="Longueur minimale" value={value.passwords.minLength} onChange={(v) => p({ passwords: { ...value.passwords, minLength: v } })} disabled={disabled} />
          <div className="md:col-span-2">
            <ToggleRow label="Complexité obligatoire" checked={value.passwords.requireComplexity} onChange={(v) => p({ passwords: { ...value.passwords, requireComplexity: v } })} disabled={disabled} />
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Réseau & origines">
        <div className="grid grid-cols-1 gap-5">
          <TextField label="Liste IP autorisées" hint="Une IP ou plage par ligne" value={value.network.ipWhitelist} onChange={(v) => p({ network: { ...value.network, ipWhitelist: v } })} disabled={disabled} multiline />
          <TextField label="Origines autorisées (CORS)" hint="URLs séparées par des virgules" value={value.network.allowedOrigins} onChange={(v) => p({ network: { ...value.network, allowedOrigins: v } })} disabled={disabled} multiline />
        </div>
      </SectionCard>
      <SectionCard title="Données & conformité">
        <ToggleRow label="Chiffrer les champs sensibles en base" checked={value.data.encryptSensitiveFields} onChange={(v) => p({ data: { ...value.data, encryptSensitiveFields: v } })} disabled={disabled} />
        <div className="mt-4">
          <TextField label="Conservation des journaux d’audit (jours)" value={value.data.auditRetentionDays} onChange={(v) => p({ data: { ...value.data, auditRetentionDays: v } })} disabled={disabled} />
        </div>
      </SectionCard>
    </div>
  );
}
