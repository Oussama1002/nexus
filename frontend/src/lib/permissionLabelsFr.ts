/** Libellés français pour la matrice des permissions (évite d’afficher les slugs API). */

export const PERMISSION_MODULE_LABELS_FR: Record<string, string> = {
  dashboard: 'Tableau de bord',
  users: 'Utilisateurs',
  brands: 'Marques',
  customers: 'Clients',
  leads: 'Leads',
  conversations: 'Conversations',
  orders: 'Commandes',
  products: 'Produits',
  stock: 'Stocks',
  suppliers: 'Fournisseurs',
  purchase_orders: 'Commandes fournisseurs',
  shipments: 'Expéditions',
  delivery: 'Livraison',
  delivery_companies: 'Transporteurs',
  delivery_payments: 'Règlements livraison',
  campaigns: 'Campagnes',
  ad_accounts: 'Comptes publicitaires',
  campaign_metrics: 'Indicateurs campagne',
  automations: 'Automatisations personnalisées',
  client_portal: 'Espace client externe',
  collab_projects: 'Projets collaboratifs',
  social: 'Réseaux sociaux',
  strategies: 'Stratégies',
  content_calendar: 'Calendrier éditorial',
  content_production: 'Production contenu',
  cm_daily_tracking: 'Suivi CM quotidien',
  social_accounts: 'Comptes sociaux',
  social_publications: 'Publications sociales',
  cm_tracking: 'Suivi CM',
  influence: 'Influence',
  influencer_collaborations: 'Collaborations influenceurs',
  influencer_performance: 'Performance influenceurs',
  influencer_messages: 'Messages influenceurs',
  influencer_complaints: 'Réclamations influenceurs',
  finance: 'Finance',
  hr: 'Ressources humaines',
  reports: 'Rapports',
  audit_logs: 'Journal d’audit',
  settings: 'Paramètres système',
  roles: 'Rôles',
  permissions: 'Permissions',
  autre: 'Autre',
};

export const PERMISSION_ACTION_LABELS_FR: Record<string, string> = {
  dashboard: 'Tableau de bord',
  view: 'Consulter',
  create: 'Créer',
  update: 'Modifier',
  delete: 'Supprimer',
  approve: 'Approuver',
  validate: 'Valider',
  manage: 'Gérer',
  reconcile: 'Réconcilier',
  sync: 'Synchroniser',
  label: 'Étiquette',
  status: 'Statut',
  view_salary: 'Voir les salaires',
  run: 'Exécuter / tester',
};

/**
 * Libellé lisible FR à partir du slug `module.action` ou des champs API.
 */
export function permissionDisplayLabelFr(slug: string, module: string | null, fallbackName?: string | null): string {
  const dot = slug.lastIndexOf('.');
  const mod = dot > 0 ? slug.slice(0, dot) : (module ?? '');
  const action = dot > 0 ? slug.slice(dot + 1) : '';

  const modLabel = PERMISSION_MODULE_LABELS_FR[mod] ?? PERMISSION_MODULE_LABELS_FR[module ?? ''] ?? formatModuleFallback(mod || module || '');
  const actLabel = PERMISSION_ACTION_LABELS_FR[action] ?? formatActionFallback(action);

  if (modLabel && actLabel) {
    return `${modLabel} — ${actLabel}`;
  }
  if (fallbackName?.trim()) {
    return fallbackName.trim();
  }
  return slug;
}

function formatModuleFallback(raw: string): string {
  if (!raw) return '';
  return raw
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatActionFallback(raw: string): string {
  if (!raw) return '';
  return PERMISSION_ACTION_LABELS_FR[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ');
}

export function permissionModuleTitleFr(moduleKey: string): string {
  return PERMISSION_MODULE_LABELS_FR[moduleKey] ?? formatModuleFallback(moduleKey);
}
