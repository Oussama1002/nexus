/** Valeurs API (anglais) — libellés FR côté UI. */

export const CLIENT_SOURCE_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'ads', label: 'Ads' },
  { value: 'influencer', label: 'Influenceur' },
  { value: 'site', label: 'Site' },
  { value: 'manual', label: 'Manuel' },
  { value: 'referral', label: 'Référence' },
] as const;

export const LIFECYCLE_OPTIONS = [
  { value: 'new', label: 'Nouveau' },
  { value: 'active', label: 'Actif' },
  { value: 'loyal', label: 'Fidèle' },
  { value: 'inactive', label: 'Inactif' },
  { value: 'blacklisted', label: 'Blacklisté' },
] as const;

export const CLIENT_TYPE_OPTIONS = [
  { value: 'individual', label: 'Particulier' },
  { value: 'reseller', label: 'Revendeur' },
  { value: 'vip', label: 'VIP' },
] as const;

export const INTEREST_LEVEL_OPTIONS = [
  { value: 'low', label: 'Faible' },
  { value: 'medium', label: 'Moyen' },
  { value: 'high', label: 'Élevé' },
  { value: 'hot', label: 'Très chaud' },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: 'darija', label: 'Darija' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'Arabe' },
] as const;

export const PAYMENT_PREF_OPTIONS = [
  { value: 'cod', label: 'COD' },
  { value: 'transfer', label: 'Virement' },
  { value: 'online', label: 'Paiement en ligne' },
] as const;

export type CustomerFormState = {
  full_name: string;
  phone: string;
  phone_secondary: string;
  email: string;
  city: string;
  neighborhood: string;
  address: string;
  client_source: string;
  lifecycle_status: string;
  client_type: string;
  interest_level: string;
  delivery_city: string;
  delivery_address: string;
  delivery_landmark: string;
  delivery_zone: string;
  default_shipping_fee: string;
  preferred_products: string;
  preferred_variant: string;
  preferred_language: string;
  preferred_payment: string;
  internal_notes: string;
  blacklist_reason: string;
  risk_score: string;
  assigned_user_id: string;
  origin_lead_id: string;
  status: string;
};

export const emptyCustomerForm = (): CustomerFormState => ({
  full_name: '',
  phone: '',
  phone_secondary: '',
  email: '',
  city: '',
  neighborhood: '',
  address: '',
  client_source: '',
  lifecycle_status: 'new',
  client_type: '',
  interest_level: '',
  delivery_city: '',
  delivery_address: '',
  delivery_landmark: '',
  delivery_zone: '',
  default_shipping_fee: '',
  preferred_products: '',
  preferred_variant: '',
  preferred_language: '',
  preferred_payment: '',
  internal_notes: '',
  blacklist_reason: '',
  risk_score: '',
  assigned_user_id: '',
  origin_lead_id: '',
  status: 'active',
});

export function customerToForm(c: Record<string, unknown>): CustomerFormState {
  const g = (k: string) => (c[k] != null && c[k] !== undefined ? String(c[k]) : '');
  return {
    full_name: g('full_name'),
    phone: g('phone'),
    phone_secondary: g('phone_secondary'),
    email: g('email'),
    city: g('city'),
    neighborhood: g('neighborhood'),
    address: g('address'),
    client_source: g('client_source'),
    lifecycle_status: g('lifecycle_status') || g('status') || 'new',
    client_type: g('client_type'),
    interest_level: g('interest_level'),
    delivery_city: g('delivery_city'),
    delivery_address: g('delivery_address'),
    delivery_landmark: g('delivery_landmark'),
    delivery_zone: g('delivery_zone'),
    default_shipping_fee: c['default_shipping_fee'] != null ? String(c['default_shipping_fee']) : '',
    preferred_products: g('preferred_products'),
    preferred_variant: g('preferred_variant'),
    preferred_language: g('preferred_language'),
    preferred_payment: g('preferred_payment'),
    internal_notes: g('internal_notes'),
    blacklist_reason: g('blacklist_reason'),
    risk_score: g('risk_score'),
    assigned_user_id: g('assigned_user_id'),
    origin_lead_id: g('origin_lead_id'),
    status: g('status') || 'active',
  };
}

export function labelFromOptions(options: readonly { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value;
}

export function formToApiPayload(form: CustomerFormState, options?: { includeOriginLead?: boolean }): Record<string, unknown> {
  const num = (s: string) => {
    const t = s.trim();
    if (!t) return undefined;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : undefined;
  };
  const int = (s: string) => {
    const t = s.trim();
    if (!t) return undefined;
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : undefined;
  };

  const body: Record<string, unknown> = {
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    phone_secondary: form.phone_secondary.trim() || null,
    email: form.email.trim() || null,
    city: form.city.trim(),
    neighborhood: form.neighborhood.trim() || null,
    address: form.address.trim() || null,
    client_source: form.client_source || null,
    lifecycle_status: form.lifecycle_status || null,
    client_type: form.client_type || null,
    interest_level: form.interest_level || null,
    delivery_city: form.delivery_city.trim() || null,
    delivery_address: form.delivery_address.trim() || null,
    delivery_landmark: form.delivery_landmark.trim() || null,
    delivery_zone: form.delivery_zone.trim() || null,
    default_shipping_fee: num(form.default_shipping_fee) ?? null,
    preferred_products: form.preferred_products.trim() || null,
    preferred_variant: form.preferred_variant.trim() || null,
    preferred_language: form.preferred_language || null,
    preferred_payment: form.preferred_payment || null,
    internal_notes: form.internal_notes.trim() || null,
    blacklist_reason: form.blacklist_reason.trim() || null,
    risk_score: int(form.risk_score) ?? null,
    assigned_user_id: int(form.assigned_user_id) ?? null,
  };

  if (options?.includeOriginLead) {
    const ol = int(form.origin_lead_id);
    if (ol) body.origin_lead_id = ol;
  }

  return body;
}
