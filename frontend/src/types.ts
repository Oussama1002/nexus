export type View = 
  | 'login' 
  | 'dashboard' 
  | 'ordersNew'
  | 'orders'
  | 'whatsapp' 
  | 'customers'
  | 'trackingParcels'
  | 'products'
  | 'finance'
  | 'brands' 
  | 'confirmatrice' 
  | 'leads' 
  | 'ads' 
  | 'knowledgeBase'
  | 'academy'
  | 'mediaBuying'
  | 'collabProjects'
  | 'automations'
  | 'clientPortal'
  | 'hr' 
  | 'delivery'
  | 'deliveryDashboard'
  | 'stock' 
  | 'suppliers'
  | 'purchaseOrders'
  | 'reporting'
  | 'settings'
  | 'tracking'
  | 'usersAdmin'
  | 'socialMedia'
  | 'influenceHub'
  | 'comptabilite'
  | 'profile';

export interface User {
  id: string;
  name: string;
  /** Primary role slug from API (e.g. admin, confirmatrice) or legacy union. */
  role: 'admin' | 'manager' | 'confirmatrice' | string;
  email: string;
  avatar?: string;
}

export interface Brand {
  id: string;
  name: string;
  logo: string;
  color: string;
  whatsappNumber: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  brand: string;
  status: string;
  agent: string;
  createdAt: string;
  price: number;
  source: string;
  /** Laravel customer id when known */
  customerId?: number;
}

export interface Campaign {
  id: string;
  name: string;
  brand: string;
  platform: 'facebook' | 'tiktok' | 'google' | 'instagram';
  budget: number;
  leads: number;
  spend: number;
  status: 'active' | 'paused' | 'ended';
}
