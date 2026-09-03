import type { OrderStatus, OrderType } from "@/lib/crm-types";

export const statusLabels: Record<OrderStatus, string> = {
  NEW: "Новая",
  PROCESSING: "В обработке",
  DELIVERY: "В доставке",
  DONE: "Выполнена",
  CANCELLED: "Отменена",
};

export const typeLabels: Record<OrderType, string> = {
  order: "Заказ",
  consultation: "Консультация",
  masterclass: "Мастер-класс",
};

export function formatDate(value: string | Date, withTime = true) {
  return new Intl.DateTimeFormat("ru-MD", {
    dateStyle: "medium",
    timeStyle: withTime ? "short" : undefined,
    timeZone: "Europe/Chisinau",
  }).format(new Date(value));
}

export function formatLei(value: number) {
  return new Intl.NumberFormat("ru-MD", {
    style: "currency",
    currency: "MDL",
    maximumFractionDigits: 2,
  }).format(value);
}
