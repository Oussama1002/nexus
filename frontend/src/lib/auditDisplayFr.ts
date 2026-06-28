import { formatCurrency } from './utils';

/**
 * Types d’entité Laravel (morph) → libellé métier FR.
 * Les utilisateurs ne voient pas les noms de classes PHP.
 */
export const AUDIT_ENTITY_LABELS_FR: Record<string, string> = {
  'App\\Models\\Product': 'Produit',
  'App\\Models\\Customer': 'Client',
  'App\\Models\\Order': 'Commande',
  'App\\Models\\User': 'Utilisateur',
  'App\\Models\\Lead': 'Lead',
  'App\\Models\\Shipment': 'Expédition',
  'App\\Models\\ShipmentEvent': 'Événement d’expédition',
  'App\\Models\\DeliveryPayment': 'Paiement livreur',
  'App\\Models\\Brand': 'Marque',
  'App\\Models\\StockMovement': 'Mouvement de stock',
  'App\\Models\\PurchaseOrder': 'Bon d’achat',
  'App\\Models\\PurchaseOrderLine': 'Ligne de bon d’achat',
  'App\\Models\\DailyKpi': 'Indicateur quotidien',
  'App\\Models\\Campaign': 'Campagne',
  'App\\Models\\CampaignMetric': 'Métrique de campagne',
  'App\\Models\\Influencer': 'Influenceur',
  'App\\Models\\Supplier': 'Fournisseur',
  'App\\Models\\SocialAccount': 'Compte social',
  'App\\Models\\InfluencerPerformance': 'Performance influenceur',
  'App\\Models\\InfluencerCollaboration': 'Collaboration influenceur',
  'App\\Models\\Strategy': 'Stratégie',
  'App\\Models\\InfluencerComplaint': 'Réclamation influenceur',
  'App\\Models\\ContentProduction': 'Production de contenu',
  'App\\Models\\DeliveryCompany': 'Transporteur',
  'App\\Models\\ContentCalendar': 'Calendrier éditorial',
  'App\\Models\\CmDailyTracking': 'Suivi quotidien CM',
  'App\\Models\\Conversation': 'Conversation',
  'App\\Models\\Message': 'Message',
  'App\\Models\\AdAccount': 'Compte publicitaire',
  'App\\Models\\InfluencerMessage': 'Message influenceur',
  'App\\Models\\Charge': 'Charge / frais',
  'App\\Models\\Employee': 'Collaborateur',
  'App\\Models\\OrderLine': 'Ligne de commande',
  'App\\Models\\LeadEvent': 'Événement lead',
  'App\\Models\\OrderEvent': 'Événement commande',
  'App\\Models\\Reminder': 'Rappel',
  'App\\Models\\AuditLog': 'Entrée d’audit',
  'App\\Models\\AutomationRule': 'Automatisation',
  'App\\Models\\SystemSetting': 'Param\u00e8tre',
  'App\\Models\\CollabProject': 'Projet collaboratif',
  'App\\Models\\CollabProjectMember': 'Membre projet',
  'App\\Models\\CollabProjectDocument': 'Document projet',
  'App\\Models\\KanbanColumn': 'Colonne Kanban',
  'App\\Models\\KanbanTask': 'T\u00e2che Kanban',
  'App\\Models\\MediaBuyingEntry': 'Fiche achat m\u00e9dia',
  'App\\Models\\InternalMessage': 'Message interne',
  'App\\Models\\HrAttendance': 'Pointage',
  'App\\Models\\ClientContract': 'Contrat client',
  'App\\Models\\ClientInvoice': 'Facture client',
  'App\\Models\\SocialPublication': 'Publication sociale',
  'App\\Models\\AccountingAccount': 'Compte comptable',
  'App\\Models\\AccountingEntry': 'Écriture comptable',
};

/** Libellés FR pour actions API (slug technique → phrase lisible). */
export const AUDIT_ACTION_LABELS_FR: Record<string, string> = {
  'products.create': 'Création de produit',
  'products.update': 'Modification de produit',
  'products.delete': 'Suppression de produit',
  'customers.create': 'Création de client',
  'customers.update': 'Modification de client',
  'customers.delete': 'Suppression de client',
  'orders.create': 'Création de commande',
  'orders.update': 'Modification de commande',
  'orders.status': 'Changement de statut de commande',
  'orders.delete': 'Suppression de commande',
  'leads.create': 'Création de lead',
  'leads.update': 'Modification de lead',
  'leads.delete': 'Suppression de lead',
  'leads.assign': 'Assignation de lead',
  'leads.status': 'Changement de statut de lead',
  'leads.convert_to_order': 'Conversion du lead en commande',
  'shipments.create': 'Création d’expédition',
  'shipments.update': 'Modification d’expédition',
  'shipments.status': 'Changement de statut d’expédition',
  'shipments.delete': 'Suppression d’expédition',
  'shipments.sync': 'Synchronisation d’expédition',
  'shipments.cancel': 'Annulation d’expédition',
  'shipment_events.create': 'Création d’événement d’expédition',
  'shipment_events.delete': 'Suppression d’événement d’expédition',
  'delivery_payments.create': 'Création de paiement livreur',
  'delivery_payments.update': 'Modification de paiement livreur',
  'delivery_payments.state': 'Changement d’état paiement livreur',
  'delivery_payments.reconcile': 'Rapprochement paiement livreur',
  'delivery_payments.delete': 'Suppression de paiement livreur',
  'auth.login': 'Connexion',
  'auth.logout': 'Déconnexion',
  'ad_accounts.create': 'Création de compte publicitaire',
  'ad_accounts.update': 'Modification de compte publicitaire',
  'ad_accounts.delete': 'Suppression de compte publicitaire',
  'brands.create': 'Création de marque',
  'brands.update': 'Modification de marque',
  'brands.delete': 'Suppression de marque',
  'stock.movement': 'Mouvement de stock',
  'purchase_orders.create': 'Création de bon d’achat',
  'purchase_orders.update': 'Modification de bon d’achat',
  'purchase_orders.delete': 'Suppression de bon d’achat',
  'purchase_orders.receive': 'Réception de bon d’achat',
  'purchase_order_lines.create': 'Création de ligne de bon d’achat',
  'purchase_order_lines.update': 'Modification de ligne de bon d’achat',
  'purchase_order_lines.delete': 'Suppression de ligne de bon d’achat',
  'daily_kpis.upsert': 'Enregistrement d’indicateur quotidien',
  'daily_kpis.update': 'Modification d’indicateur quotidien',
  'daily_kpis.delete': 'Suppression d’indicateur quotidien',
  'campaigns.create': 'Création de campagne',
  'campaigns.update': 'Modification de campagne',
  'campaigns.delete': 'Suppression de campagne',
  'campaign_metrics.create': 'Création de métrique de campagne',
  'campaign_metrics.update': 'Modification de métrique de campagne',
  'campaign_metrics.delete': 'Suppression de métrique de campagne',
  'influencers.create': 'Création d’influenceur',
  'influencers.update': 'Modification d’influenceur',
  'influencers.delete': 'Suppression d’influenceur',
  'suppliers.create': 'Création de fournisseur',
  'suppliers.update': 'Modification de fournisseur',
  'suppliers.delete': 'Suppression de fournisseur',
  'social_accounts.create': 'Création de compte social',
  'social_accounts.update': 'Modification de compte social',
  'social_accounts.delete': 'Suppression de compte social',
  'influencer_performance.create': 'Création de performance influenceur',
  'influencer_performance.update': 'Modification de performance influenceur',
  'influencer_performance.delete': 'Suppression de performance influenceur',
  'influencer_collaborations.create': 'Création de collaboration',
  'influencer_collaborations.update': 'Modification de collaboration',
  'influencer_collaborations.delete': 'Suppression de collaboration',
  'strategies.create': 'Création de stratégie',
  'strategies.update': 'Modification de stratégie',
  'strategies.delete': 'Suppression de stratégie',
  'strategies.approve': 'Approbation de stratégie',
  'influencer_complaints.create': 'Création de réclamation influenceur',
  'influencer_complaints.update': 'Modification de réclamation influenceur',
  'influencer_complaints.delete': 'Suppression de réclamation influenceur',
  'content_production.create': 'Création de production de contenu',
  'content_production.update': 'Modification de production de contenu',
  'content_production.delete': 'Suppression de production de contenu',
  'delivery_companies.create': 'Création de transporteur',
  'delivery_companies.update': 'Modification de transporteur',
  'delivery_companies.delete': 'Suppression de transporteur',
  'content_calendar.create': 'Création d’entrée calendrier',
  'content_calendar.update': 'Modification d’entrée calendrier',
  'content_calendar.delete': 'Suppression d’entrée calendrier',
  'cm_daily_tracking.upsert': 'Enregistrement de suivi CM',
  'cm_daily_tracking.update': 'Modification de suivi CM',
  'cm_daily_tracking.delete': 'Suppression de suivi CM',
  'conversations.create': 'Création de conversation',
  'conversations.update': 'Modification de conversation',
  'conversations.delete': 'Suppression de conversation',
  'messages.create': 'Envoi de message',
  'influencer_messages.create': 'Création de message influenceur',
  'influencer_messages.update': 'Modification de message influenceur',
  'influencer_messages.delete': 'Suppression de message influenceur',
  'settings.sync_group': 'Enregistrement des paramètres (section)',
  'settings.center_save': 'Enregistrement du centre de paramètres',
  'settings.create': 'Création de paramètre système',
  'settings.update': 'Modification de paramètre système',
  'settings.delete': 'Suppression de paramètre système',
  'settings.logo_upload': 'Mise à jour du logo',
  'profile.update': 'Mise à jour du profil',
  'profile.avatar_upload': 'Mise à jour de la photo de profil',
  'client_invoices.approve': 'Validation de facture',
  'client_invoices.send': 'Envoi de facture',
  'automation_rules.create': 'Cr\u00e9ation automatisation',
  'automation_rules.update': 'Modification automatisation',
  'automation_rules.delete': 'Suppression automatisation',
  'collab_projects.create': 'Cr\u00e9ation projet collaboratif',
  'collab_projects.update': 'Modification projet collaboratif',
  'collab_projects.delete': 'Suppression projet collaboratif',
  'collab_projects.member_add': 'Ajout membre au projet',
  'collab_projects.member_remove': 'Retrait membre du projet',
  'media_buying.create': 'Cr\u00e9ation fiche achat m\u00e9dia',
  'media_buying.update': 'Modification fiche achat m\u00e9dia',
  'media_buying.delete': 'Suppression fiche achat m\u00e9dia',
  'users.create': 'Cr\u00e9ation utilisateur',
  'users.update': 'Modification utilisateur',
  'users.delete': 'Suppression utilisateur',
  'employees.create': 'Cr\u00e9ation collaborateur',
  'employees.update': 'Modification collaborateur',
  'employees.delete': 'Suppression collaborateur',
  'accounting_accounts.create': 'Création compte comptable',
  'accounting_accounts.update': 'Modification compte comptable',
  'accounting_accounts.delete': 'Suppression compte comptable',
  'accounting_entries.create': 'Création écriture comptable',
  'accounting_entries.delete': 'Suppression écriture comptable',
};

export function auditEntityLabelFr(entityType: string | null | undefined): string {
  if (!entityType || String(entityType).trim() === '') return '—';
  const t = String(entityType);
  return AUDIT_ENTITY_LABELS_FR[t] ?? 'Donnée système';
}

/** Ligne sous-titre liste : « Produit · n° 12 » */
export function auditEntitySummaryFr(
  entityType: string | null | undefined,
  entityId: string | number | null | undefined,
): string {
  const label = auditEntityLabelFr(entityType);
  if (label === '—') {
    return entityId != null && entityId !== '' ? `Réf. n° ${entityId}` : '—';
  }
  if (entityId != null && entityId !== '') {
    return `${label} · n° ${entityId}`;
  }
  return label;
}

export function auditActionLabelFr(action: string): string {
  const a = (action ?? '').trim();
  if (!a) return '—';
  if (AUDIT_ACTION_LABELS_FR[a]) return AUDIT_ACTION_LABELS_FR[a];
  return 'Action enregistrée';
}

/** Options pour filtre « type d’objet » (valeur API = morph Laravel). */
export function auditEntityFilterOptions(): { value: string; label: string }[] {
  const entries = Object.entries(AUDIT_ENTITY_LABELS_FR).sort((a, b) => a[1].localeCompare(b[1], 'fr'));
  return [{ value: '', label: 'Tous les types' }, ...entries.map(([value, label]) => ({ value, label }))];
}

/** Libellés FR pour champs d’audit (snake_case API). */
export const AUDIT_FIELD_LABELS_FR: Record<string, string> = {
  id: 'Réf. interne',
  brand_id: 'Marque',
  supplier_id: 'Fournisseur',
  customer_id: 'Client',
  user_id: 'Utilisateur',
  order_id: 'Commande',
  product_id: 'Produit',
  name: 'Nom',
  sku: 'SKU',
  description: 'Description',
  price: 'Prix',
  cost: 'Coût',
  total: 'Total',
  amount: 'Montant',
  quantity: 'Quantité',
  stock_quantity: 'Stock',
  reserved_quantity: 'Réservé',
  low_stock_threshold: 'Seuil d’alerte stock',
  status: 'Statut',
  payment_method: 'Mode de paiement',
  payment_state: 'État paiement',
  shipping_address: 'Adresse livraison',
  email: 'E-mail',
  phone: 'Téléphone',
  created_at: 'Créé le',
  updated_at: 'Modifié le',
  deleted_at: 'Supprimé le',
  ip_address: 'Adresse IP',
  avatar_url: 'Photo de profil',
  logo_url: 'Logo',
  company_logo_url: 'Logo de la marque',
  action_json: 'Action (JSON)',
  condition_json: 'Condition (JSON)',
  created_by_user_id: 'Cr\u00e9\u00e9 par (ID)',
  updated_by_user_id: 'Modifi\u00e9 par (ID)',
  is_active: 'Actif',
  trigger_key: 'D\u00e9clencheur',
  assigned_user_id: 'Assign\u00e9 \u00e0 (ID)',
  assigned_to: 'Assign\u00e9 \u00e0',
  project_id: 'Projet',
  column_id: 'Colonne',
  sort_order: 'Ordre de tri',
  priority: 'Priorit\u00e9',
  due_date: '\u00c9ch\u00e9ance',
  title: 'Titre',
  objective: 'Objectif',
  asset_url: 'Lien assets',
  notes: 'Notes',
  body: 'Contenu',
  sender_id: 'Exp\u00e9diteur (ID)',
  receiver_id: 'Destinataire (ID)',
  read_at: 'Lu le',
  original_name: 'Nom du fichier',
  storage_path: 'Chemin de stockage',
  mime_type: 'Type de fichier',
  size_bytes: 'Taille (octets)',
  uploaded_by: 'Ajout\u00e9 par',
  project_role: 'R\u00f4le projet',
  is_lead: 'Responsable',
  traffic_source: 'Source de trafic',
  color: 'Couleur',
  label: 'Libell\u00e9',
  message: 'Message',
  type: 'Type',
  target: 'Cible',
  value: 'Valeur',
  field: 'Champ',
  op: 'Op\u00e9rateur',
  variants: 'Variantes',
  source: 'Source',
  platform: 'Plateforme',
  budget: 'Budget',
  spend: 'D\u00e9penses',
  clicks: 'Clics',
  impressions: 'Impressions',
  reach: 'Port\u00e9e',
  engagement: 'Engagement',
  city: 'Ville',
  address: 'Adresse',
  country: 'Pays',
  region: 'R\u00e9gion',
  company: 'Entreprise',
  website: 'Site web',
  role: 'R\u00f4le',
  weight: 'Poids',
  last_login_at: 'Derni\u00e8re connexion',
  last_login_ip: 'IP derni\u00e8re connexion',
};

function humanizeKey(key: string): string {
  return AUDIT_FIELD_LABELS_FR[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const MONEY_KEYS = /^(price|cost|total|amount|cod_amount|delivery_fee|insurance_fee|tax)$/i;

function isIsoDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T|\s)/.test(s);
}

/** Affichage lisible d’une valeur brute d’audit (pas de JSON brut dans l’UI). */
export function formatAuditFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Oui' : 'Non';
  }
  if (typeof value === 'number') {
    if (MONEY_KEYS.test(key) || key.endsWith('_amount') || key.endsWith('_fee')) {
      return formatCurrency(value);
    }
    return String(value);
  }
  if (typeof value === 'string') {
    if (isIsoDateString(value)) {
      try {
        return new Date(value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      } catch {
        return value;
      }
    }
    return value;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Ordre d’affichage préféré (champs métier d’abord). */
const KEY_PRIORITY = [
  'name',
  'sku',
  'status',
  'price',
  'cost',
  'stock_quantity',
  'reserved_quantity',
  'low_stock_threshold',
  'description',
  'brand_id',
  'supplier_id',
];

export function sortedAuditEntries(record: Record<string, unknown>): [string, unknown][] {
  const keys = Object.keys(record);
  keys.sort((a, b) => {
    const ia = KEY_PRIORITY.indexOf(a);
    const ib = KEY_PRIORITY.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return keys.map((k) => [k, record[k] as unknown]);
}

export function auditFieldLabelFr(key: string): string {
  return humanizeKey(key);
}

const IMAGE_FIELD_KEYS = new Set(['avatar_url', 'logo_url', 'company_logo_url']);

export function isAuditImageField(key: string): boolean {
  return IMAGE_FIELD_KEYS.has(key);
}
