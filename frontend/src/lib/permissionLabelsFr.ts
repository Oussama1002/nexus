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
  delivery_failures: 'Échecs de livraison',
  returns: 'Retours',
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
  cm_tracking: 'Suivi CM',
  social_accounts: 'Comptes sociaux',
  social_publications: 'Publications sociales',
  // SMM (Community Manager)
  smm_strategy: 'SMM — Stratégie',
  smm_plans: 'SMM — Plans mensuels',
  smm_contents: 'SMM — Contenus',
  smm_briefs: 'SMM — Briefs',
  smm_publication: 'SMM — Publication',
  smm_events: 'SMM — Événements',
  smm_qc: 'SMM — Contrôle qualité',
  smm_execution: 'SMM — Exécution',
  smm_insights: 'SMM — Insights client',
  smm_learnings: 'SMM — Apprentissages',
  smm_reports: 'SMM — Rapports mensuels',
  smm_automations: 'SMM — Automatisations',
  smm_veille: 'SMM — Veille',
  // Influence
  influence: 'Influence',
  influencer_collaborations: 'Collaborations influenceurs',
  influencer_performance: 'Performance influenceurs',
  influencer_messages: 'Messages influenceurs',
  influencer_complaints: 'Réclamations influenceurs',
  influencer_deliverables: 'Livrables influenceurs',
  influencer_documents: 'Documents influenceurs',
  influencer_payments: 'Paiements influenceurs',
  influencer_shipments: 'Envois influenceurs',
  // Finance
  finance: 'Finance',
  accounting: 'Comptabilité',
  treasury: 'Trésorerie',
  budgets: 'Budgets',
  budget_requests: 'Demandes de budget',
  // HR
  hr: 'Ressources humaines',
  hr_career: 'RH — Carrière',
  hr_communications: 'RH — Communications',
  hr_discipline: 'RH — Discipline',
  hr_documents: 'RH — Documents',
  hr_evaluations: 'RH — Évaluations',
  hr_leaves: 'RH — Congés',
  hr_onboarding: 'RH — Onboarding',
  hr_payroll: 'RH — Paie',
  hr_recruitment: 'RH — Recrutement',
  hr_training: 'RH — Formation',
  team_performance: 'Performance équipe',
  // Academy
  academy_contents: 'Académie — Contenus',
  learning_paths: 'Parcours d’apprentissage',
  // AM (Pilotage de marque)
  am_alert: 'AM — Alertes',
  am_chantier: 'AM — Chantiers',
  am_client_meeting: 'AM — Rendez-vous client',
  am_compliance: 'AM — Conformité',
  am_config: 'AM — Configuration',
  am_decision: 'AM — Décisions',
  am_deliverable: 'AM — Livrables',
  am_derogation: 'AM — Dérogations',
  am_gate: 'AM — Portes de phase',
  am_report_client: 'AM — Rapport client',
  am_roadmap: 'AM — Feuille de route',
  am_test: 'AM — Tests',
  // Divers
  bugs_incidents: 'Bugs & incidents',
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
  activate: 'Activer',
  cancel: 'Annuler',
  close: 'Clôturer',
  decide: 'Décider',
  diffuse: 'Diffuser',
  escalate: 'Escalader',
  finalize: 'Finaliser',
  publish: 'Publier',
  qualify: 'Qualifier',
  receive: 'Réceptionner',
  request: 'Demander',
  request_transit: 'Demander un transit',
  resolve: 'Résoudre',
  submit: 'Soumettre',
  suspend: 'Suspendre',
  suspend_lift: 'Lever la suspension',
  take: 'Prendre en charge',
  transmit: 'Transmettre',
  verdict: 'Rendre un verdict',
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
