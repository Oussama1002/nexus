/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './lib/api';
import { buildQuery } from './lib/pagination';
import type { Paginated } from './lib/pagination';
import {
  BarChart3,
  Barcode,
  Bot,
  Target,
  BookOpenCheck,
  BookOpen,
  Briefcase,
  ChevronDown,
  Home,
  Layers,
  LogOut,
  Menu,
  Megaphone,
  MessageSquare,
  Package,
  PieChart,
  Settings,
  Share2,
  Sparkles,
  Store,
  Tag,
  Truck,
  Users,
  Contact,
  ShieldUser,
  UsersRound,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User, View } from './types';
import { useAuth } from './context/AuthContext';
import { useBrand } from './context/BrandContext';
import { canAccessView } from './lib/navPermissions';
import { initGlobalActions, registerAction } from './lib/actions';
import { trackSession } from './lib/session';
import { AppShell } from './components/shell/AppShell';
import { DashboardScreen } from './screens/DashboardScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { OrdersNewScreen } from './screens/OrdersNewScreen';
import { WhatsAppWorkspaceScreen } from './screens/WhatsAppWorkspaceScreen';
import { ConfirmatriceSpaceScreen } from './screens/ConfirmatriceSpaceScreen';
import { ReportingScreen } from './screens/ReportingScreen';
import { TrackingScreen } from './screens/TrackingScreen';
import { BrandsScreen } from './screens/BrandsScreen';
import { LeadsScreen } from './screens/LeadsScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { PurchaseOrdersScreen } from './screens/PurchaseOrdersScreen';
import { DeliveryScreen } from './screens/DeliveryScreen';
import { DeliveryDashboardScreen } from './screens/DeliveryDashboardScreen';
import { AdsScreen } from './screens/AdsScreen';
import { ShipmentsScreen } from './screens/ShipmentsScreen';
import { ProductsStockScreen } from './screens/ProductsStockScreen';
import { FinanceScreen } from './screens/FinanceScreen';
import { EmployeesManagementScreen } from './screens/EmployeesManagementScreen';
import { UsersAdminScreen } from './screens/UsersAdminScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SystemSettingsScreen } from './screens/SystemSettingsScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { SocialMediaWorkspaceScreen } from './screens/SocialMediaWorkspaceScreen';
import { InfluenceWorkspaceScreen } from './screens/InfluenceWorkspaceScreen';
import { BrandKnowledgeBaseScreen } from './screens/BrandKnowledgeBaseScreen';
import { AcademyScreen } from './screens/AcademyScreen';
import { AutomationsScreen } from './screens/AutomationsScreen';
import { MediaBuyingScreen } from './screens/MediaBuyingScreen';
import { ClientPortalScreen } from './screens/ClientPortalScreen';
import { CollabProjectsScreen } from './screens/CollabProjectsScreen';
import { parseAppPath, pathForView } from './lib/appPaths';

const ORDER_DRAFT_KEY = 'nexus.orderDraft';

type ApiUserRow = {
  id: number;
  name: string;
  email: string;
  roles: { id: number; slug: string }[];
};

function mapApiUserToLegacy(u: ApiUserRow): User {
  const slugs = u.roles.map((r) => r.slug);
  const legacyRole: User['role'] = slugs.includes('confirmatrice')
    ? 'confirmatrice'
    : slugs.includes('admin')
      ? 'admin'
      : slugs.includes('manager_operationnel')
        ? 'manager'
        : ((slugs[0] as User['role']) ?? 'manager');
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: legacyRole,
  };
}

export function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, roleSlugs, logout: authLogout, isAdmin, permissionSlugs } = useAuth();
  const { brands, activeBrandId, setActiveBrandId, activeBrand } = useBrand();

  const currentUser: User = useMemo(() => {
    if (!authUser) {
      return { id: '', name: '', email: '', role: 'admin' };
    }
    const slug = roleSlugs[0] ?? 'admin';
    const legacyRole: User['role'] =
      slug === 'confirmatrice' ? 'confirmatrice' : slug === 'admin' ? 'admin' : 'manager';
    return {
      id: String(authUser.id),
      name: authUser.name,
      email: authUser.email,
      role: legacyRole,
    };
  }, [authUser, roleSlugs]);

  /** Admin: which confirmatrice workspace is shown in "Espace Confirmatrice". */
  const [selectedConfirmatriceUserId, setSelectedConfirmatriceUserId] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);

  const parsedPath = useMemo(() => parseAppPath(location.pathname), [location.pathname]);
  const activeView: View = parsedPath.view;
  const settingsMode =
    parsedPath.view === 'settings' ? parsedPath.settingsMode : 'center';

  useEffect(() => {
    const p = location.pathname.replace(/\/+$/, '') || '/';
    if (p === '/' || p === '') {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api.get<Paginated<ApiUserRow>>(`users${buildQuery({ per_page: 100 })}`);
      if (!cancelled) setDirectoryLoaded(true);
      if (!res.ok || !res.data || cancelled) return;
      setDirectoryUsers(res.data.data.map(mapApiUserToLegacy));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const users = useMemo<User[]>(() => {
    const byId = new Map<string, User>();
    for (const u of directoryUsers) byId.set(u.id, u);
    if (currentUser.id) byId.set(currentUser.id, currentUser);
    return Array.from(byId.values());
  }, [directoryUsers, currentUser]);

  useEffect(() => {
    const confirmIds = users.filter((u) => u.role === 'confirmatrice').map((u) => u.id);
    if (confirmIds.length === 0) {
      setSelectedConfirmatriceUserId('');
      return;
    }
    setSelectedConfirmatriceUserId((prev) => (prev && confirmIds.includes(prev) ? prev : confirmIds[0]));
  }, [users]);

  const permCtx = useMemo(
    () => ({ isAdmin, permissionSlugs, roleSlugs }),
    [isAdmin, permissionSlugs, roleSlugs],
  );

  const canAccess = useCallback((v: View) => canAccessView(v, permCtx), [permCtx]);

  const actionCtx = useMemo(() => ({ userId: currentUser.id, view: activeView }), [activeView, currentUser.id]);

  useEffect(() => {
    registerAction('auth.login', () => trackSession({ name: 'auth.login', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } }));
    registerAction('auth.logout', () => trackSession({ name: 'auth.logout', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } }));
  }, [currentUser.id, currentUser.role]);

  useEffect(() => initGlobalActions(() => actionCtx), [actionCtx]);

  useEffect(() => {
    trackSession({ name: 'session.start', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } });
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    trackSession({ name: 'nav.view', ts: Date.now(), meta: { view: activeView, userId: currentUser.id, role: currentUser.role } });
  }, [activeView, currentUser.id, currentUser.role]);

  /** Must run before any conditional return — same hook order logged in or out. */
  const commerceNavItems = useMemo(() => {
    const raw: { id: View; label: string; icon: typeof Home }[] = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'ordersNew', label: 'Nouvelle commande', icon: Package },
      { id: 'orders', label: 'Commandes', icon: Package },
      { id: 'whatsapp', label: 'Conversations', icon: MessageSquare },
      { id: 'academy', label: 'Brandna academy', icon: BookOpenCheck },
      { id: 'clientPortal', label: 'Espace client', icon: ShieldUser },
      { id: 'collabProjects', label: 'Projets collectifs', icon: UsersRound },
      { id: 'mediaBuying', label: 'Media Buying', icon: Target },
      { id: 'automations', label: 'Automatisations', icon: Bot },
      {
        id: 'confirmatrice',
        label: currentUser.role === 'confirmatrice' ? 'Votre espace' : 'Espace Confirmatrice',
        icon: MessageSquare,
      },
      { id: 'leads', label: 'Gestion Leads', icon: Users },
      { id: 'customers', label: 'Clients', icon: Contact },
      { id: 'knowledgeBase', label: 'Base marque', icon: BookOpen },
      { id: 'brands', label: 'Mes Brands', icon: Store },
    ];
    let filtered = raw.filter((it) => canAccess(it.id));
    if (currentUser.role === 'confirmatrice') {
      const yours = filtered.find((i) => i.id === 'confirmatrice');
      const rest = filtered.filter((i) => i.id !== 'confirmatrice');
      filtered = yours ? [yours, ...rest] : filtered;
    }
    return filtered.map((it) => ({
      ...it,
      active: activeView === it.id,
      onClick: () => navigate(pathForView(it.id)),
    }));
  }, [currentUser.role, activeView, canAccess, navigate]);

  const socialNavItems = useMemo(
    () =>
      [
        { id: 'socialMedia' as const, label: 'Réseaux & contenu', icon: Share2 },
      ]
        .filter((it) => canAccess(it.id))
        .map((it) => ({
          ...it,
          active: activeView === it.id,
          onClick: () => navigate(pathForView(it.id)),
        })),
    [activeView, canAccess, navigate],
  );

  const navGroups = [
    {
      id: 'commerce',
      label: 'Commerce',
      items: commerceNavItems,
    },
    {
      id: 'social',
      label: 'Social & contenu',
      items: socialNavItems,
    },
    {
      id: 'operations',
      label: 'Opérations',
      items: [
        { id: 'ads', label: 'Campagnes Ads', icon: Megaphone, active: activeView === 'ads', onClick: () => navigate(pathForView('ads')) },
        { id: 'products', label: 'Produits', icon: Barcode, active: activeView === 'products', onClick: () => navigate(pathForView('products')) },
        { id: 'stock', label: 'Stocks', icon: Package, active: activeView === 'stock', onClick: () => navigate(pathForView('stock')) },
        {
          id: 'delivery-kpi',
          label: 'Livraison KPI',
          icon: BarChart3,
          active: activeView === 'delivery' || activeView === 'deliveryDashboard',
          onClick: () => {
            if (canAccess('deliveryDashboard')) navigate(pathForView('deliveryDashboard'));
            else navigate(pathForView('delivery'));
          },
        },
        { id: 'trackingParcels', label: 'Suivi colis', icon: Truck, active: activeView === 'trackingParcels', onClick: () => navigate(pathForView('trackingParcels')) },
        { id: 'suppliers', label: 'Fournisseurs', icon: Tag, active: activeView === 'suppliers', onClick: () => navigate(pathForView('suppliers')) },
        {
          id: 'purchaseOrders',
          label: 'Commandes fournisseurs',
          icon: Package,
          active: activeView === 'purchaseOrders',
          onClick: () => navigate(pathForView('purchaseOrders')),
        },
      ],
    },
    {
      id: 'influence',
      label: 'Influence',
      items: [
        {
          id: 'influenceHub',
          label: 'Studio Influence',
          icon: Sparkles,
          active: activeView === 'influenceHub',
          onClick: () => navigate(pathForView('influenceHub')),
        },
      ],
    },
    {
      id: 'management',
      label: 'Management',
      items: [
        { id: 'reporting', label: 'Reportings', icon: PieChart, active: activeView === 'reporting', onClick: () => navigate(pathForView('reporting')) },
        { id: 'hr', label: 'Espace RH', icon: Briefcase, active: activeView === 'hr', onClick: () => navigate(pathForView('hr')) },
        { id: 'finance', label: 'Finance', icon: PieChart, active: activeView === 'finance', onClick: () => navigate(pathForView('finance')) },
        { id: 'usersAdmin', label: 'Utilisateurs', icon: Users, active: activeView === 'usersAdmin', onClick: () => navigate(pathForView('usersAdmin')) },
        {
          id: 'settings',
          label: 'Paramètres',
          icon: Settings,
          active: activeView === 'settings',
          onClick: () => navigate(pathForView('settings', 'center')),
        },
        { id: 'tracking', label: 'Historique', icon: BarChart3, active: activeView === 'tracking', onClick: () => navigate(pathForView('tracking')) },
      ],
    },
  ]
    .map((g) => ({
      ...g,
      items: g.items.filter((it) =>
        it.id === 'delivery-kpi' ? canAccess('delivery') || canAccess('deliveryDashboard') : canAccess(it.id as View),
      ),
    }))
    .filter((g) => g.items.length > 0);
  const brandIdByName = (name: string) => brands.find((b) => b.name === name)?.id;

  const persistOrderDraftAndGoNew = (draft: Record<string, unknown>) => {
    try {
      sessionStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
    navigate(pathForView('ordersNew'));
  };

  const renderContent = () => {
    if (!canAccess(activeView)) {
      const fallback = currentUser.role === 'confirmatrice' ? 'confirmatrice' : 'dashboard';
      return (
        <PlaceholderScreen
          title="Accès limité"
          subtitle="Cette session n’a pas les permissions pour ce module."
          cta={
            <button
              onClick={() => navigate(pathForView(fallback))}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700"
            >
              Retour
            </button>
          }
        />
      );
    }
    switch (activeView) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'orders':
        return <OrdersListScreen onNewOrder={() => navigate(pathForView('ordersNew'))} />;
      case 'ordersNew':
        return <OrdersNewScreen activeBrandName={activeBrand.name} onBackToList={() => navigate(pathForView('orders'))} />;
      case 'whatsapp':
        return (
          <WhatsAppWorkspaceScreen
            onCreateOrderFromLead={(draft) => {
              const leadBrandId = brandIdByName(String(draft.brand ?? ''));
              if (leadBrandId) setActiveBrandId(leadBrandId);
              const { brand: _b, ...rest } = draft;
              persistOrderDraftAndGoNew(rest as Record<string, unknown>);
            }}
          />
        );
      case 'confirmatrice': {
        const confirmOpts = users.filter((u) => u.role === 'confirmatrice').map((u) => ({ id: u.id, name: u.name }));
        const workspaceUid =
          currentUser.role === 'confirmatrice' ? currentUser.id : selectedConfirmatriceUserId;
        const workspaceName =
          users.find((u) => u.id === workspaceUid)?.name ??
          (currentUser.role === 'confirmatrice' ? currentUser.name : '—');
        return (
          <ConfirmatriceSpaceScreen
            viewerRole={currentUser.role}
            workspaceUserId={workspaceUid}
            selectedConfirmatriceName={workspaceName}
            confirmatriceOptions={confirmOpts}
            noConfirmatriceInDirectory={confirmOpts.length === 0}
            onSelectConfirmatrice={(id) => {
              setSelectedConfirmatriceUserId(id);
              trackSession({
                name: 'audit.confirmatrice.admin_select_user',
                ts: Date.now(),
                meta: { selectedConfirmatriceId: id },
              });
            }}
            onOpenWhatsApp={() => navigate(pathForView('whatsapp'))}
            onOpenOrders={() => navigate(pathForView('orders'))}
            onOpenLeads={() => navigate(pathForView('leads'))}
            onCreateOrder={() => navigate(pathForView('ordersNew'))}
            onNavigateToUsersAdmin={() => navigate(pathForView('usersAdmin'))}
            onCloseNoConfirmatriceModal={() => navigate(pathForView('dashboard'))}
            usersDirectoryLoaded={directoryLoaded}
          />
        );
      }
      case 'reporting':
        return <ReportingScreen />;
      case 'hr':
        return <EmployeesManagementScreen />;
      case 'usersAdmin':
        return <UsersAdminScreen />;
      case 'tracking':
        return <TrackingScreen />;
      case 'brands':
        return <BrandsScreen />;
      case 'customers':
        return <CustomersScreen />;
      case 'knowledgeBase':
        return <BrandKnowledgeBaseScreen />;
      case 'academy':
        return <AcademyScreen />;
      case 'automations':
        return <AutomationsScreen />;
      case 'mediaBuying':
        return <MediaBuyingScreen />;
      case 'clientPortal':
        return <ClientPortalScreen />;
      case 'collabProjects':
        return <CollabProjectsScreen />;
      case 'leads':
        return (
          <LeadsScreen
            onOpenConversation={() => navigate(pathForView('whatsapp'))}
            onCreateOrderFromLead={(draft) => {
              const leadBrandId = brandIdByName(String(draft.brand ?? ''));
              if (leadBrandId) setActiveBrandId(leadBrandId);
              const { brand: _b, ...rest } = draft;
              persistOrderDraftAndGoNew(rest as Record<string, unknown>);
            }}
          />
        );
      case 'suppliers':
        return <SuppliersScreen />;
      case 'purchaseOrders':
        return <PurchaseOrdersScreen />;
      case 'delivery':
        return <DeliveryScreen />;
      case 'deliveryDashboard':
        return <DeliveryDashboardScreen />;
      case 'ads':
        return <AdsScreen />;
      case 'trackingParcels':
        return <ShipmentsScreen />;
      case 'products':
        return <ProductsStockScreen variant="products" />;
      case 'stock':
        return <ProductsStockScreen variant="stock" />;
      case 'finance':
        return <FinanceScreen />;
      case 'socialMedia':
        return <SocialMediaWorkspaceScreen />;
      case 'influenceHub':
        return <InfluenceWorkspaceScreen />;
      case 'settings':
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-px">
              <button
                type="button"
                onClick={() => navigate(pathForView('settings', 'center'))}
                className={`px-4 py-2.5 rounded-t-xl text-sm font-black transition-colors ${
                  settingsMode === 'center'
                    ? 'bg-white text-primary-800 shadow-sm border border-b-0 border-zinc-200 relative top-px'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                Centre de paramètres
              </button>
              <button
                type="button"
                onClick={() => navigate(pathForView('settings', 'advanced'))}
                className={`px-4 py-2.5 rounded-t-xl text-sm font-black transition-colors ${
                  settingsMode === 'advanced'
                    ? 'bg-white text-primary-800 shadow-sm border border-b-0 border-zinc-200 relative top-px'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                Paramètres techniques (clés DB)
              </button>
            </div>
            {settingsMode === 'center' ? (
              <SettingsScreen />
            ) : (
              <SystemSettingsScreen onNavigateToUsersAdmin={() => navigate(pathForView('usersAdmin'))} />
            )}
          </div>
        );
      default:
        return <PlaceholderScreen title={activeView} subtitle="Écran prêt à implémenter (design system actif)." />;
    }
  };

  return (
    <AppShell
        sidebarOpen={sidebarOpen}
        navGroups={navGroups}
        sidebarHeader={
          <div className="flex items-center gap-3">
            <div className="min-w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-100 shrink-0">
              <Layers className="text-white w-6 h-6" />
            </div>
            {sidebarOpen && <span className="text-xl font-bold tracking-tight text-zinc-900 truncate">Nexus Omni</span>}
          </div>
        }
        sidebarFooter={
          <button
            data-action="auth.logout"
            onClick={async () => {
              await authLogout();
              navigate('/login', { replace: true });
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-50 text-rose-600 font-bold text-xs uppercase tracking-wide transition-colors group"
          >
            <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
            {sidebarOpen && <span>Déconnexion</span>}
          </button>
        }
        topbarLeft={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="h-6 w-[1px] bg-zinc-200" />
            <div className="text-sm font-black text-zinc-900 capitalize">{activeView}</div>
          </div>
        }
        topbarBrandPill={
          brands.length > 1 ? (
            <div className="relative flex items-center gap-2 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white font-bold shrink-0"
                style={{ backgroundColor: activeBrand.color }}
              >
                {activeBrand.logo}
              </div>
              <select
                aria-label="Marque active"
                className="text-sm font-bold text-zinc-700 bg-transparent border-0 outline-none cursor-pointer max-w-[200px] truncate pr-6"
                value={activeBrandId}
                onChange={(e) => setActiveBrandId(e.target.value)}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-zinc-400 pointer-events-none absolute right-3" />
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white font-bold"
                style={{ backgroundColor: activeBrand.color }}
              >
                {activeBrand.logo}
              </div>
              <span className="text-sm font-bold text-zinc-700 hidden md:block">{activeBrand.name}</span>
            </div>
          )
        }
        topbarRight={
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-zinc-900 leading-none">{currentUser.name}</p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">
                {roleSlugs[0] ?? currentUser.role}
              </p>
            </div>
            <div
              className="w-9 h-9 rounded-xl bg-primary-100 text-primary-800 font-black text-xs flex items-center justify-center ring-2 ring-white shadow-sm"
              aria-hidden
            >
              {(currentUser.name || '?').slice(0, 2).toUpperCase()}
            </div>
          </div>
        }
      >
        {renderContent()}
      </AppShell>
  );
}

