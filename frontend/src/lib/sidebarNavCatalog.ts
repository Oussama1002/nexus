import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Barcode,
  BookOpen,
  Bot,
  Briefcase,
  Calculator,
  CalendarCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  Clock,
  Cog,
  Contact,
  DollarSign,
  FileText,
  FolderOpen,
  GraduationCap,
  Headphones,
  History,
  Home,
  Layout,
  Megaphone,
  MessageCircle,
  Network,
  Package,
  PieChart,
  Plug,
  RotateCcw,
  Scale,
  Settings,
  Share2,
  ShieldUser,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  Truck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  Warehouse,
  Bug,
  Globe,
  Award,
  BookMarked,
  Send,
  ShieldAlert,
  BriefcaseMedical,
  Receipt,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ArrowLeftRight,
  GitBranch,
} from 'lucide-react';
import type { View } from '../types';

export type NavBlockId = 'pilotage' | 'operations' | 'ressources' | 'referentiels' | 'systeme';

export type NavBlockDef = {
  id: NavBlockId;
  label: string;
  order: number;
};

export const NAV_BLOCKS: NavBlockDef[] = [
  { id: 'pilotage', label: 'PILOTAGE', order: 1 },
  { id: 'operations', label: 'OPÉRATIONS', order: 2 },
  { id: 'ressources', label: 'RESSOURCES', order: 3 },
  { id: 'referentiels', label: 'RÉFÉRENTIELS', order: 4 },
  { id: 'systeme', label: 'SYSTÈME', order: 5 },
];

export type NavCatalogEntry = {
  id: string;
  label: string;
  level: 1 | 2 | 3;
  block: NavBlockId;
  parentId: string | null;
  order: number;
  icon: LucideIcon;
  view?: View;
  confirmatriceView?: View;
  confirmatriceLabel?: string;
  configurable?: boolean;
};

export const NAV_CATALOG: NavCatalogEntry[] = [
  // ═══════════════════════════════════════════
  // BLOC PILOTAGE
  // ═══════════════════════════════════════════
  { id: 'tableau-de-bord', label: 'Tableau de bord', level: 1, block: 'pilotage', parentId: null, order: 1, icon: Home, view: 'dashboard' },
  { id: 'rapports', label: 'Rapports', level: 1, block: 'pilotage', parentId: null, order: 2, icon: PieChart, view: 'reporting' },

  // ═══════════════════════════════════════════
  // BLOC OPÉRATIONS
  // ═══════════════════════════════════════════

  // ── Call Center ──
  { id: 'call-center', label: 'Call Center', level: 1, block: 'operations', parentId: null, order: 1, icon: Headphones },
  { id: 'espace-confirmatrice', label: 'Espace Confirmatrice', confirmatriceLabel: 'Votre espace', level: 2, block: 'operations', parentId: 'call-center', order: 1, icon: Headphones, view: 'confirmatrice', confirmatriceView: 'whatsapp' },
  { id: 'leads', label: 'Leads', level: 2, block: 'operations', parentId: 'call-center', order: 2, icon: Users, view: 'leads' },
  { id: 'commandes', label: 'Commandes', level: 2, block: 'operations', parentId: 'call-center', order: 3, icon: Package, view: 'orders' },
  { id: 'clients', label: 'Clients', level: 2, block: 'operations', parentId: 'call-center', order: 4, icon: Contact, view: 'customers' },
  { id: 'reclamations', label: 'Réclamations', level: 2, block: 'operations', parentId: 'call-center', order: 5, icon: AlertTriangle, view: 'complaints' },
  { id: 'pilotage-equipe', label: "Pilotage d'équipe", level: 2, block: 'operations', parentId: 'call-center', order: 6, icon: ChartNoAxesCombined, view: 'teamPerformance' },

  // ── Marketing ──
  { id: 'marketing', label: 'Marketing', level: 1, block: 'operations', parentId: null, order: 2, icon: Megaphone },
  { id: 'reseaux-sociaux', label: 'Réseaux sociaux', level: 2, block: 'operations', parentId: 'marketing', order: 1, icon: Share2 },
  { id: 'strategie-contenu', label: 'Stratégie & contenu', level: 3, block: 'operations', parentId: 'reseaux-sociaux', order: 1, icon: BookMarked, view: 'socialMedia' },
  { id: 'publication-moderation', label: 'Publication & modération', level: 3, block: 'operations', parentId: 'reseaux-sociaux', order: 2, icon: Send, view: 'socialPublishing' },
  { id: 'comptes-sociaux', label: 'Comptes sociaux', level: 3, block: 'operations', parentId: 'reseaux-sociaux', order: 3, icon: Globe, view: 'socialAccounts' },
  { id: 'media-buying', label: 'Media Buying', level: 2, block: 'operations', parentId: 'marketing', order: 2, icon: Target, view: 'mediaBuying' },
  { id: 'gestion-influenceurs', label: 'Gestion des influenceurs', level: 2, block: 'operations', parentId: 'marketing', order: 3, icon: Sparkles, view: 'influenceHub' },

  // ── Logistique ──
  { id: 'logistique', label: 'Logistique', level: 1, block: 'operations', parentId: null, order: 3, icon: Truck },
  { id: 'expeditions-suivi', label: 'Expéditions & suivi', level: 2, block: 'operations', parentId: 'logistique', order: 1, icon: Package, view: 'trackingParcels' },
  { id: 'echecs-livraison', label: 'Échecs de livraison', level: 2, block: 'operations', parentId: 'logistique', order: 2, icon: AlertTriangle, view: 'deliveryFailures' },
  { id: 'retours', label: 'Retours', level: 2, block: 'operations', parentId: 'logistique', order: 3, icon: RotateCcw, view: 'returns' },
  { id: 'transporteurs', label: 'Transporteurs', level: 2, block: 'operations', parentId: 'logistique', order: 4, icon: Truck, view: 'delivery' },

  // ── Catalogue & Stock ──
  { id: 'catalogue-stock', label: 'Catalogue & Stock', level: 1, block: 'operations', parentId: null, order: 4, icon: Barcode },
  { id: 'produits', label: 'Produits', level: 2, block: 'operations', parentId: 'catalogue-stock', order: 1, icon: Barcode, view: 'products' },
  { id: 'stocks', label: 'Stocks', level: 2, block: 'operations', parentId: 'catalogue-stock', order: 2, icon: Warehouse, view: 'stock' },
  { id: 'mouvements-stock', label: 'Mouvements de stock', level: 2, block: 'operations', parentId: 'catalogue-stock', order: 3, icon: ArrowLeftRight, view: 'stockMovements' },
  { id: 'fournisseurs', label: 'Fournisseurs', level: 2, block: 'operations', parentId: 'catalogue-stock', order: 4, icon: ShoppingCart, view: 'suppliers' },
  { id: 'achats-receptions', label: 'Achats & réceptions', level: 2, block: 'operations', parentId: 'catalogue-stock', order: 5, icon: ClipboardList, view: 'purchaseOrders' },

  // ═══════════════════════════════════════════
  // BLOC RESSOURCES
  // ═══════════════════════════════════════════

  // ── Équipe & RH ──
  { id: 'equipe-rh', label: 'Équipe & RH', level: 1, block: 'ressources', parentId: null, order: 1, icon: Briefcase },
  { id: 'tableau-bord-rh', label: 'Tableau de bord RH', level: 2, block: 'ressources', parentId: 'equipe-rh', order: 1, icon: Layout, view: 'hr' },
  { id: 'dossiers-salaries', label: 'Dossiers salariés', level: 2, block: 'ressources', parentId: 'equipe-rh', order: 2, icon: FolderOpen },
  { id: 'fiches-employes', label: 'Fiches employés', level: 3, block: 'ressources', parentId: 'dossiers-salaries', order: 1, icon: Contact, view: 'employees' },
  { id: 'documents-rh', label: 'Documents RH', level: 3, block: 'ressources', parentId: 'dossiers-salaries', order: 2, icon: FileText, view: 'hrDocuments' },
  { id: 'organigramme', label: 'Organigramme', level: 3, block: 'ressources', parentId: 'dossiers-salaries', order: 3, icon: Network, view: 'orgChart' },
  { id: 'temps-absences', label: 'Temps & Absences', level: 2, block: 'ressources', parentId: 'equipe-rh', order: 3, icon: Clock },
  { id: 'presence-pointage', label: 'Présence & Pointage', level: 3, block: 'ressources', parentId: 'temps-absences', order: 1, icon: CalendarCheck, view: 'attendance' },
  { id: 'conges-absences', label: 'Congés & Absences', level: 3, block: 'ressources', parentId: 'temps-absences', order: 2, icon: CalendarDays, view: 'leaves' },
  { id: 'paie', label: 'Paie', level: 2, block: 'ressources', parentId: 'equipe-rh', order: 4, icon: Receipt, view: 'payroll' },
  { id: 'recrutement-integration', label: 'Recrutement & Intégration', level: 2, block: 'ressources', parentId: 'equipe-rh', order: 5, icon: UserPlus },
  { id: 'postes-ouverts', label: 'Postes ouverts', level: 3, block: 'ressources', parentId: 'recrutement-integration', order: 1, icon: Briefcase, view: 'openPositions' },
  { id: 'candidatures', label: 'Candidatures', level: 3, block: 'ressources', parentId: 'recrutement-integration', order: 2, icon: Users, view: 'applications' },
  { id: 'integration', label: 'Intégration', level: 3, block: 'ressources', parentId: 'recrutement-integration', order: 3, icon: GitBranch, view: 'onboarding' },
  { id: 'developpement', label: 'Développement', level: 2, block: 'ressources', parentId: 'equipe-rh', order: 6, icon: TrendingUp },
  { id: 'formation', label: 'Formation', level: 3, block: 'ressources', parentId: 'developpement', order: 1, icon: GraduationCap, view: 'training' },
  { id: 'evaluation-carriere', label: 'Évaluation & Carrière', level: 3, block: 'ressources', parentId: 'developpement', order: 2, icon: Award, view: 'evaluations' },
  { id: 'discipline', label: 'Discipline', level: 2, block: 'ressources', parentId: 'equipe-rh', order: 7, icon: Scale, view: 'discipline' },
  { id: 'communication-interne', label: 'Communication interne', level: 2, block: 'ressources', parentId: 'equipe-rh', order: 8, icon: MessageCircle, view: 'internalComms' },

  // ── Finance & Comptabilité ──
  { id: 'finance-comptabilite', label: 'Finance & Comptabilité', level: 1, block: 'ressources', parentId: null, order: 2, icon: DollarSign },
  { id: 'tableau-bord-financier', label: 'Tableau de bord financier', level: 2, block: 'ressources', parentId: 'finance-comptabilite', order: 1, icon: BarChart3, view: 'finance' },
  { id: 'tresorerie', label: 'Trésorerie', level: 2, block: 'ressources', parentId: 'finance-comptabilite', order: 2, icon: Wallet, view: 'treasury' },
  { id: 'budgets', label: 'Budgets', level: 2, block: 'ressources', parentId: 'finance-comptabilite', order: 3, icon: CreditCard, view: 'budgets' },
  { id: 'demandes-budget', label: 'Demandes de budget', level: 2, block: 'ressources', parentId: 'finance-comptabilite', order: 4, icon: ClipboardList, view: 'budgetRequests' },
  { id: 'depenses', label: 'Dépenses', level: 2, block: 'ressources', parentId: 'finance-comptabilite', order: 5, icon: Receipt, view: 'expenses' },
  { id: 'comptabilite', label: 'Comptabilité', level: 2, block: 'ressources', parentId: 'finance-comptabilite', order: 6, icon: Calculator, view: 'comptabilite' },

  // ═══════════════════════════════════════════
  // BLOC RÉFÉRENTIELS
  // ═══════════════════════════════════════════

  // ── Marques ──
  { id: 'marques', label: 'Marques', level: 1, block: 'referentiels', parentId: null, order: 1, icon: Store },
  { id: 'mes-marques', label: 'Mes marques', level: 2, block: 'referentiels', parentId: 'marques', order: 1, icon: Store, view: 'brands' },
  { id: 'base-marque', label: 'Base marque', level: 2, block: 'referentiels', parentId: 'marques', order: 2, icon: BookOpen, view: 'knowledgeBase' },
  { id: 'espace-client', label: 'Espace client', level: 2, block: 'referentiels', parentId: 'marques', order: 3, icon: ShieldUser, view: 'clientPortal' },

  // ── Brandna Academy ──
  { id: 'brandna-academy', label: 'Brandna Academy', level: 1, block: 'referentiels', parentId: null, order: 2, icon: GraduationCap },
  { id: 'catalogue-academy', label: 'Catalogue', level: 2, block: 'referentiels', parentId: 'brandna-academy', order: 1, icon: BookOpen, view: 'academy' },
  { id: 'mes-formations', label: 'Mes formations', level: 2, block: 'referentiels', parentId: 'brandna-academy', order: 2, icon: BookMarked, view: 'myTrainings' },
  { id: 'parcours', label: 'Parcours', level: 2, block: 'referentiels', parentId: 'brandna-academy', order: 3, icon: GitBranch, view: 'learningPaths' },
  { id: 'gestion-contenus', label: 'Gestion des contenus', level: 2, block: 'referentiels', parentId: 'brandna-academy', order: 4, icon: Cog, view: 'contentManagement' },

  // ═══════════════════════════════════════════
  // BLOC SYSTÈME
  // ═══════════════════════════════════════════
  { id: 'administration', label: 'Administration', level: 1, block: 'systeme', parentId: null, order: 1, icon: Settings },
  { id: 'utilisateurs', label: 'Utilisateurs', level: 2, block: 'systeme', parentId: 'administration', order: 1, icon: UserCog, view: 'usersAdmin' },
  { id: 'roles-permissions', label: 'Rôles & permissions', level: 2, block: 'systeme', parentId: 'administration', order: 2, icon: ShieldAlert, view: 'rolesPermissions' },
  { id: 'automatisations', label: 'Automatisations', level: 2, block: 'systeme', parentId: 'administration', order: 3, icon: Bot, view: 'automations' },
  { id: 'parametres', label: 'Paramètres', level: 2, block: 'systeme', parentId: 'administration', order: 4, icon: Settings, view: 'settings' },
  { id: 'journal-audit', label: "Journal d'audit", level: 2, block: 'systeme', parentId: 'administration', order: 5, icon: History, view: 'tracking' },
  { id: 'bugs-incidents', label: 'Bugs & incidents', level: 2, block: 'systeme', parentId: 'administration', order: 6, icon: Bug, view: 'bugsIncidents' },
  { id: 'integrations', label: 'Intégrations', level: 2, block: 'systeme', parentId: 'administration', order: 7, icon: Plug, view: 'settings' },
];

// ── Legacy compatibility helpers ──

export type SidebarNavKey = string;

export function defaultSidebarVisibility(): Record<string, boolean> {
  return Object.fromEntries(NAV_CATALOG.map((e) => [e.id, true]));
}

export function isSidebarNavVisible(key: string, visibility: Record<string, boolean> | null | undefined): boolean {
  if (!visibility) return true;
  return visibility[key] !== false;
}

export function mergeSidebarVisibility(stored: Record<string, boolean> | undefined): Record<string, boolean> {
  return { ...defaultSidebarVisibility(), ...(stored ?? {}) };
}

export const SIDEBAR_NAV_UPDATED_EVENT = 'nexus:sidebar-nav-updated';

export function notifySidebarNavUpdated(): void {
  window.dispatchEvent(new CustomEvent(SIDEBAR_NAV_UPDATED_EVENT));
}
