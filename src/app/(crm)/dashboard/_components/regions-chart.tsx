"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DashboardStats } from "@/lib/crm-types";

import { ChartCard, EmptyChart } from "./chart-card";
export function RegionsChart({ data }: { data: DashboardStats["regionOrders"] }) {
  const top = data.slice(0, 8);
  return (
    <ChartCard title="Заявки по регионам" description="Топ-8 · регион из текущей карточки клиента">
      <p className="sr-only">{top.map((row) => `${row.region}: ${row.count} заявок`).join("; ")}</p>
      {top.length ? (
        <div className="h-[220px] min-w-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 220 }}>
            <BarChart data={top} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }} accessibilityLayer>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="region"
                width={120}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 11 }}
                tickFormatter={(value: string) => (value.length > 17 ? `${value.slice(0, 16)}…` : value)}
              />
              <Tooltip
                formatter={(value) => [`${value} заявок`, "Количество"]}
                contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0", fontSize: 12, color: "#64748B" }}
              />
              <Bar
                dataKey="count"
                name="Заявки"
                fill="#3B82F6"
                radius={[0, 4, 4, 0]}
                maxBarSize={18}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
