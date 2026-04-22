export type ShipmentStatus = 'En préparation' | 'Expédié' | 'En livraison' | 'Livré' | 'Retourné' | 'Annulé' | 'Retard';
export type Carrier = 'Amana' | 'Jibli' | 'Cathedis' | 'Flash' | 'Autre';

export type Shipment = {
  id: string; // SH-...
  tracking: string; // TRK-...
  orderId?: string; // NX-...
  brand: 'Luxe Cosmetics' | 'Zest Home' | 'Moda Casa';
  customerName: string;
  phone: string;
  city: string;
  status: ShipmentStatus;
  carrier: Carrier;
  codAmount: number;
  updatedAtLabel: string; // time / date
  notes?: string;
};

export type ShipmentDraft = Omit<Shipment, 'id' | 'tracking' | 'updatedAtLabel'> & {
  notes: string;
};

