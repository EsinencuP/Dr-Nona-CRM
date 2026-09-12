"use client";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DashboardStats } from "@/lib/crm-types";

import { ChartCard, EmptyChart } from "./chart-card";
import { dashboardMoney, formatCompactNumber } from "./dashboard-format";
export function OrdersRevenueChart({ data }: { data: DashboardStats["timeline"] }) {
  return (
    <ChartCard title="Заявки и выручка" description="Заявки — все типы; выручка — завершённые товарные заказы.">
      <div className="mb-3 flex flex-wrap gap-4 text-slate-500 text-xs">
        <span>▮ Заявки · левая ось</span>
        <span>━ Выручка, MDL · правая ось</span>
      </div>
      <p className="sr-only">
        {data.map((row) => `${row.label}: ${row.orders} заявок, ${dashboardMoney(row.revenue)}`).join("; ")}
      </p>
      {data.some((row) => row.orders > 0) ? (
        <div className="h-[220px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 220 }}>
            <ComposedChart data={data} margin={{ top: 10, right: 0, left: -18, bottom: 0 }} accessibilityLayer>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 11 }}
                minTickGap={32}
              />
              <YAxis
                yAxisId="orders"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 11 }}
                width={42}
              />
              <YAxis
                yAxisId="revenue"
                orientation="right"
                tickFormatter={formatCompactNumber}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 11 }}
                width={44}
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-800 text-xs shadow-sm">
                      <strong>{label}</strong>
                      <p className="mt-1">
                        Заявки: {String(payload.find((point) => point.dataKey === "orders")?.value ?? 0)}
                      </p>
                      <p className="mt-1">
                        Выручка:{" "}
                        {dashboardMoney(Number(payload.find((point) => point.dataKey === "revenue")?.value ?? 0))}
                      </p>
                    </div>
                  ) : null
                }
              />
              <Bar
                yAxisId="orders"
                dataKey="orders"
                name="Заявки"
                fill="#3B82F6"
                radius={[3, 3, 0, 0]}
                maxBarSize={30}
                isAnimationActive={false}
              />
              <Line
                yAxisId="revenue"
                dataKey="revenue"
                name="Выручка"
                type="linear"
                stroke="#10B981"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
