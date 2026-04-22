export type OrderStatus = 'Brouillon' | 'En attente' | 'Confirmé' | 'Annulé' | 'Retourné' | 'Livré' | 'Autre';
export type PaymentState = 'Payé' | 'Impayé' | 'Partiel' | 'Remboursé';
export type OrderSource = 'Facebook' | 'TikTok' | 'Instagram' | 'Google' | 'WhatsApp' | 'Autre';
export type OrderBrand = 'Luxe Cosmetics' | 'Zest Home' | 'Moda Casa';

export type OrderLine = {
  id: string;
  name: string;
  qty: number;
  price: number;
};

export type Order = {
  id: string;
  createdAt: string; // dd/mm/yyyy
  brand: OrderBrand;
  source: OrderSource;
  customerName: string;
  phone: string;
  city: string;
  address?: string;
  status: OrderStatus;
  payment: PaymentState;
  total: number;
  items: OrderLine[];
  notes?: string;
};

export type OrderDraft = {
  brand: OrderBrand;
  source: OrderSource;
  customerName: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  items: OrderLine[];
};

