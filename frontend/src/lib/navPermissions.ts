import type { View } from '../types';

/** Views that require every listed permission (not just one). Role fallbacks still apply after this check fails. */
export const VIEW_REQUIRES_ALL_PERMISSIONS: Partial<Record<View, string[]>> = {
  ads: ['campaigns.view', 'ad_accounts.view'],
};

/** Maps each app view to one or more API permission slugs (any match grants access). */
export const VIEW_PERMISSIONS: Partial<Record<View, string[]>> = {
  dashboard: ['dashboard.view'],
  ordersNew: ['orders.create'],
  orders: ['orders.view'],
  whatsapp: ['conversations.view'],
  confirmatrice: ['conversations.view'],
  leads: ['leads.view'],
  customers: ['customers.view'],
  academy: ['academy_courses.view'],
  mediaBuying: ['campaigns.view'],
  collabProjects: ['collab_projects.view'],
  automations: ['automations.view'],
  clientPortal: ['client_portal.view'],
  knowledgeBase: ['knowledge_base.view'],
  brands: ['brands.view'],
  products: ['products.view'],
  stock: ['stock.view'],
  delivery: ['delivery_companies.view', 'delivery_payments.view'],
  deliveryDashboard: ['delivery.dashboard'],
  purchaseOrders: ['purchase_orders.view'],
  trackingParcels: ['shipments.view'],
  suppliers: ['suppliers.view'],
  reporting: ['reports.view'],
  hr: ['hr.view'],
  finance: ['finance.view'],
  comptabilite: ['accounting.view'],
  settings: ['settings.view'],
  tracking: ['audit_logs.view'],
  usersAdmin: ['users.view'],
  socialMedia: ['social_accounts.view'],
  influenceHub: ['influence.view', 'influencer_collaborations.view'],
  amWorkspace: ['am_roadmap.view'],
  amConfig: ['am_config.view'],
  complaints: ['complaints.view'],
  teamPerformance: ['team_performance.view'],
  socialPublishing: ['social_accounts.view'],
  socialAccounts: ['social_accounts.view'],
  socialComplaints: ['social_complaints.view'],
  deliveryFailures: ['shipments.view'],
  returns: ['shipments.view'],
  stockMovements: ['stock.view'],
  employees: ['hr.view'],
  hrDocuments: ['hr.view'],
  orgChart: ['hr.view'],
  attendance: ['hr.view'],
  // Everyone can request their own leave; HR sees all requests.
  leaves: [],
  // Dossier personnel : chacun a le sien (self-service).
  myHrFile: [],
  payroll: ['hr.view'],
  openPositions: ['hr.view'],
  applications: ['hr.view'],
  onboarding: ['hr.view'],
  training: ['hr.view'],
  evaluations: ['hr.view'],
  discipline: ['hr.view'],
  // Everyone gets internal messaging — no permission required (the endpoint
  // itself scopes to the caller's own threads/groups).
  internalComms: [],
  // Everyone gets their own notifications feed too.
  notifications: [],
  treasury: ['finance.view'],
  budgets: ['finance.view'],
  budgetRequests: ['finance.view'],
  expenses: ['finance.view'],
  clientInvoices: ['finance.view'],
  clientContracts: ['finance.view'],
  myTrainings: ['academy_courses.view'],
  learningPaths: ['academy_courses.view'],
  contentManagement: ['academy_courses.view'],
  rolesPermissions: ['users.view'],
  bugsIncidents: ['settings.view'],
  integrations: ['settings.view'],
};

const ALL_VIEWS: View[] = [
  'dashboard',
  'ordersNew',
  'orders',
  'whatsapp',
  'confirmatrice',
  'leads',
  'customers',
  'academy',
  'mediaBuying',
  'collabProjects',
  'automations',
  'clientPortal',
  'knowledgeBase',
  'brands',
  'ads',
  'products',
  'stock',
  'delivery',
  'deliveryDashboard',
  'trackingParcels',
  'suppliers',
  'purchaseOrders',
  'reporting',
  'hr',
  'finance',
  'settings',
  'tracking',
  'usersAdmin',
  'socialMedia',
  'influenceHub',
  'amWorkspace',
  'amConfig',
  'notifications',
  'comptabilite',
  'complaints',
  'teamPerformance',
  'socialPublishing',
  'socialAccounts',
  'socialComplaints',
  'myHrFile',
  'deliveryFailures',
  'returns',
  'stockMovements',
  'employees',
  'hrDocuments',
  'orgChart',
  'attendance',
  'leaves',
  'payroll',
  'openPositions',
  'applications',
  'onboarding',
  'training',
  'evaluations',
  'discipline',
  'internalComms',
  'treasury',
  'budgets',
  'budgetRequests',
  'expenses',
  'clientInvoices',
  'clientContracts',
  'myTrainings',
  'learningPaths',
  'contentManagement',
  'rolesPermissions',
  'bugsIncidents',
  'integrations',
];

/**
 * Écrans de gestion RH masqués pour la confirmatrice (spec « Droits d'accès
 * Confirmatrice » §A.1). Elle conserve Communication interne, Projets
 * collaboratifs et Congés (self-service), qui vivent aussi sous Équipe & RH.
 */
const CONFIRMATRICE_HIDDEN_VIEWS: View[] = [
  'mediaBuying', 'ads',
  'hr', 'employees', 'hrDocuments', 'orgChart', 'attendance', 'payroll',
  'openPositions', 'applications', 'onboarding', 'training', 'evaluations', 'discipline',
  // §A.3 — Transporteurs & COD : hors périmètre de la confirmatrice.
  'delivery',
];

/**
 * Rôles « à périmètre fermé » (spec Revue SMM §5) : ces rôles ne voient QUE les
 * modules de leur métier, même si des permissions plus larges leur sont
 * accordées. Un utilisateur qui cumule plusieurs de ces rôles voit l'UNION de
 * leurs périmètres (ex. SMM + influence = les deux). Les vues universelles
 * (notifications, messagerie interne, congés, profil) restent toujours
 * accessibles via les règles qui précèdent ce test.
 */
const SCOPED_ROLE_VIEWS: Partial<Record<string, View[]>> = {
  smm: [
    'dashboard', 'socialMedia', 'socialPublishing', 'socialAccounts',
    'brands', 'knowledgeBase', 'academy', 'myTrainings', 'collabProjects',
  ],
  influence_manager: [
    'dashboard', 'influenceHub', 'brands', 'knowledgeBase', 'academy',
    'myTrainings', 'collabProjects',
  ],
  // Community Manager (spec Droits CM) : répondre, publier, suivre les
  // réclamations. Ni stratégie, ni media buying, ni call center, ni RH.
  community_manager: [
    'dashboard', 'socialMedia', 'socialPublishing', 'socialAccounts', 'socialComplaints',
    'brands', 'knowledgeBase', 'academy', 'myTrainings', 'collabProjects',
  ],
};

/** When the API returns no matching permission rows yet, fall back to role slug lists (backend RolesSeeder). */
export const ROLE_DEFAULT_VIEWS: Record<string, View[]> = {
  admin: ALL_VIEWS,
  manager_operationnel: ALL_VIEWS.filter((v) => v !== 'settings' && v !== 'hr'),
  confirmatrice: ['confirmatrice', 'whatsapp', 'customers', 'ordersNew', 'orders', 'complaints', 'trackingParcels', 'knowledgeBase', 'academy', 'myTrainings', 'automations', 'collabProjects'],
  media_buyer: ['dashboard', 'ads', 'mediaBuying', 'collabProjects', 'reporting', 'automations'],
  stock_manager: ['dashboard', 'products', 'stock', 'stockMovements', 'delivery', 'deliveryDashboard', 'trackingParcels', 'deliveryFailures', 'returns', 'suppliers', 'purchaseOrders', 'knowledgeBase', 'academy', 'automations', 'mediaBuying', 'collabProjects'],
  community_manager: ['dashboard', 'whatsapp', 'leads', 'customers', 'brands', 'ads', 'mediaBuying', 'collabProjects', 'socialMedia', 'socialPublishing', 'socialAccounts', 'knowledgeBase', 'academy', 'automations'],
  smm: ['dashboard', 'brands', 'ads', 'mediaBuying', 'collabProjects', 'reporting', 'leads', 'customers', 'socialMedia', 'socialPublishing', 'socialAccounts', 'influenceHub', 'knowledgeBase', 'academy', 'automations'],
  influence_manager: ['dashboard', 'brands', 'leads', 'customers', 'influenceHub', 'reporting', 'academy', 'automations', 'mediaBuying', 'collabProjects'],
  comptable: ['dashboard', 'comptabilite', 'finance', 'treasury', 'budgets', 'budgetRequests', 'expenses'],
  client_brand_owner: ['clientPortal', 'amWorkspace'],
  account_manager: ['dashboard', 'brands', 'customers', 'leads', 'mediaBuying', 'socialMedia', 'influenceHub', 'amWorkspace', 'collabProjects', 'reporting', 'academy', 'automations'],
};

/**
 * True quand l'utilisateur n'a QUE des rôles à périmètre fermé (SMM, influence).
 * Sert à masquer les données commerciales/financières hors de leur métier
 * (tableau de bord, rapports, notifications — spec Revue SMM §5). Un rôle non
 * fermé (admin, manager…) renvoie false et rétablit la vue complète.
 */
export function hasOnlyScopedRoles(roleSlugs: string[]): boolean {
  return roleSlugs.length > 0 && roleSlugs.every((r) => !!SCOPED_ROLE_VIEWS[r]);
}

export function userHasPermissionSlug(userSlugs: Set<string>, required: string): boolean {
  if (userSlugs.has(required)) return true;
  const dot = required.lastIndexOf('.');
  if (dot <= 0) return false;
  const mod = required.slice(0, dot);
  return userSlugs.has(`${mod}.*`);
}

export function hasAnyPermission(userSlugs: Set<string>, required: string[]): boolean {
  return required.some((req) => userHasPermissionSlug(userSlugs, req));
}

export function hasAllPermissions(userSlugs: Set<string>, required: string[]): boolean {
  return required.every((req) => userHasPermissionSlug(userSlugs, req));
}

export function canAccessView(
  view: View,
  ctx: { isAdmin: boolean; permissionSlugs: Set<string>; roleSlugs: string[]; managesTeam?: boolean },
): boolean {
  if (view === 'profile') return true;
  if (ctx.isAdmin) return true;
  // Automatisations: administrators only, whatever the role permissions say.
  if (view === 'automations') return false;
  // A view whose VIEW_PERMISSIONS entry is an explicit empty array is
  // universally accessible (e.g. internal messaging — everyone has DMs).
  const explicit = VIEW_PERMISSIONS[view];
  if (Array.isArray(explicit) && explicit.length === 0) return true;
  // Rôles à périmètre fermé (spec Revue SMM §5) : si TOUS les rôles de
  // l'utilisateur sont des rôles fermés, il ne voit que l'union de leurs
  // périmètres — peu importe les permissions accordées. Un rôle non fermé
  // (admin, manager…) fait retomber dans la logique normale, plus large.
  if (ctx.roleSlugs.length > 0 && ctx.roleSlugs.every((r) => SCOPED_ROLE_VIEWS[r])) {
    const allowed = new Set<View>();
    for (const r of ctx.roleSlugs) {
      for (const v of SCOPED_ROLE_VIEWS[r] ?? []) allowed.add(v);
    }
    // Présence RH visible seulement si le rôle encadre une équipe (spec §5).
    if (ctx.managesTeam) allowed.add('attendance');
    return allowed.has(view);
  }
  if (ctx.roleSlugs.length === 1 && ctx.roleSlugs[0] === 'client_brand_owner') {
    if (view !== 'clientPortal') return false;
  }
  /** Confirmatrices use dedicated workflows; media buying, ads & HR-management screens are hidden for this role. */
  if (ctx.roleSlugs.includes('confirmatrice') && CONFIRMATRICE_HIDDEN_VIEWS.includes(view)) return false;
  const allReq = VIEW_REQUIRES_ALL_PERMISSIONS[view];
  if (allReq?.length && hasAllPermissions(ctx.permissionSlugs, allReq)) return true;
  const required = VIEW_PERMISSIONS[view];
  if (required?.length && hasAnyPermission(ctx.permissionSlugs, required)) return true;
  for (const role of ctx.roleSlugs) {
    const allowed = ROLE_DEFAULT_VIEWS[role];
    if (allowed?.includes(view)) return true;
  }
  return false;
}
