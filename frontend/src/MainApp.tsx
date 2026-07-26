/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './lib/api';
import { buildQuery } from './lib/pagination';
import type { Paginated } from './lib/pagination';
import { ChevronDown, Layers, LogOut, Menu } from 'lucide-react';
import { resolvePublicAssetUrl } from './lib/publicAssetUrl';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User, View } from './types';
import { useAuth } from './context/AuthContext';
import { useBrand } from './context/BrandContext';
import { buildSidebarNavGroups } from './lib/buildSidebarNavGroups';
import { canAccessView } from './lib/navPermissions';
import { useSidebarNavVisibility } from './hooks/useSidebarNavVisibility';
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
import { AccountingScreen } from './screens/AccountingScreen';
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
import { ProfileScreen } from './screens/ProfileScreen';
import { SearchModal } from './components/shell/SearchModal';
import { NotificationPanel, type NotificationItem } from './components/shell/NotificationPanel';
import { InternalChatModal } from './components/chat/InternalChatModal';
import { Modal } from './components/ui/Modal';
import { parseAppPath, pathForView } from './lib/appPaths';

const ORDER_DRAFT_KEY = 'nexus.orderDraft';

const VIEW_LABELS_FR: Record<string, string> = {
  dashboard: 'Tableau de bord',
  ordersNew: 'Nouvelle commande',
  orders: 'Commandes',
  whatsapp: 'WhatsApp',
  customers: 'Clients',
  trackingParcels: 'Suivi colis',
  products: 'Produits',
  finance: 'Finance',
  comptabilite: 'Comptabilite',
  brands: 'Marques',
  confirmatrice: 'Espace Confirmatrice',
  leads: 'Leads',
  ads: 'Publicités',
  knowledgeBase: 'Base de connaissances',
  academy: 'Académie',
  mediaBuying: 'Achat média',
  collabProjects: 'Projets collaboratifs',
  automations: 'Automatisations',
  clientPortal: 'Portail client',
  hr: 'Ressources humaines',
  delivery: 'Livraison',
  deliveryDashboard: 'Tableau livraison',
  stock: 'Stock',
  suppliers: 'Fournisseurs',
  purchaseOrders: 'Bons d\'achat',
  reporting: 'Reporting',
  settings: 'Paramètres',
  tracking: 'Suivi',
  usersAdmin: 'Utilisateurs',
  socialMedia: 'Réseaux sociaux',
  influenceHub: 'Hub influence',
  profile: 'Profil',
};

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifData, setNotifData] = useState<{ items: NotificationItem[]; summary: { total: number; danger: number; warning: number } } | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [brandLogoUrl, setBrandLogoUrl] = useState('');
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);

  const [directoryUsers, setDirectoryUsers] = useState<User[]>([]);
  const [directoryLoaded, setDirectoryLoaded] = useState(false);

  const parsedPath = useMemo(() => parseAppPath(location.pathname), [location.pathname]);
  const activeView: View = parsedPath.view;
  const settingsMode =
    parsedPath.view === 'settings' ? parsedPath.settingsMode : 'center';

  useEffect(() => {
    const p = location.pathname.replace(/\/+$/, '') || '/';
    if (p === '/' || p === '') {
      const dest = currentUser.role === 'confirmatrice' ? '/whatsapp' : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [location.pathname, navigate, currentUser.role]);

  useEffect(() => {
    if (!activeBrandId) return;
    (async () => {
      const res = await api.get<{ company?: { logoUrl?: string } }>('settings/center/general');
      if (res.ok && res.data) {
        const d = res.data as any;
        const url = d?.company?.logoUrl ?? d?.data?.company?.logoUrl ?? '';
        setBrandLogoUrl(url);
      }
    })();
  }, [activeBrandId]);

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
  const sidebarVisibility = useSidebarNavVisibility(activeBrandId);

  const actionCtx = useMemo(() => ({ userId: currentUser.id, view: activeView }), [activeView, currentUser.id]);

  useEffect(() => {
    registerAction('auth.login', () => trackSession({ name: 'auth.login', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } }));
    registerAction('auth.logout', () => trackSession({ name: 'auth.logout', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } }));
  }, [currentUser.id, currentUser.role]);

  useEffect(() => initGlobalActions(() => actionCtx), [actionCtx]);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    const res = await api.get<{ items: NotificationItem[]; summary: { total: number; danger: number; warning: number } }>('notifications');
    setNotifLoading(false);
    if (res.ok && res.data) {
      const d = res.data as any;
      setNotifData({ items: d.items ?? [], summary: d.summary ?? { total: 0, danger: 0, warning: 0 } });
    }
  }, []);

  useEffect(() => {
    const poll = async () => {
      const res = await api.get<{ unread: number }>('internal-chat/unread');
      if (res.ok && res.data) {
        const d = res.data as any;
        setUnreadChatCount(d?.unread ?? d?.data?.unread ?? 0);
      }
    };
    void poll();
    void fetchNotifications();
    const timer = setInterval(poll, 10000);
    const notifTimer = setInterval(fetchNotifications, 60000);
    return () => { clearInterval(timer); clearInterval(notifTimer); };
  }, [fetchNotifications]);

  // Ctrl+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = () => setBrandPickerOpen(true);
    window.addEventListener('nexus:brand-required', handler);
    return () => window.removeEventListener('nexus:brand-required', handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent).detail;
      if (typeof url === 'string') setBrandLogoUrl(url + '?t=' + Date.now());
    };
    window.addEventListener('nexus:logo-updated', handler);
    return () => window.removeEventListener('nexus:logo-updated', handler);
  }, []);

  useEffect(() => {
    trackSession({ name: 'session.start', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } });
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    trackSession({ name: 'nav.view', ts: Date.now(), meta: { view: activeView, userId: currentUser.id, role: currentUser.role } });
  }, [activeView, currentUser.id, currentUser.role]);

  const navGroups = useMemo(
    () =>
      buildSidebarNavGroups({
        activeView,
        navigate,
        canAccess,
        userRole: currentUser.role,
        visibility: sidebarVisibility,
      }),
    [activeView, navigate, canAccess, currentUser.role, sidebarVisibility],
  );
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
      const fallback = currentUser.role === 'confirmatrice' ? 'whatsapp' : 'dashboard';
      navigate(pathForView(fallback), { replace: true });
      return null;
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
            onOpenWhatsApp={() => navigate(`${pathForView('whatsapp')}?assigned_user_id=${workspaceUid}`)}
            onOpenOrders={() => navigate(`${pathForView('orders')}?assigned_user_id=${workspaceUid}`)}
            onOpenLeads={() => navigate(`${pathForView('leads')}?assigned_user_id=${workspaceUid}`)}
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
      case 'comptabilite':
        return <AccountingScreen />;
      case 'socialMedia':
        return <SocialMediaWorkspaceScreen />;
      case 'influenceHub':
        return <InfluenceWorkspaceScreen />;
      case 'profile':
        return <ProfileScreen />;
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
    <>
    <AppShell
        sidebarOpen={sidebarOpen}
        navGroups={navGroups}
        sidebarHeader={
          <div className="flex items-center gap-3">
            {brandLogoUrl ? (
              <img src={resolvePublicAssetUrl(brandLogoUrl)} alt="" className="min-w-10 h-10 rounded-xl object-contain shrink-0" />
            ) : (
              <div className="min-w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-100 shrink-0">
                <Layers className="text-white w-6 h-6" />
              </div>
            )}
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
            <div className="text-sm font-black text-zinc-900">{VIEW_LABELS_FR[activeView] ?? activeView}</div>
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
                {isAdmin && brands.length > 1 && (
                  <option value="all">Toutes les marques</option>
                )}
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
        onSearchClick={() => setSearchOpen(true)}
        onChatClick={() => setChatOpen(true)}
        unreadChatCount={unreadChatCount}
        onNotificationClick={() => { setNotifOpen(true); void fetchNotifications(); }}
        notificationCount={notifData?.summary?.total ?? 0}
        topbarRight={
          <button
            type="button"
            onClick={() => navigate(pathForView('profile'))}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-zinc-900 leading-none">{currentUser.name}</p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">
                {roleSlugs[0] ?? currentUser.role}
              </p>
            </div>
            {authUser?.avatar_url ? (
              <img src={resolvePublicAssetUrl(authUser.avatar_url)} alt="" className="w-9 h-9 rounded-xl object-cover ring-2 ring-white shadow-sm" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-800 font-black text-xs flex items-center justify-center ring-2 ring-white shadow-sm">
                {(currentUser.name || '?').slice(0, 2).toUpperCase()}
              </div>
            )}
          </button>
        }
      >
        <div key={activeBrandId}>{renderContent()}</div>
      </AppShell>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} navigate={navigate} canAccess={canAccess} />
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} data={notifData} loading={notifLoading} />
      <InternalChatModal
        open={chatOpen}
        onClose={() => { setChatOpen(false); void api.get<{ unread: number }>('internal-chat/unread').then((r) => { if (r.ok) setUnreadChatCount((r.data as any)?.unread ?? 0); }); }}
        allUsers={directoryUsers.map((u) => ({ id: Number(u.id), name: u.name, email: u.email }))}
      />
      <Modal
        open={brandPickerOpen}
        title="Marque requise"
        subtitle="Cette action nécessite une marque spécifique."
        onClose={() => setBrandPickerOpen(false)}
      >
        <div className="space-y-2">
          {brands.filter((b) => b.id !== "all").map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => { setActiveBrandId(b.id); setBrandPickerOpen(false); }}
              className="w-full text-left rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50 transition"
            >
              {b.name}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}

