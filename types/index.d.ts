export type Data = [SellerPageLinks] | [];

export type SellerPageLinks = {
  url: string;
  links: Array<CardData>;
};

export type CardData = {
  href: string;
  nmId: string;
  imagePbUrl?: string;
};

export type Product = {
  title: string;
  price: string;
  images: Array<Image>;
  params: Array<Param>;
  additionalParams?: Array<ParamBlock>;
  description?: string;
  stock?: Array<StockInfo>;
};

export type Image = {
  url: string;
};

export type StockInfo = {
  warehouseId?: number;
  warehouseName?: string;
  quantity?: number;
  quantityText?: string;
  deliveryDays?: number;
};

export type Param = {
  name: string;
  value: string;
};

export type ParamBlock = {
  name: string;
  params: Array<Param>;
};

export type WBCardJsonResponse = {
  imt_id: number;
  nm_id: number;
  imt_name: string;
  description: string;
  options: Array<{ name: string; value: string; charc_type?: number }>;
  grouped_options?: Array<{
    group_name: string;
    options: Array<{ name: string; value: string; charc_type?: number }>;
  }>;
  media?: { photo_count: number };
  selling?: { brand_name: string; brand_hash: string; supplier_id: number };
};
