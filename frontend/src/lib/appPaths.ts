import type { View } from '../types';

/**
 * Segments d’URL pour chaque écran (SPA). Les paramètres utilisent /parametres et /parametres/technique.
 */
export const VIEW_PATH: Record<Exclude<View, 'login' | 'settings'>, string> = {
  dashboard: '/dashboard',
  ordersNew: '/commandes/nouvelle',
  orders: '/commandes',
  whatsapp: '/conversations',
  confirmatrice: '/confirmatrice',
  leads: '/leads',
  customers: '/clients',
  brands: '/marques',
  socialMedia: '/social',
  ads: '/campagnes',
  academy: '/academy',
  mediaBuying: '/media-buying',
  collabProjects: '/projets-collaboratifs',
  automations: '/automatisations',
  clientPortal: '/espace-client',
  knowledgeBase: '/base-marque',
  products: '/produits',
  stock: '/stocks',
  delivery: '/livraison',
  deliveryDashboard: '/livraison/kpi',
  trackingParcels: '/colis',
  suppliers: '/fournisseurs',
  purchaseOrders: '/achats-fournisseurs',
  influenceHub: '/influence',
  comptabilite: '/comptabilite',
  reporting: '/reportings',
  hr: '/rh',
  finance: '/finance',
  usersAdmin: '/utilisateurs',
  tracking: '/historique',
  profile: '/profil',
  complaints: '/reclamations',
  teamPerformance: '/pilotage-equipe',
  socialPublishing: '/social/publication',
  socialAccounts: '/social/comptes',
  deliveryFailures: '/livraison/echecs',
  returns: '/retours',
  stockMovements: '/mouvements-stock',
  employees: '/rh/employes',
  hrDocuments: '/rh/documents',
  orgChart: '/rh/organigramme',
  attendance: '/rh/presence',
  leaves: '/rh/conges',
  payroll: '/rh/paie',
  openPositions: '/rh/postes',
  applications: '/rh/candidatures',
  onboarding: '/rh/integration',
  training: '/rh/formation',
  evaluations: '/rh/evaluations',
  discipline: '/rh/discipline',
  internalComms: '/rh/communication',
  treasury: '/finance/tresorerie',
  budgets: '/finance/budgets',
  budgetRequests: '/finance/demandes-budget',
  expenses: '/finance/depenses',
  myTrainings: '/academy/mes-formations',
  learningPaths: '/academy/parcours',
  contentManagement: '/academy/gestion-contenus',
  rolesPermissions: '/roles-permissions',
  bugsIncidents: '/bugs-incidents',
  integrations: '/integrations',
  amWorkspace: '/pilotage-de-marque',
  amConfig: '/pilotage-de-marque/config',
};

export type SettingsMode = 'center' | 'advanced';

export type ParsedAppPath =
  | { view: Exclude<View, 'settings'> }
  | { view: 'settings'; settingsMode: SettingsMode };

/** Chemin React Router pour un écran. */
export function pathForView(view: View, settingsMode: SettingsMode = 'center'): string {
  if (view === 'login') return '/login';
  if (view === 'settings') {
    return settingsMode === 'advanced' ? '/parametres/technique' : '/parametres';
  }
  return VIEW_PATH[view];
}

/** Interprète l’URL courante → écran + sous-onglet paramètres. */
export function parseAppPath(pathname: string): ParsedAppPath {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p === '/parametres/technique') return { view: 'settings', settingsMode: 'advanced' };
  if (p === '/parametres') return { view: 'settings', settingsMode: 'center' };

  if (p === '/' || p === '') return { view: 'dashboard' };

  const hit = (Object.entries(VIEW_PATH) as [Exclude<View, 'login' | 'settings'>, string][]).find(([, url]) => url === p);
  if (hit) return { view: hit[0] };

  return { view: 'dashboard' };
}
