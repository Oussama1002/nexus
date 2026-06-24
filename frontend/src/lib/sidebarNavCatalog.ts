import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Barcode,
  BookOpen,
  BookOpenCheck,
  Bot,
  Briefcase,
  ClipboardList,
  Contact,
  DollarSign,
  GraduationCap,
  Headphones,
  History,
  Home,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Package,
  PieChart,
  ScrollText,
  Settings,
  Share2,
  ShieldUser,
  ShoppingCart,
  Sparkles,
  Store,
  Tag,
  Target,
  Truck,
  UserCog,
  Users,
  UsersRound,
  Warehouse,
} from 'lucide-react';
import type { View } from '../types';

export type SidebarNavKey = View | 'delivery-kpi';

export type SidebarNavCatalogEntry = {
  key: SidebarNavKey;
  view: View;
  groupId: string;
  groupLabel: string;
  label: string;
  /** Label when the logged-in user is a confirmatrice (confirmatrice item only). */
  confirmatriceLabel?: string;
  icon: LucideIcon;
  /** Shown in settings; default true when not stored. */
  configurable: boolean;
};

/** All sidebar entries (order preserved within each group). */
export const SIDEBAR_NAV_CATALOG: SidebarNavCatalogEntry[] = [
  { key: 'dashboard', view: 'dashboard', groupId: 'commerce', groupLabel: 'Commerce', label: 'Dashboard', icon: Home, configurable: true },
  { key: 'ordersNew', view: 'ordersNew', groupId: 'commerce', groupLabel: 'Commerce', label: 'Nouvelle commande', icon: ShoppingCart, configurable: true },
  { key: 'orders', view: 'orders', groupId: 'commerce', groupLabel: 'Commerce', label: 'Commandes', icon: Package, configurable: true },
  { key: 'whatsapp', view: 'whatsapp', groupId: 'commerce', groupLabel: 'Commerce', label: 'Conversations', icon: MessageCircle, configurable: true },
  { key: 'academy', view: 'academy', groupId: 'commerce', groupLabel: 'Commerce', label: 'Brandna academy', icon: GraduationCap, configurable: true },
  { key: 'clientPortal', view: 'clientPortal', groupId: 'commerce', groupLabel: 'Commerce', label: 'Espace client', icon: ShieldUser, configurable: true },
  { key: 'collabProjects', view: 'collabProjects', groupId: 'commerce', groupLabel: 'Commerce', label: 'Projets collectifs', icon: UsersRound, configurable: true },
  { key: 'mediaBuying', view: 'mediaBuying', groupId: 'commerce', groupLabel: 'Commerce', label: 'Media Buying', icon: Target, configurable: true },
  { key: 'automations', view: 'automations', groupId: 'commerce', groupLabel: 'Commerce', label: 'Automatisations', icon: Bot, configurable: true },
  {
    key: 'confirmatrice',
    view: 'confirmatrice',
    groupId: 'commerce',
    groupLabel: 'Commerce',
    label: 'Espace Confirmatrice',
    confirmatriceLabel: 'Votre espace',
    icon: Headphones,
    configurable: true,
  },
  { key: 'leads', view: 'leads', groupId: 'commerce', groupLabel: 'Commerce', label: 'Gestion Leads', icon: Users, configurable: true },
  { key: 'customers', view: 'customers', groupId: 'commerce', groupLabel: 'Commerce', label: 'Clients', icon: Contact, configurable: true },
  { key: 'knowledgeBase', view: 'knowledgeBase', groupId: 'commerce', groupLabel: 'Commerce', label: 'Base marque', icon: BookOpen, configurable: true },
  { key: 'brands', view: 'brands', groupId: 'commerce', groupLabel: 'Commerce', label: 'Mes Brands', icon: Store, configurable: true },
  { key: 'socialMedia', view: 'socialMedia', groupId: 'social', groupLabel: 'Social & contenu', label: 'Réseaux & contenu', icon: Share2, configurable: true },
  { key: 'ads', view: 'ads', groupId: 'operations', groupLabel: 'Opérations', label: 'Campagnes Ads', icon: Megaphone, configurable: true },
  { key: 'products', view: 'products', groupId: 'operations', groupLabel: 'Opérations', label: 'Produits', icon: Barcode, configurable: true },
  { key: 'stock', view: 'stock', groupId: 'operations', groupLabel: 'Opérations', label: 'Stocks', icon: Warehouse, configurable: true },
  { key: 'delivery-kpi', view: 'deliveryDashboard', groupId: 'operations', groupLabel: 'Opérations', label: 'Livraison KPI', icon: BarChart3, configurable: true },
  { key: 'trackingParcels', view: 'trackingParcels', groupId: 'operations', groupLabel: 'Opérations', label: 'Suivi colis', icon: Truck, configurable: true },
  { key: 'suppliers', view: 'suppliers', groupId: 'operations', groupLabel: 'Opérations', label: 'Fournisseurs', icon: Tag, configurable: true },
  { key: 'purchaseOrders', view: 'purchaseOrders', groupId: 'operations', groupLabel: 'Opérations', label: 'Commandes fournisseurs', icon: ClipboardList, configurable: true },
  { key: 'influenceHub', view: 'influenceHub', groupId: 'influence', groupLabel: 'Influence', label: 'Studio Influence', icon: Sparkles, configurable: true },
  { key: 'reporting', view: 'reporting', groupId: 'management', groupLabel: 'Management', label: 'Reportings', icon: PieChart, configurable: true },
  { key: 'hr', view: 'hr', groupId: 'management', groupLabel: 'Management', label: 'Espace RH', icon: Briefcase, configurable: true },
  { key: 'finance', view: 'finance', groupId: 'management', groupLabel: 'Management', label: 'Finance', icon: DollarSign, configurable: true },
  { key: 'usersAdmin', view: 'usersAdmin', groupId: 'management', groupLabel: 'Management', label: 'Utilisateurs', icon: UserCog, configurable: true },
  { key: 'settings', view: 'settings', groupId: 'management', groupLabel: 'Management', label: 'Paramètres', icon: Settings, configurable: true },
  { key: 'tracking', view: 'tracking', groupId: 'management', groupLabel: 'Management', label: 'Historique', icon: History, configurable: true },
];

export function defaultSidebarVisibility(): Record<string, boolean> {
  return Object.fromEntries(SIDEBAR_NAV_CATALOG.map((e) => [e.key, true]));
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
