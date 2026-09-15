import type {
  OrderStatus as PrismaOrderStatus,
  OrderType as PrismaOrderType,
} from "@prisma/client";

export const ORDER_STATUSES = [
  "NEW",
  "PROCESSING",
  "DELIVERY",
  "DONE",
  "CANCELLED",
] as const satisfies readonly PrismaOrderStatus[];
export type OrderStatus = PrismaOrderStatus;

export const ORDER_TYPES = [
  "order",
  "consultation",
  "masterclass",
] as const satisfies readonly PrismaOrderType[];
export type OrderType = PrismaOrderType;

export type DashboardRange = "7d" | "30d" | "90d" | "all";

export type MetricWithDelta = { value: number; delta: number | null; deltaAbs: number | null };

export type DashboardStats = {
  range: DashboardRange;
  asOf: string;
  start: string | null;
  previousStart: string | null;
  kpis: {
    total: MetricWithDelta;
    new: number;
    processing: number;
    delivery: number;
    cancelledNow: number;
    done: MetricWithDelta;
    cancelled: MetricWithDelta;
    revenue: MetricWithDelta;
    unitsSold: MetricWithDelta;
    profit: MetricWithDelta;
    aov: MetricWithDelta;
    newClients: MetricWithDelta;
    conversionRate: MetricWithDelta;
  };
  timeline: Array<{ key: string; label: string; orders: number; revenue: number }>;
  regionOrders: Array<{ region: string; count: number }>;
  utmSources: Array<{ source: string | null; count: number }>;
  topProducts: Array<{ slug: string; name: string; units: number; revenue: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  recentOrders: Array<{
    id: string;
    clientName: string;
    type: string;
    status: OrderStatus;
    createdAt: string;
    productNames: string[];
  }>;
  quality: {
    missingRetail: number;
    missingCost: number;
    previousMissingRetail: number;
    previousMissingCost: number;
    cancelledMissingRetail: number;
  };
  lostRevenue: number;
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
  submitted: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    region: string;
  };
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
  profileAudits: Array<{
    id: string;
    actor: string;
    createdAt: string;
  }>;
};

export type CatalogProductView = {
  slug: string;
  name: string;
  sku: string;
  category: string;
  internalPrice: number;
  retailPrice: number;
  distributorPrice: number;
  updatedAt: string | null;
};
