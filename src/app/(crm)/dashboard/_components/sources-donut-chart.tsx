"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { DashboardStats } from "@/lib/crm-types";

import { ChartCard, EmptyChart } from "./chart-card";
import { groupSources } from "./dashboard-format";

const colors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#64748B"];
export function SourcesDonutChart({ data }: { data: DashboardStats["utmSources"] }) {
  const rows = groupSources(data);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <ChartCard title="Источники заявок" description="UTM source · доля за выбранный период">
      <p className="sr-only">
        Всего {total}. {rows.map((row) => `${row.label}: ${row.count}`).join("; ")}
      </p>
      {total ? (
        <>
          <div className="relative h-[160px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 160 }}>
              <PieChart accessibilityLayer>
                <Pie
                  data={rows}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={73}
                  stroke="#FFFFFF"
                  strokeWidth={3}
                  isAnimationActive={false}
                >
                  {rows.map((row, index) => (
                    <Cell key={row.key} fill={colors[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value} заявок`, "Количество"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0", fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-2xl text-slate-800">{total}</strong>
              <span className="text-slate-500 text-xs">заявок</span>
            </div>
          </div>
          <ul className="mt-2 space-y-2">
            {rows.map((row, index) => (
              <li key={row.key} className="flex items-start gap-2 text-sm">
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: colors[index] }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 break-words text-slate-500">{row.label}</span>
                <strong className="text-slate-800 tabular-nums">{row.count}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
