import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { formatDate, typeLabels } from "@/lib/crm-labels";
import type { DashboardStats } from "@/lib/crm-types";

import { StatusBadge } from "../../_components/status-badge";
import { ChartCard } from "./chart-card";
import { formatRelativeTime } from "./dashboard-format";
export function RecentOrdersFeed({ orders, asOf }: { orders: DashboardStats["recentOrders"]; asOf: string }) {
  return (
    <ChartCard
      title="Последние заявки"
      description="Восемь последних за выбранный период"
      action={
        <Link
          href="/orders"
          className="inline-flex min-h-11 items-center rounded px-1 font-semibold text-blue-500 text-xs focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Все заявки →
        </Link>
      }
    >
      {orders.length ? (
        <ul className="divide-y divide-slate-200">
          {orders.map((order) => {
            const names = order.productNames.join(", ");
            let productLabel = names.length > 40 ? `${names.slice(0, 39)}…` : names;
            if (!productLabel) productLabel = typeLabels[order.type as keyof typeof typeLabels] ?? "Заявка";
            return (
              <li key={order.id}>
                <Link
                  href={`/orders?search=${encodeURIComponent(order.id)}`}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1 py-3 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
                >
                  <div>
                    <StatusBadge status={order.status} className="max-w-full" />
                  </div>
                  <strong className="col-start-1 min-w-0 break-words font-medium text-slate-800 text-sm sm:col-start-auto">
                    {order.clientName}
                  </strong>
                  <span className="col-start-1 truncate text-slate-500 text-xs sm:col-start-auto" title={names}>
                    {productLabel}
                  </span>
                  <time
                    dateTime={order.createdAt}
                    title={formatDate(order.createdAt)}
                    className="col-start-1 text-slate-500 text-xs sm:col-start-auto"
                  >
                    {formatRelativeTime(order.createdAt, asOf)}
                  </time>
                  <ArrowUpRight
                    className="col-start-2 row-start-1 size-4 text-slate-500 sm:col-start-auto sm:row-start-auto"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-10 text-center text-slate-500 text-sm">Нет заявок за выбранный период</p>
      )}
    </ChartCard>
  );
}
