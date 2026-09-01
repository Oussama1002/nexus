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
  deliveryFailures: ['shipments.view'],
  returns: ['shipments.view'],
  stockMovements: ['stock.view'],
  employees: ['hr.view'],
  hrDocuments: ['hr.view'],
  orgChart: ['hr.view'],
  attendance: ['hr.view'],
  leaves: ['hr.view'],
  payroll: ['hr.view'],
  openPositions: ['hr.view'],
  applications: ['hr.view'],
  onboarding: ['hr.view'],
  training: ['hr.view'],
  evaluations: ['hr.view'],
  discipline: ['hr.view'],
  internalComms: ['hr.view'],
  treasury: ['finance.view'],
  budgets: ['finance.view'],
  budgetRequests: ['finance.view'],
  expenses: ['finance.view'],
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
  'comptabilite',
  'complaints',
  'teamPerformance',
  'socialPublishing',
  'socialAccounts',
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
  'myTrainings',
  'learningPaths',
  'contentManagement',
  'rolesPermissions',
  'bugsIncidents',
  'integrations',
];

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
  ctx: { isAdmin: boolean; permissionSlugs: Set<string>; roleSlugs: string[] },
): boolean {
  if (view === 'profile') return true;
  if (ctx.isAdmin) return true;
  if (ctx.roleSlugs.length === 1 && ctx.roleSlugs[0] === 'client_brand_owner') {
    if (view !== 'clientPortal') return false;
  }
  /** Confirmatrices use dedicated workflows; leads, media buying & ads modules are hidden for this role. */
  if (ctx.roleSlugs.includes('confirmatrice') && ['leads', 'mediaBuying', 'ads'].includes(view)) return false;
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
