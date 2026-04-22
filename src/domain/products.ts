export type ProductStatus = 'Actif' | 'Inactif';
export type ProductBrand = 'Luxe Cosmetics' | 'Zest Home' | 'Moda Casa';

export type Product = {
  id: string; // PRD-...
  name: string;
  sku: string;
  brand: ProductBrand;
  supplier: string;
  price: number;
  cost: number;
  stock: number;
  lowStockThreshold: number;
  status: ProductStatus;
};

export type ProductDraft = Omit<Product, 'id'>;

