export type View = 
  | 'login' 
  | 'dashboard' 
  | 'ordersNew'
  | 'orders'
  | 'whatsapp' 
  | 'shipments'
  | 'trackingParcels'
  | 'products'
  | 'finance'
  | 'brands' 
  | 'confirmatrice' 
  | 'leads' 
  | 'ads' 
  | 'hr' 
  | 'delivery'
  | 'stock' 
  | 'suppliers' 
  | 'reporting'
  | 'settings'
  | 'tracking';

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'confirmatrice';
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
  status: 'new' | 'contacted' | 'confirmed' | 'refused' | 'shipped' | 'delivered' | 'returned';
  agent: string;
  createdAt: string;
  price: number;
  source: string;
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
