export const ORDER_STATUSES = ["NEW", "PROCESSING", "DELIVERY", "DONE", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TYPES = ["order", "consultation", "masterclass"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export type DashboardRange = "7d" | "30d" | "all";

export type DashboardStats = {
  kpis: {
    total: number;
    processing: number;
    delivery: number;
    done: number;
  };
  timeline: Array<{ label: string; orders: number }>;
  regions: Array<{ region: string; orders: number }>;
  sources: Array<{ source: string; orders: number }>;
  products: Array<{ slug: string; name: string; quantity: number }>;
  completedTurnover: number;
};

export type OrderView = {
  id: string;
  createdAt: string;
  type: OrderType;
  status: OrderStatus;
  comment: string | null;
  preferredCallTime: string | null;
  eventDate: string | null;
  eventTime: string | null;
  masterclassTopic: string | null;
  consultationMode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  entryPoint: string | null;
  sessionHistory: string[];
  client: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    phoneNormalized: string;
    email: string | null;
    region: string;
    previousOrders: Array<{ id: string; createdAt: string; status: OrderStatus; type: OrderType }>;
  };
  items: Array<{ id: string; productSlug: string; name: string; quantity: number; priceAtPurchase: number }>;
};

export type OrdersResult = {
  rows: OrderView[];
  total: number;
  page: number;
  pages: number;
};

export type ClientView = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneNormalized: string;
  email: string | null;
  region: string;
  createdAt: string;
  updatedAt: string;
  orderCount: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  totalValue: number;
  orders: Array<{
    id: string;
    createdAt: string;
    type: OrderType;
    status: OrderStatus;
    value: number;
  }>;
};

export type CatalogProductView = {
  slug: string;
  name: string;
  sku: string;
  category: string;
  internalPrice: number;
  updatedAt: string | null;
};
