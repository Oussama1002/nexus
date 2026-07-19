/** Types alignés sur GET/PUT `settings/center/{section}` — aucune clé technique base de données. */

export type SettingsCenterSection =
  | 'general'
  | 'catalogue'
  | 'integrations'
  | 'delivery'
  | 'whatsapp'
  | 'meta'
  | 'finance'
  | 'security';

export type GeneralModel = {
  company: {
    name: string;
    logoUrl: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    website: string;
    ice: string;
    ifNumber: string;
    rc: string;
  };
  system: {
    timezone: string;
    defaultLanguage: string;
    currency: string;
    dateFormat: string;
  };
  branding: {
    primaryColor: string;
    crmDisplayName: string;
  };
  workflow: {
    defaultLeadStatus: string;
    defaultOrderStatus: string;
    leadSlaHours: string;
  };
  navigation: {
    /** Sidebar item key → visible (false = hidden). Omitted keys default to visible. */
    items: Record<string, boolean>;
  };
};

export type CatalogueModel = {
  productCategories: string[];
  productTypes: string[];
  supplierCategories: string[];
};

export type IntegrationsModel = {
  email: {
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPassword: string;
    smtpPasswordConfigured: boolean;
    smtpEncryption: string;
    senderName: string;
  };
  sms: {
    provider: string;
    apiKey: string;
    apiKeyConfigured: boolean;
    sender: string;
  };
  storage: {
    provider: string;
    bucket: string;
    accessKey: string;
    accessKeyConfigured: boolean;
    secretKey: string;
    secretKeyConfigured: boolean;
  };
  webhooks: {
    url: string;
    secret: string;
    secretConfigured: boolean;
  };
};

export type DeliveryModel = {
  defaults: {
    defaultCarrierId: string;
    defaultShippingFee: string;
    averageDeliveryDays: string;
  };
  rules: {
    insuranceEnabled: boolean;
    allowOpenPackage: boolean;
    autoTrackingNumber: boolean;
    autoSyncTracking: boolean;
  };
  carriers: {
    sendit: {
      apiUrl: string;
      publicKey: string;
      publicKeyConfigured: boolean;
      secretKey: string;
      secretKeyConfigured: boolean;
    };
    ameex: { apiUrl: string; apiId: string; apiKey: string; apiKeyConfigured: boolean };
  };
  cod: {
    reconciliationDelayDays: string;
    disputeTolerance: string;
  };
};

export type WhatsappModel = {
  connection: {
    provider: string;
    apiBaseUrl: string;
    businessNumber: string;
    businessAccountId: string;
    apiToken: string;
    apiTokenConfigured: boolean;
    phoneId: string;
    webhookVerifyToken: string;
    webhookVerifyConfigured: boolean;
    webhookUrlHint: string;
  };
  automation: {
    autoCreateLead: boolean;
    autoAssignConversation: boolean;
    autoReplies: boolean;
    defaultWelcomeMessage: string;
  };
  templates: {
    orderConfirmation: string;
    delivery: string;
    followUp: string;
    upsell: string;
  };
};

export type WhatsappPhoneNumber = {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
};

/** A WhatsApp number saved (imported) under a brand — multi-number support. */
export type SavedWhatsappNumber = {
  id: number;
  brand_id: number;
  phone_id: string;
  waba_id: string | null;
  display_number: string | null;
  verified_name: string | null;
  label: string | null;
  api_token_configured: boolean;
  api_base_url: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MetaModel = {
  credentials: {
    appId: string;
    appSecret: string;
    appSecretConfigured: boolean;
    accessToken: string;
    accessTokenConfigured: boolean;
    businessId: string;
  };
  ads: {
    attributionWindowDays: string;
    syncFrequencyMinutes: string;
    currency: string;
  };
  targets: {
    cac: string;
    cpa: string;
    roas: string;
  };
};

export type FinanceModel = {
  global: {
    taxPercent: string;
    invoicePrefix: string;
    invoiceAutoNumbering: boolean;
  };
  cod: { delayDays: string };
  charges: {
    categories: string;
    expenseValidation: string;
  };
  accounting: {
    enableExport: boolean;
    exportFormat: string;
  };
};

export type SecurityModel = {
  auth: {
    enable2fa: boolean;
    sessionTimeoutMinutes: string;
    maxLoginAttempts: string;
  };
  passwords: {
    minLength: string;
    requireComplexity: boolean;
  };
  network: {
    ipWhitelist: string;
    allowedOrigins: string;
  };
  data: {
    encryptSensitiveFields: boolean;
    auditRetentionDays: string;
  };
};

export type SectionModel =
  | GeneralModel
  | CatalogueModel
  | IntegrationsModel
  | DeliveryModel
  | WhatsappModel
  | MetaModel
  | FinanceModel
  | SecurityModel;
