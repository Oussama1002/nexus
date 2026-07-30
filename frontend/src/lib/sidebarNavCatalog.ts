import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Barcode,
  BookOpen,
  Bot,
  Briefcase,
  Calculator,
  ClipboardList,
  Contact,
  DollarSign,
  GraduationCap,
  Headphones,
  History,
  Home,
  Megaphone,
  MessageCircle,
  Package,
  PieChart,
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
  groupIcon: LucideIcon;
  label: string;
  confirmatriceLabel?: string;
  icon: LucideIcon;
  configurable: boolean;
};

export const SIDEBAR_NAV_CATALOG: SidebarNavCatalogEntry[] = [
  // ── Tableau de bord ──
  { key: 'dashboard', view: 'dashboard', groupId: 'dashboard', groupLabel: 'Tableau de bord', groupIcon: Home, label: 'Dashboard', icon: Home, configurable: true },

  // ── Ventes ──
  { key: 'ordersNew', view: 'ordersNew', groupId: 'ventes', groupLabel: 'Ventes', groupIcon: ShoppingCart, label: 'Nouvelle commande', icon: ShoppingCart, configurable: true },
  { key: 'orders', view: 'orders', groupId: 'ventes', groupLabel: 'Ventes', groupIcon: ShoppingCart, label: 'Commandes', icon: Package, configurable: true },
  { key: 'leads', view: 'leads', groupId: 'ventes', groupLabel: 'Ventes', groupIcon: ShoppingCart, label: 'Leads', icon: Users, configurable: true },
  { key: 'customers', view: 'customers', groupId: 'ventes', groupLabel: 'Ventes', groupIcon: ShoppingCart, label: 'Clients', icon: Contact, configurable: true },
  {
    key: 'confirmatrice',
    view: 'confirmatrice',
    groupId: 'ventes',
    groupLabel: 'Ventes',
    groupIcon: ShoppingCart,
    label: 'Espace Confirmatrice',
    confirmatriceLabel: 'Votre espace',
    icon: Headphones,
    configurable: true,
  },

  // ── Communication ──
  { key: 'whatsapp', view: 'whatsapp', groupId: 'communication', groupLabel: 'Communication', groupIcon: MessageCircle, label: 'Conversations', icon: MessageCircle, configurable: true },
  { key: 'socialMedia', view: 'socialMedia', groupId: 'communication', groupLabel: 'Communication', groupIcon: MessageCircle, label: 'Réseaux & contenu', icon: Share2, configurable: true },

  // ── Marketing ──
  { key: 'ads', view: 'ads', groupId: 'marketing', groupLabel: 'Marketing', groupIcon: Megaphone, label: 'Campagnes Ads', icon: Megaphone, configurable: true },
  { key: 'mediaBuying', view: 'mediaBuying', groupId: 'marketing', groupLabel: 'Marketing', groupIcon: Megaphone, label: 'Media Buying', icon: Target, configurable: true },
  { key: 'influenceHub', view: 'influenceHub', groupId: 'marketing', groupLabel: 'Marketing', groupIcon: Megaphone, label: 'Studio Influence', icon: Sparkles, configurable: true },

  // ── Logistique ──
  { key: 'delivery-kpi', view: 'deliveryDashboard', groupId: 'logistique', groupLabel: 'Logistique', groupIcon: Truck, label: 'Livraison KPI', icon: BarChart3, configurable: true },
  { key: 'trackingParcels', view: 'trackingParcels', groupId: 'logistique', groupLabel: 'Logistique', groupIcon: Truck, label: 'Suivi colis', icon: Truck, configurable: true },

  // ── Catalogue & Stock ──
  { key: 'products', view: 'products', groupId: 'catalogue', groupLabel: 'Catalogue & Stock', groupIcon: Barcode, label: 'Produits', icon: Barcode, configurable: true },
  { key: 'stock', view: 'stock', groupId: 'catalogue', groupLabel: 'Catalogue & Stock', groupIcon: Barcode, label: 'Stocks', icon: Warehouse, configurable: true },
  { key: 'suppliers', view: 'suppliers', groupId: 'catalogue', groupLabel: 'Catalogue & Stock', groupIcon: Barcode, label: 'Fournisseurs', icon: Tag, configurable: true },
  { key: 'purchaseOrders', view: 'purchaseOrders', groupId: 'catalogue', groupLabel: 'Catalogue & Stock', groupIcon: Barcode, label: 'Achats fournisseurs', icon: ClipboardList, configurable: true },

  // ── Équipe & RH ──
  { key: 'hr', view: 'hr', groupId: 'rh', groupLabel: 'Équipe & RH', groupIcon: Briefcase, label: 'Espace RH', icon: Briefcase, configurable: true },
  { key: 'collabProjects', view: 'collabProjects', groupId: 'rh', groupLabel: 'Équipe & RH', groupIcon: Briefcase, label: 'Projets collectifs', icon: UsersRound, configurable: true },

  // ── Finance ──
  { key: 'finance', view: 'finance', groupId: 'finance', groupLabel: 'Finance', groupIcon: DollarSign, label: 'Finance', icon: DollarSign, configurable: true },
  { key: 'comptabilite', view: 'comptabilite', groupId: 'finance', groupLabel: 'Finance', groupIcon: DollarSign, label: 'Comptabilité', icon: Calculator, configurable: true },

  // ── Rapports ──
  { key: 'reporting', view: 'reporting', groupId: 'rapports', groupLabel: 'Rapports', groupIcon: PieChart, label: 'Reportings', icon: PieChart, configurable: true },

  // ── Marques & Savoir ──
  { key: 'brands', view: 'brands', groupId: 'marques', groupLabel: 'Marques & Savoir', groupIcon: Store, label: 'Mes Brands', icon: Store, configurable: true },
  { key: 'academy', view: 'academy', groupId: 'marques', groupLabel: 'Marques & Savoir', groupIcon: Store, label: 'Brandna Academy', icon: GraduationCap, configurable: true },
  { key: 'knowledgeBase', view: 'knowledgeBase', groupId: 'marques', groupLabel: 'Marques & Savoir', groupIcon: Store, label: 'Base marque', icon: BookOpen, configurable: true },
  { key: 'clientPortal', view: 'clientPortal', groupId: 'marques', groupLabel: 'Marques & Savoir', groupIcon: Store, label: 'Espace client', icon: ShieldUser, configurable: true },

  // ── Administration ──
  { key: 'automations', view: 'automations', groupId: 'admin', groupLabel: 'Administration', groupIcon: Settings, label: 'Automatisations', icon: Bot, configurable: true },
  { key: 'usersAdmin', view: 'usersAdmin', groupId: 'admin', groupLabel: 'Administration', groupIcon: Settings, label: 'Utilisateurs', icon: UserCog, configurable: true },
  { key: 'settings', view: 'settings', groupId: 'admin', groupLabel: 'Administration', groupIcon: Settings, label: 'Paramètres', icon: Settings, configurable: true },
  { key: 'tracking', view: 'tracking', groupId: 'admin', groupLabel: 'Administration', groupIcon: Settings, label: 'Historique', icon: History, configurable: true },
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
