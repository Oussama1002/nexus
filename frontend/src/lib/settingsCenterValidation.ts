import type {
  DeliveryModel,
  FinanceModel,
  GeneralModel,
  IntegrationsModel,
  MetaModel,
  SectionModel,
  SecurityModel,
  SettingsCenterSection,
  WhatsappModel,
} from './settingsCenterApi';

/** Compatible avec le backend : secret vide ou uniquement des astérisques = inchangé. */
export function isSecretPlaceholder(value: string): boolean {
  const v = value.trim();
  return v === '' || /^\*+$/.test(v);
}

const urlOk = (v: string) => {
  const s = v.trim();
  return s === '' || /^https?:\/\/.+/i.test(s);
};

const emailOk = (v: string) => {
  const s = v.trim();
  if (s === '') return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
};

function numOk(v: string, min: number, max?: number): boolean {
  const s = v.trim();
  if (s === '') return true;
  const n = Number(s);
  if (Number.isNaN(n)) return false;
  if (n < min) return false;
  if (max !== undefined && n > max) return false;
  return true;
}

function intOk(v: string, min: number, max: number): boolean {
  const s = v.trim();
  if (s === '') return true;
  const n = parseInt(s, 10);
  if (Number.isNaN(n) || String(n) !== s.trim()) return false;
  return n >= min && n <= max;
}

export function validateSettingsSection(section: SettingsCenterSection, model: SectionModel): string[] {
  const err: string[] = [];

  switch (section) {
    case 'general': {
      const m = model as GeneralModel;
      if (!m.company?.name?.trim()) err.push('Le nom de l’entreprise est obligatoire.');
      if (!emailOk(m.company?.email ?? '')) err.push('E-mail entreprise invalide.');
      if (!urlOk(m.company?.logoUrl ?? '')) err.push('URL du logo invalide (vide ou http/https).');
      if (!urlOk(m.company?.website ?? '')) err.push('Site web invalide (vide ou http/https).');
      if (!numOk(m.workflow?.leadSlaHours ?? '', 0, 8760)) err.push('SLA lead : nombre entre 0 et 8760.');
      break;
    }
    case 'integrations': {
      const m = model as IntegrationsModel;
      if (!intOk(m.email?.smtpPort ?? '', 1, 65535)) err.push('Port SMTP : entier entre 1 et 65535.');
      if (!urlOk(m.webhooks?.url ?? '')) err.push('URL webhook invalide.');
      break;
    }
    case 'delivery': {
      const m = model as DeliveryModel;
      if (!numOk(m.defaults?.defaultShippingFee ?? '', 0)) err.push('Frais de livraison : nombre positif.');
      if (!numOk(m.defaults?.averageDeliveryDays ?? '', 0)) err.push('Délai moyen : nombre positif.');
      if (!numOk(m.cod?.reconciliationDelayDays ?? '', 0)) err.push('Délai réconciliation COD : nombre positif.');
      if (!numOk(m.cod?.disputeTolerance ?? '', 0)) err.push('Tolérance litige : nombre positif.');
      if (!urlOk(m.carriers?.sendit?.apiUrl ?? '')) err.push('URL API Sendit invalide.');
      if (!urlOk(m.carriers?.ameex?.apiUrl ?? '')) err.push('URL API Ameex invalide.');
      break;
    }
    case 'whatsapp': {
      const m = model as WhatsappModel;
      if (!urlOk(m.connection?.apiBaseUrl ?? '')) err.push('URL de base API invalide.');
      if (!urlOk(m.connection?.webhookUrlHint ?? '')) err.push('URL webhook (référence) invalide.');
      break;
    }
    case 'meta': {
      const m = model as MetaModel;
      if (!numOk(m.ads?.attributionWindowDays ?? '', 0)) err.push('Fenêtre d’attribution : nombre positif.');
      if (!numOk(m.ads?.syncFrequencyMinutes ?? '', 1)) err.push('Fréquence synchro : nombre ≥ 1.');
      if (!numOk(m.targets?.cac ?? '', 0)) err.push('CAC cible : nombre positif.');
      if (!numOk(m.targets?.cpa ?? '', 0)) err.push('CPA cible : nombre positif.');
      if (!numOk(m.targets?.roas ?? '', 0)) err.push('ROAS cible : nombre positif.');
      break;
    }
    case 'finance': {
      const m = model as FinanceModel;
      if (!numOk(m.global?.taxPercent ?? '', 0, 100)) err.push('TVA % : nombre entre 0 et 100.');
      if (!numOk(m.cod?.delayDays ?? '', 0)) err.push('Délai COD : nombre positif.');
      break;
    }
    case 'security': {
      const m = model as SecurityModel;
      if (!intOk(m.auth?.sessionTimeoutMinutes ?? '', 5, 525600)) err.push('Durée de session : entier entre 5 et 525600.');
      if (!intOk(m.auth?.maxLoginAttempts ?? '', 1, 100)) err.push('Tentatives max : entier entre 1 et 100.');
      if (!intOk(m.passwords?.minLength ?? '', 4, 128)) err.push('Longueur mot de passe : entier entre 4 et 128.');
      if (!intOk(m.data?.auditRetentionDays ?? '', 1, 3650)) err.push('Rétention audit : entier entre 1 et 3650.');
      break;
    }
    default:
      break;
  }

  return err;
}
