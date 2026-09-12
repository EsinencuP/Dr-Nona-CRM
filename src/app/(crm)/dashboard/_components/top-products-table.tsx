import Link from "next/link";

import type { DashboardStats } from "@/lib/crm-types";

import { ChartCard } from "./chart-card";
import { dashboardMoney } from "./dashboard-format";
export function TopProductsTable({ products, period }: { products: DashboardStats["topProducts"]; period: string }) {
  return (
    <ChartCard
      title="Топ товаров"
      action={<span className="rounded-full bg-slate-50 px-2 py-1 text-slate-500 text-xs">{period}</span>}
    >
      {products.length ? (
        <table className="w-full table-fixed text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th scope="col" className="w-[43%] pb-3 font-medium">
                Товар
              </th>
              <th scope="col" className="w-[16%] pb-3 text-right font-medium">
                Штук
              </th>
              <th scope="col" className="pb-3 text-right font-medium">
                Выручка
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {products.map((product) => (
              <tr key={product.slug} className="transition-colors hover:bg-slate-50">
                <th scope="row" className="py-3 pr-2 text-left font-medium text-slate-800">
                  <span className="block truncate" title={product.name}>
                    {product.name}
                  </span>
                </th>
                <td className="py-3 text-right font-bold text-violet-600 tabular-nums">{product.units}</td>
                <td className="break-words py-3 pl-2 text-right text-slate-800 tabular-nums">
                  {dashboardMoney(product.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="flex min-h-48 items-center justify-center text-center text-slate-500 text-sm">
          Нет завершённых продаж за выбранный период
        </p>
      )}
      <Link
        href="/catalog"
        className="mt-3 inline-flex min-h-11 items-center gap-1 rounded px-1 font-semibold text-slate-800 text-xs underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Все товары →
      </Link>
    </ChartCard>
  );
}
