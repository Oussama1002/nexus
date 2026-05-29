/** Matches backend Charge.type */
export type ChargeTypeApi =
  | 'ads'
  | 'salary'
  | 'delivery'
  | 'supplier'
  | 'rent'
  | 'tools'
  | 'influencer'
  | 'other';

export const CHARGE_TYPE_LABELS: Record<ChargeTypeApi, string> = {
  ads: 'Publicité',
  salary: 'Salaires',
  delivery: 'Livraison',
  supplier: 'Fournisseur',
  rent: 'Loyer',
  tools: 'Outils',
  influencer: 'Influence',
  other: 'Autre',
};

export type ChargeApi = {
  id: number;
  brand_id: number | null;
  charge_date: string;
  type: ChargeTypeApi;
  amount: string | number;
  note?: string | null;
  created_by?: number | null;
  brand?: { id: number; name: string } | null;
  creator?: { id: number; name: string } | null;
};

export type ChargeDraftApi = {
  brand_id: number | null;
  charge_date: string;
  type: ChargeTypeApi;
  amount: number;
  note?: string;
};
