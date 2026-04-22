export type ChargeType =
  | "prix_d'achat"
  | 'frais_publicitaires'
  | 'frais_livraison'
  | 'frais_confirmation'
  | 'frais_emballage'
  | 'frais_transport'
  | 'frais_contenu'
  | 'frais_cadeau'
  | 'frais_risque'
  | 'frais_divers';

export type Charge = {
  id: string;
  date: string; // dd/mm/yyyy
  brand: 'Luxe Cosmetics' | 'Zest Home' | 'Moda Casa' | 'Multi-brand';
  type: ChargeType;
  amount: number;
  note?: string;
};

export type ChargeDraft = Omit<Charge, 'id'>;

