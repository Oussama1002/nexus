/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
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
  Store,
  Tag,
  Truck,
  Users,
} from 'lucide-react';
import { cn } from './lib/utils';
import type { Brand, User, View } from './types';
import { initGlobalActions, registerAction } from './lib/actions';
import { trackSession } from './lib/session';
import { AppShell } from './components/shell/AppShell';
import { DashboardScreen } from './screens/DashboardScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { OrdersNewScreen } from './screens/OrdersNewScreen';
import { WhatsAppWorkspaceScreen } from './screens/WhatsAppWorkspaceScreen';
import { ConfirmatriceSpaceScreen } from './screens/ConfirmatriceSpaceScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ReportingScreen } from './screens/ReportingScreen';
import { HrScreen } from './screens/HrScreen';
import { TrackingScreen } from './screens/TrackingScreen';
import { BrandsScreen } from './screens/BrandsScreen';
import { LeadsScreen } from './screens/LeadsScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { DeliveryScreen } from './screens/DeliveryScreen';
import { AdsScreen } from './screens/AdsScreen';
import type { Order, OrderDraft } from './domain/orders';
import type { Shipment, ShipmentDraft } from './domain/shipments';
import { ShipmentsScreen } from './screens/ShipmentsScreen';
import type { Product, ProductDraft } from './domain/products';
import { ProductsStockScreen } from './screens/ProductsStockScreen';
import type { Charge, ChargeDraft } from './domain/finance';
import { FinanceScreen } from './screens/FinanceScreen';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string; stack?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    return { hasError: true, message: e.message, stack: e.stack };
  }
  componentDidCatch(err: unknown) {
    // Keep this visible in DevTools too.
    console.error('App crashed:', err);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="max-w-3xl mx-auto card p-6 space-y-4">
          <p className="text-lg font-black text-zinc-900">Erreur UI (runtime)</p>
          <p className="text-sm font-medium text-zinc-600">
            L’application a crash. Copie le message ci-dessous et envoie-le moi pour corriger.
          </p>
          <div className="card-muted p-4">
            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Message</p>
            <pre className="mt-2 text-xs font-mono whitespace-pre-wrap text-rose-700">{this.state.message ?? 'Unknown error'}</pre>
          </div>
          {this.state.stack && (
            <div className="card-muted p-4">
              <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Stack</p>
              <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap text-zinc-700">{this.state.stack}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }
}

const MOCK_USER_ADMIN: User = {
  id: '1',
  name: 'Amine El Alaoui',
  role: 'admin',
  email: 'amine@nexus.ma',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
};

const MOCK_USER_CONFIRMATRICE: User = {
  id: '2',
  name: 'Sara El Malki',
  role: 'confirmatrice',
  email: 'sara@nexus.ma',
  avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop',
};

const MOCK_USER_MANAGER: User = {
  id: '4',
  name: 'Youssef Manager',
  role: 'manager',
  email: 'youssef@nexus.ma',
  avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop',
};

const MOCK_BRANDS: Brand[] = [
  { id: 'b1', name: 'Luxe Cosmetics', logo: 'LC', color: '#4f46e5', whatsappNumber: '+212 661-234567' },
  { id: 'b2', name: 'Zest Home', logo: 'ZH', color: '#10b981', whatsappNumber: '+212 661-765432' },
  { id: 'b3', name: 'Moda Casa', logo: 'MC', color: '#f59e0b', whatsappNumber: '+212 661-112233' },
];

function LoginView({
  onLogin,
  selectedUserId,
  onSelectedUserId,
}: {
  onLogin: () => void;
  selectedUserId: string;
  onSelectedUserId: (id: string) => void;
}) {
  return (
    <div className="min-h-screen flex items-stretch">
      <div className="flex-1 flex flex-col justify-center px-12 md:px-24 bg-white relative z-10 w-full lg:w-1/2">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Layers className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-zinc-900">Nexus CRM</span>
          </div>

          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Bon retour.</h1>
          <p className="text-zinc-500 mb-8 font-medium">Connectez-vous à votre plateforme omnicanale premium.</p>

          <form className="space-y-5" data-action="auth.login" onSubmit={(e) => (e.preventDefault(), onLogin())}>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">Session</label>
              <select
                value={selectedUserId}
                onChange={(e) => onSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-bold text-zinc-700 bg-white"
              >
                <option value={MOCK_USER_ADMIN.id}>Admin (tous accès)</option>
                <option value={MOCK_USER_MANAGER.id}>Manager (accès management)</option>
                <option value={MOCK_USER_CONFIRMATRICE.id}>Confirmatrice (poste opérationnel)</option>
              </select>
              <p className="mt-2 text-xs font-medium text-zinc-500">
                Cette sélection simule les permissions. Backend + auth viendront après.
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">Email professionel</label>
              <input
                type="email"
                placeholder="nom@nexus.ma"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-zinc-400"
                required
                defaultValue="amine@nexus.ma"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-zinc-700">Mot de passe</label>
                <a href="#" className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                  Oublié ?
                </a>
              </div>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                required
                defaultValue="password123"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-200 transition-all flex items-center justify-center gap-2 mt-4"
            >
              Se connecter
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-zinc-100">
            <p className="text-zinc-500 text-sm">Nexus CRM — Solution intelligente pour e-commerce marocain.</p>
          </div>
        </div>
      </div>

      <div className="hidden lg:block lg:flex-1 relative bg-primary-600 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center px-12">
          <div className="max-w-lg text-white space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-xs font-medium tracking-wide uppercase">
              Omnicanal Dashboard
            </div>
            <h2 className="text-5xl font-bold leading-tight">Gérez vos marques avec une précision chirurgicale.</h2>
            <p className="text-primary-100 text-lg leading-relaxed font-light">
              Nexus centralise vos leads, vos conversations WhatsApp et vos stocks sur une interface unique pensée pour la performance de votre business au Maroc.
            </p>
          </div>
        </div>

        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedLoginUserId, setSelectedLoginUserId] = useState<string>(MOCK_USER_ADMIN.id);
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USER_ADMIN);
  /** Admin: which confirmatrice workspace is shown in "Espace Confirmatrice". */
  const [selectedConfirmatriceUserId, setSelectedConfirmatriceUserId] = useState<string>(MOCK_USER_CONFIRMATRICE.id);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [brands, setBrands] = useState<(Brand & { status?: 'Actif' | 'Inactif'; code?: string; contact?: string; note?: string })[]>(
    () => MOCK_BRANDS.map((b) => ({ ...b, status: 'Actif', code: b.logo, contact: '', note: '' })),
  );
  const [activeBrandId, setActiveBrandId] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus.activeBrandId');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return brands[0]?.id ?? 'b1';
  });
  const [orders, setOrders] = useState<Order[]>([
    {
      id: 'NX-10021',
      createdAt: '21/04/2026',
      brand: 'Luxe Cosmetics',
      source: 'Facebook',
      customerName: 'Karim Benjelloun',
      phone: '+212 612-345-678',
      city: 'Casablanca',
      address: '',
      status: 'En attente',
      payment: 'Impayé',
      total: 450,
      items: [{ id: 'i1', name: 'Pack Sérum Vitamine C', qty: 1, price: 450 }],
      notes: 'Rappeler après 18h.',
    },
    {
      id: 'NX-10020',
      createdAt: '21/04/2026',
      brand: 'Zest Home',
      source: 'TikTok',
      customerName: 'Fatima Zahra',
      phone: '+212 661-222-333',
      city: 'Rabat',
      address: '',
      status: 'Confirmé',
      payment: 'Partiel',
      total: 1200,
      items: [
        { id: 'i1', name: 'Lampe Design Zest', qty: 1, price: 850 },
        { id: 'i2', name: 'Frais livraison', qty: 1, price: 350 },
      ],
      notes: '',
    },
  ]);
  const [orderDraft, setOrderDraft] = useState<Partial<OrderDraft> | null>(null);

  const [users] = useState<User[]>([
    MOCK_USER_ADMIN,
    MOCK_USER_CONFIRMATRICE,
    { id: '3', name: 'Hajar Ait Lahcen', role: 'confirmatrice', email: 'hajar@nexus.ma' },
    MOCK_USER_MANAGER,
  ]);

  const [leads] = useState([
    {
      id: 'L-001',
      name: 'Karim Benjelloun',
      phone: '+212 612-345-678',
      brand: 'Luxe Cosmetics',
      status: 'contacted',
      agent: 'Sara El Malki',
      createdAt: '21/04/2026',
      price: 450,
      source: 'Facebook',
    },
    {
      id: 'L-002',
      name: 'Fatima Zahra',
      phone: '+212 661-222-333',
      brand: 'Zest Home',
      status: 'confirmed',
      agent: 'Hajar Ait Lahcen',
      createdAt: '21/04/2026',
      price: 1200,
      source: 'TikTok',
    },
    {
      id: 'L-003',
      name: 'Zineb Amrani',
      phone: '+212 661-555-666',
      brand: 'Moda Casa',
      status: 'new',
      agent: 'Sara El Malki',
      createdAt: '21/04/2026',
      price: 799,
      source: 'Instagram',
    },
  ] satisfies import('./types').Lead[]);

  const [suppliers, setSuppliers] = useState<import('./screens/SuppliersScreen').Supplier[]>([
    {
      id: 'SUP-001',
      name: 'Atlas Packaging',
      contact: 'Rachid',
      phone: '+212 6XX-XXXXXX',
      category: 'Packaging',
      avgLeadDays: 2,
      status: 'Actif',
      note: 'Délais fiables, qualité OK.',
    },
    {
      id: 'SUP-002',
      name: 'Nord Supply',
      contact: 'Amina',
      phone: '+212 6XX-XXXXXX',
      category: 'Décoration',
      avgLeadDays: 5,
      status: 'Actif',
      note: 'Négocier remises sur volume.',
    },
    {
      id: 'SUP-003',
      name: 'Marrakech Express',
      contact: 'Yassine',
      phone: '+212 6XX-XXXXXX',
      category: 'Mobilier',
      avgLeadDays: 7,
      status: 'Inactif',
      note: 'En pause (retards).',
    },
  ]);
  const [purchaseOrders] = useState<import('./screens/SuppliersScreen').PurchaseOrder[]>([
    { id: 'PO-001', ref: 'PO-2026-001', supplierId: 'SUP-001', status: 'Envoyée', amount: 1800, receivedQty: 0, totalQty: 300, payment: 'Non payé' },
    { id: 'PO-002', ref: 'PO-2026-002', supplierId: 'SUP-002', status: 'Partielle', amount: 2400, receivedQty: 12, totalQty: 20, payment: 'Partiel' },
    { id: 'PO-003', ref: 'PO-2026-003', supplierId: 'SUP-001', status: 'Reçue', amount: 950, receivedQty: 100, totalQty: 100, payment: 'Payé' },
  ]);

  const [deliveryCompanies] = useState<import('./screens/DeliveryScreen').DeliveryCompany[]>([
    { id: 'DC-001', name: 'Amana', contact: 'Support', zones: 'National', avgCost: 35, status: 'Actif', performance: 82 },
    { id: 'DC-002', name: 'Jibli', contact: 'Ops', zones: 'Casablanca/Rabat', avgCost: 30, status: 'Actif', performance: 76 },
    { id: 'DC-003', name: 'Aramex', contact: 'Commercial', zones: 'International', avgCost: 90, status: 'Inactif', performance: 68 },
  ]);
  const [couriers] = useState<import('./screens/DeliveryScreen').Courier[]>([
    { id: 'CR-001', name: 'Omar', phone: '+212 6XX-XXXXXX', companyId: 'DC-002', deliveries: 124, successRate: 86, status: 'Actif' },
    { id: 'CR-002', name: 'Salma', phone: '+212 6XX-XXXXXX', companyId: 'DC-002', deliveries: 88, successRate: 79, status: 'Actif' },
    { id: 'CR-003', name: 'Hamza', phone: '+212 6XX-XXXXXX', companyId: 'DC-001', deliveries: 210, successRate: 83, status: 'Actif' },
  ]);
  const [deliveryPayments] = useState<import('./screens/DeliveryScreen').DeliveryPayment[]>([
    { id: 'DP-001', companyId: 'DC-002', label: 'Semaine 16 • COD', amount: 5400, state: 'Dû' },
    { id: 'DP-002', companyId: 'DC-001', label: 'Semaine 16 • Facture', amount: 2100, state: 'En attente' },
    { id: 'DP-003', companyId: 'DC-002', label: 'Semaine 15 • COD', amount: 6200, state: 'Payé' },
  ]);

  const [campaigns, setCampaigns] = useState<import('./screens/AdsScreen').Campaign[]>([
    { id: 'CMP-001', name: 'LC • Serum • ABO', brandId: brands[0]!.id, source: 'Meta', budget: 2400, leads: 180, orders: 22, status: 'Active', period: 'Avril 2026', notes: 'Tester créa #3' },
    { id: 'CMP-002', name: 'ZH • Lamp • Traffic', brandId: brands[1]!.id, source: 'TikTok', budget: 1600, leads: 95, orders: 9, status: 'Pause', period: 'Avril 2026' },
    { id: 'CMP-003', name: 'MC • Sofa • Search', brandId: brands[2]!.id, source: 'Google', budget: 900, leads: 30, orders: 4, status: 'Terminée', period: 'Mars 2026' },
  ]);
  const [shipments, setShipments] = useState<Shipment[]>([
    {
      id: 'SH-001',
      tracking: 'TRK-12001',
      orderId: 'NX-10021',
      brand: 'Luxe Cosmetics',
      customerName: 'Karim Benjelloun',
      phone: '+212 612-345-678',
      city: 'Casablanca',
      status: 'En livraison',
      carrier: 'Amana',
      codAmount: 450,
      updatedAtLabel: '10:20',
      notes: 'À livrer aujourd’hui.',
    },
    {
      id: 'SH-002',
      tracking: 'TRK-12002',
      orderId: 'NX-10020',
      brand: 'Zest Home',
      customerName: 'Fatima Zahra',
      phone: '+212 661-222-333',
      city: 'Rabat',
      status: 'Expédié',
      carrier: 'Jibli',
      codAmount: 1200,
      updatedAtLabel: 'Hier',
      notes: '',
    },
  ]);
  const [products, setProducts] = useState<Product[]>([
    {
      id: 'PRD-001',
      name: 'Pack Sérum Vitamine C',
      sku: 'LC-SVC-001',
      brand: 'Luxe Cosmetics',
      supplier: 'Atlas Packaging',
      price: 450,
      cost: 210,
      stock: 125,
      lowStockThreshold: 20,
      status: 'Actif',
    },
    {
      id: 'PRD-002',
      name: 'Lampe Design Zest',
      sku: 'ZH-LDZ-010',
      brand: 'Zest Home',
      supplier: 'Nord Supply',
      price: 850,
      cost: 420,
      stock: 8,
      lowStockThreshold: 15,
      status: 'Actif',
    },
    {
      id: 'PRD-003',
      name: 'Fauteuil Velours Bleu',
      sku: 'MC-FVB-120',
      brand: 'Moda Casa',
      supplier: 'Marrakech Express',
      price: 2400,
      cost: 1500,
      stock: 4,
      lowStockThreshold: 5,
      status: 'Actif',
    },
  ]);
  const [charges, setCharges] = useState<Charge[]>([
    { id: 'CH-001', date: '21/04/2026', brand: 'Multi-brand', type: 'frais_publicitaires', amount: 2400, note: 'Meta Ads' },
    { id: 'CH-002', date: '21/04/2026', brand: 'Luxe Cosmetics', type: 'frais_livraison', amount: 620, note: 'Amana' },
    { id: 'CH-003', date: '20/04/2026', brand: 'Zest Home', type: "prix_d'achat", amount: 1800, note: 'Restock fournisseur' },
    { id: 'CH-004', date: '20/04/2026', brand: 'Multi-brand', type: 'frais_risque', amount: 310, note: 'Retours' },
  ]);

  const actionCtx = useMemo(() => ({ userId: isLoggedIn ? currentUser.id : undefined, view: activeView }), [isLoggedIn, activeView, currentUser.id]);

  useEffect(() => {
    registerAction('auth.login', () => trackSession({ name: 'auth.login', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } }));
    registerAction('auth.logout', () => trackSession({ name: 'auth.logout', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } }));
  }, [currentUser.id, currentUser.role]);

  useEffect(() => initGlobalActions(() => actionCtx), [actionCtx]);

  useEffect(() => {
    if (isLoggedIn) trackSession({ name: 'session.start', ts: Date.now(), meta: { userId: currentUser.id, role: currentUser.role } });
  }, [isLoggedIn, currentUser.id, currentUser.role]);

  useEffect(() => {
    if (!isLoggedIn) return;
    trackSession({ name: 'nav.view', ts: Date.now(), meta: { view: activeView, userId: currentUser.id, role: currentUser.role } });
  }, [activeView, isLoggedIn, currentUser.id, currentUser.role]);

  useEffect(() => {
    try {
      localStorage.setItem('nexus.activeBrandId', activeBrandId);
    } catch {
      // ignore
    }
  }, [activeBrandId]);

  const allowedViewsByRole: Record<User['role'], View[]> = {
    admin: [
      'dashboard',
      'ordersNew',
      'orders',
      'whatsapp',
      'confirmatrice',
      'leads',
      'brands',
      'ads',
      'products',
      'stock',
      'delivery',
      'shipments',
      'trackingParcels',
      'suppliers',
      'reporting',
      'hr',
      'finance',
      'settings',
      'tracking',
    ],
    manager: [
      'dashboard',
      'ordersNew',
      'orders',
      'whatsapp',
      'leads',
      'brands',
      'ads',
      'products',
      'stock',
      'delivery',
      'shipments',
      'trackingParcels',
      'suppliers',
      'reporting',
      'finance',
      'tracking',
      'settings',
    ],
    confirmatrice: ['confirmatrice', 'whatsapp', 'leads', 'ordersNew', 'orders'],
  };
  const canAccess = (v: View) => allowedViewsByRole[currentUser.role].includes(v);

  /** Must run before any conditional return — same hook order logged in or out. */
  const commerceNavItems = useMemo(() => {
    const allowed = allowedViewsByRole[currentUser.role];
    const allow = (v: View) => allowed.includes(v);
    const raw: { id: View; label: string; icon: typeof Home }[] = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'ordersNew', label: 'Nouvelle commande', icon: Package },
      { id: 'orders', label: 'Commandes', icon: Package },
      { id: 'whatsapp', label: 'Conversations', icon: MessageSquare },
      {
        id: 'confirmatrice',
        label: currentUser.role === 'confirmatrice' ? 'Votre espace' : 'Espace Confirmatrice',
        icon: MessageSquare,
      },
      { id: 'leads', label: 'Gestion Leads', icon: Users },
      { id: 'brands', label: 'Mes Brands', icon: Store },
    ];
    let filtered = raw.filter((it) => allow(it.id));
    if (currentUser.role === 'confirmatrice') {
      const yours = filtered.find((i) => i.id === 'confirmatrice');
      const rest = filtered.filter((i) => i.id !== 'confirmatrice');
      filtered = yours ? [yours, ...rest] : filtered;
    }
    return filtered.map((it) => ({
      ...it,
      active: activeView === it.id,
      onClick: () => setActiveView(it.id),
    }));
  }, [currentUser.role, activeView]);

  if (!isLoggedIn)
    return (
      <LoginView
        selectedUserId={selectedLoginUserId}
        onSelectedUserId={setSelectedLoginUserId}
        onLogin={() => {
          const u =
            selectedLoginUserId === MOCK_USER_CONFIRMATRICE.id
              ? MOCK_USER_CONFIRMATRICE
              : selectedLoginUserId === MOCK_USER_MANAGER.id
                ? MOCK_USER_MANAGER
                : MOCK_USER_ADMIN;
          setCurrentUser(u);
          setIsLoggedIn(true);
          setActiveView(u.role === 'confirmatrice' ? 'confirmatrice' : 'dashboard');
        }}
      />
    );

  const navGroups = [
    {
      id: 'commerce',
      label: 'Commerce',
      items: commerceNavItems,
    },
    {
      id: 'operations',
      label: 'Opérations',
      items: [
        { id: 'ads', label: 'Campagnes Ads', icon: Megaphone, active: activeView === 'ads', onClick: () => setActiveView('ads') },
        { id: 'stock', label: 'Stocks', icon: Package, active: activeView === 'stock', onClick: () => setActiveView('stock') },
        { id: 'delivery', label: 'Livraison', icon: Truck, active: activeView === 'delivery', onClick: () => setActiveView('delivery') },
        { id: 'trackingParcels', label: 'Suivi colis', icon: Truck, active: activeView === 'trackingParcels', onClick: () => setActiveView('trackingParcels') },
        { id: 'suppliers', label: 'Fournisseurs', icon: Tag, active: activeView === 'suppliers', onClick: () => setActiveView('suppliers') },
      ],
    },
    {
      id: 'management',
      label: 'Management',
      items: [
        { id: 'reporting', label: 'Reportings', icon: PieChart, active: activeView === 'reporting', onClick: () => setActiveView('reporting') },
        { id: 'hr', label: 'Espace RH', icon: Briefcase, active: activeView === 'hr', onClick: () => setActiveView('hr') },
        { id: 'finance', label: 'Finance', icon: PieChart, active: activeView === 'finance', onClick: () => setActiveView('finance') },
        { id: 'settings', label: 'Configuration', icon: Settings, active: activeView === 'settings', onClick: () => setActiveView('settings') },
        { id: 'tracking', label: 'Historique', icon: BarChart3, active: activeView === 'tracking', onClick: () => setActiveView('tracking') },
      ],
    },
  ].map((g) => ({
    ...g,
    items: g.items.filter((it) => canAccess(it.id as View)),
  })).filter((g) => g.items.length > 0);

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? brands[0]!;
  const activeOrderBrand = activeBrand.name as any;
  const brandIdByName = (name: string) => brands.find((b) => b.name === name)?.id;

  const renderContent = () => {
    if (!canAccess(activeView)) {
      const fallback = currentUser.role === 'confirmatrice' ? 'confirmatrice' : 'dashboard';
      return (
        <PlaceholderScreen
          title="Accès limité"
          subtitle="Cette session n’a pas les permissions pour ce module."
          cta={
            <button
              onClick={() => setActiveView(fallback)}
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
        return <OrdersListScreen orders={orders} onNewOrder={() => { setOrderDraft(null); setActiveView('ordersNew'); }} />;
      case 'ordersNew':
        return (
          <OrdersNewScreen
            brand={activeOrderBrand}
            initialDraft={orderDraft ?? undefined}
            onBackToList={() => setActiveView('orders')}
            onCreate={(draft) => {
              const now = new Date();
              const dd = String(now.getDate()).padStart(2, '0');
              const mm = String(now.getMonth() + 1).padStart(2, '0');
              const yyyy = String(now.getFullYear());
              const createdAt = `${dd}/${mm}/${yyyy}`;
              const subtotal = draft.items.reduce((s, l) => s + l.qty * l.price, 0);
              const shipping = 35;
              const total = subtotal + shipping;
              const id = `NX-${10000 + orders.length + 1}`;
              const order: Order = {
                id,
                createdAt,
                brand: draft.brand,
                source: draft.source,
                customerName: draft.customerName,
                phone: draft.phone,
                city: draft.city,
                address: draft.address,
                status: 'En attente',
                payment: 'Impayé',
                total,
                items: draft.items,
                notes: draft.notes,
              };
              setOrders((prev) => [order, ...prev]);
              setOrderDraft(null);
              setActiveView('orders');
            }}
          />
        );
      case 'whatsapp':
        return (
          <WhatsAppWorkspaceScreen
            onCreateOrderFromLead={(draft) => {
              const leadBrandId = brandIdByName(String((draft as any).brand ?? ''));
              if (leadBrandId) setActiveBrandId(leadBrandId);
              const { brand: _ignoreBrand, ...rest } = draft as any;
              setOrderDraft(rest);
              setActiveView('ordersNew');
            }}
          />
        );
      case 'confirmatrice':
        return (
          <ConfirmatriceSpaceScreen
            viewerRole={currentUser.role}
            selectedConfirmatriceId={selectedConfirmatriceUserId}
            selectedConfirmatriceName={
              users.find((u) => u.id === selectedConfirmatriceUserId)?.name ?? '—'
            }
            confirmatriceOptions={users.filter((u) => u.role === 'confirmatrice').map((u) => ({ id: u.id, name: u.name }))}
            onSelectConfirmatrice={(id) => {
              setSelectedConfirmatriceUserId(id);
              trackSession({
                name: 'audit.confirmatrice.admin_select_user',
                ts: Date.now(),
                meta: { selectedConfirmatriceId: id },
              });
            }}
            onOpenWhatsApp={() => setActiveView('whatsapp')}
            onOpenOrders={() => setActiveView('orders')}
            onOpenLeads={() => setActiveView('leads')}
            onCreateOrder={() => {
              setOrderDraft(null);
              setActiveView('ordersNew');
            }}
          />
        );
      case 'reporting':
        return <ReportingScreen orders={orders} shipments={shipments} products={products} charges={charges} brands={brands} users={users} />;
      case 'hr':
        return (
          <HrScreen
            collaborators={[
              { id: 'c1', name: 'Sara El Malki', role: 'confirmatrice', team: 'Confirmations', phone: '+212 6XX-XXXXXX', status: 'Actif', joinedAt: '12/02/2026', performance: 84, lastLogin: "aujourd'hui 09:10" },
              { id: 'c2', name: 'Hajar Ait Lahcen', role: 'confirmatrice', team: 'Confirmations', phone: '+212 6XX-XXXXXX', status: 'Actif', joinedAt: '20/01/2026', performance: 78, lastLogin: "aujourd'hui 09:20" },
              { id: 'c3', name: 'Youssef Manager', role: 'manager', team: 'Ops', phone: '+212 6XX-XXXXXX', status: 'Actif', joinedAt: '01/10/2025', performance: 72, lastLogin: 'hier 18:04' },
              { id: 'c4', name: 'Amine El Alaoui', role: 'admin', team: 'Admin', phone: '+212 6XX-XXXXXX', status: 'Actif', joinedAt: '01/01/2025', performance: 90, lastLogin: 'hier 20:10' },
              { id: 'c5', name: 'Compte test', role: 'confirmatrice', team: 'Confirmations', phone: '+212 6XX-XXXXXX', status: 'Inactif', joinedAt: '05/12/2025', performance: 40, lastLogin: 'il y a 30 jours' },
            ]}
          />
        );
      case 'tracking':
        return <TrackingScreen />;
      case 'brands':
        return (
          <BrandsScreen
            brands={brands}
            orders={orders}
            products={products}
            activeBrandId={activeBrandId}
            onSetActiveBrand={(id) => setActiveBrandId(id)}
            onUpsertBrand={(b) => setBrands((prev) => {
              const idx = prev.findIndex((x) => x.id === b.id);
              if (idx === -1) return [b, ...prev];
              const next = prev.slice();
              next[idx] = { ...next[idx], ...b };
              return next;
            })}
          />
        );
      case 'leads':
        return (
          <LeadsScreen
            leads={leads}
            brands={brands}
            users={users}
            activeBrandName={activeBrand.name}
            onOpenConversation={() => setActiveView('whatsapp')}
            onCreateOrderFromLead={(draft) => {
              const leadBrandId = brandIdByName(String((draft as any).brand ?? ''));
              if (leadBrandId) setActiveBrandId(leadBrandId);
              const { brand: _ignoreBrand, ...rest } = draft as any;
              setOrderDraft(rest);
              setActiveView('ordersNew');
            }}
          />
        );
      case 'suppliers':
        return (
          <SuppliersScreen
            suppliers={suppliers}
            purchaseOrders={purchaseOrders}
            onUpsertSupplier={(s) =>
              setSuppliers((prev) => {
                const idx = prev.findIndex((x) => x.id === s.id);
                if (idx === -1) return [s, ...prev];
                const next = prev.slice();
                next[idx] = { ...next[idx], ...s };
                return next;
              })
            }
          />
        );
      case 'delivery':
        return <DeliveryScreen companies={deliveryCompanies} couriers={couriers} payments={deliveryPayments} />;
      case 'ads':
        return (
          <AdsScreen
            brands={brands}
            campaigns={campaigns}
            activeBrandId={activeBrandId}
            onUpsertCampaign={(c) =>
              setCampaigns((prev) => {
                const idx = prev.findIndex((x) => x.id === c.id);
                if (idx === -1) return [c, ...prev];
                const next = prev.slice();
                next[idx] = { ...next[idx], ...c };
                return next;
              })
            }
          />
        );
      case 'shipments':
        return (
          <ShipmentsScreen
            shipments={shipments}
            onCreate={(draft: ShipmentDraft) => {
              const ts = Date.now();
              const tracking = `TRK-${12000 + shipments.length + 1}`;
              const id = `SH-${String(shipments.length + 1).padStart(3, '0')}`;
              const shipment: Shipment = {
                id,
                tracking,
                updatedAtLabel: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                ...draft,
              };
              setShipments((prev) => [shipment, ...prev]);
            }}
          />
        );
      case 'trackingParcels':
        return <ShipmentsScreen shipments={shipments} onCreate={() => undefined as any} />;
      case 'products':
      case 'stock':
        return (
          <ProductsStockScreen
            products={products}
            onCreate={(draft: ProductDraft) => {
              const id = `PRD-${String(products.length + 1).padStart(3, '0')}`;
              const p: Product = { id, ...draft };
              setProducts((prev) => [p, ...prev]);
            }}
            onUpdate={(id, patch) => setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))}
          />
        );
      case 'finance':
        return (
          <FinanceScreen
            charges={charges}
            onCreateCharge={(draft: ChargeDraft) => {
              const id = `CH-${String(charges.length + 1).padStart(3, '0')}`;
              const c: Charge = { id, ...draft };
              setCharges((prev) => [c, ...prev]);
            }}
          />
        );
      case 'settings':
        return <SettingsScreen />;
      default:
        return <PlaceholderScreen title={activeView} subtitle="Écran prêt à implémenter (design system actif)." />;
    }
  };

  return (
    <ErrorBoundary>
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
            onClick={() => {
              setIsLoggedIn(false);
              setCurrentUser(MOCK_USER_ADMIN);
              setSelectedLoginUserId(MOCK_USER_ADMIN.id);
              setActiveView('dashboard');
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
          <button
            type="button"
            onClick={() => setActiveBrandId(activeBrand.id === brands[0]!.id ? brands[1]!.id : brands[0]!.id)}
            className={cn(
              'flex items-center gap-3 bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 transition-colors',
            )}
            title="Switcher (demo)"
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] text-white font-bold"
              style={{ backgroundColor: activeBrand.color }}
            >
              {activeBrand.logo}
            </div>
            <span className="text-sm font-bold text-zinc-700 hidden md:block">{activeBrand.name}</span>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </button>
        }
        topbarRight={
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-zinc-900 leading-none">{currentUser.name}</p>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mt-1">{currentUser.role}</p>
            </div>
            <img src={currentUser.avatar} alt="Avatar" className="w-9 h-9 rounded-xl object-cover ring-2 ring-white shadow-sm" />
          </div>
        }
      >
        {renderContent()}
      </AppShell>
    </ErrorBoundary>
  );
}

