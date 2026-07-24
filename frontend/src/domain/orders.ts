export type OrderStatus = 'Brouillon' | 'En attente' | 'Confirmé' | 'Annulé' | 'Retourné' | 'Livré' | 'Autre';
export type PaymentState = 'Payé' | 'Impayé' | 'Partiel' | 'Remboursé' | 'COD en attente' | 'Virement en vérification';
export type OrderSource = string;
export type OrderBrand = string;

export type OrderLine = {
  id: string;
  name: string;
  qty: number;
  price: number;
  productId?: number | null;
};

export type Order = {
  /** Laravel order id (API). */
  apiId: number;
  /** Display ref (order_number). */
  id: string;
  createdAt: string;
  brand: OrderBrand;
  source: OrderSource;
  customerName: string;
  phone: string;
  city: string;
  address?: string;
  status: OrderStatus;
  payment: PaymentState;
  paymentMethod?: string;
  bankTransferDeclaredPaid?: boolean;
  bankTransferReference?: string;
  bankTransferVerificationStatus?: string;
  bankTransferVerificationNote?: string;
  total: number;
  items: OrderLine[];
  notes?: string;
  cancellationReason?: string;
  shipment?: { tracking: string | null; status: string; carrier: string } | null;
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
  customerId?: number;
  leadId?: number;
};
