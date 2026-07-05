export type ProductStatus = 'Actif' | 'Inactif';
export type ProductBrand = string;

export type Product = {
  apiId: number;
  id: string;
  name: string;
  sku: string;
  brand: ProductBrand;
  category: string;
  productType: string;
  supplier: string;
  price: number;
  cost: number;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  status: ProductStatus;
  image: string;
};

export type ProductDraft = Omit<Product, 'id' | 'apiId'>;
