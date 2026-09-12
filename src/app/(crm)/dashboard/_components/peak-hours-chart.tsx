"use client";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from "recharts";

import type { DashboardStats } from "@/lib/crm-types";

import { ChartCard, EmptyChart } from "./chart-card";
export function PeakHoursChart({ data }: { data: DashboardStats["peakHours"] }) {
  const max = Math.max(...data.map((row) => row.count));
  const peaks = data.filter((row) => row.count === max && max > 0);
  return (
    <ChartCard title="Пик активности" description="Часы приёма заявок · Europe/Chisinau">
      <p className="sr-only">{data.map((row) => `${row.hour}:00 — ${row.count} заявок`).join("; ")}</p>
      {max ? (
        <>
          <p className="mt-6 font-extrabold text-2xl text-slate-800">
            {peaks
              .slice(0, 3)
              .map((row) => `${row.hour}:00`)
              .join(", ")}
            {peaks.length > 3 ? "…" : ""}
          </p>
          <p className="mt-1 mb-6 text-slate-500 text-xs">Максимум: {max} заявок за час</p>
          <div className="h-[90px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 90 }}>
              <BarChart data={data} accessibilityLayer>
                <Tooltip
                  labelFormatter={(_, payload) => `${payload[0]?.payload.hour ?? 0}:00`}
                  formatter={(value) => [`${value} заявок`, "Количество"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {data.map((row) => (
                    <Cell
                      key={row.hour}
                      fill={
                        (row.hour >= 9 && row.hour <= 12) || (row.hour >= 17 && row.hour <= 21) ? "#3B82F6" : "#E2E8F0"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-between text-slate-500 text-xs">
            <span>00:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
          <p className="mt-3 text-slate-500 text-xs leading-5">
            Синим — 09–12 и 17–21; пик выше рассчитан по фактическим заявкам.
          </p>
        </>
      ) : (
        <EmptyChart />
      )}
    </ChartCard>
  );
}
