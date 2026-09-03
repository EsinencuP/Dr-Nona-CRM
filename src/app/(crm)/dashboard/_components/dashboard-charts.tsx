"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DashboardStats } from "@/lib/crm-types";

const chartColors = ["#1768d4", "#16a394", "#f0a63a", "#ed6676", "#7b6de2"];

function orderLabel(value: number) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "заявок";
  if (last === 1) return "заявка";
  if (last >= 2 && last <= 4) return "заявки";
  return "заявок";
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-60 items-center justify-center rounded-xl border border-dashed bg-muted/45 px-5 text-center text-muted-foreground text-sm">
      {children}
    </div>
  );
}

export function OrdersTimeline({ data }: { data: DashboardStats["timeline"] }) {
  if (!data.some((point) => point.orders > 0)) return <EmptyChart>Динамика появится после новых заявок.</EmptyChart>;
  return (
    <div className="h-60 w-full" role="img" aria-label="График динамики заказов">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="orders-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            interval="preserveStartEnd"
            tick={{ fill: "var(--muted-foreground)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tick={{ fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              borderRadius: 12,
              borderColor: "var(--border)",
              boxShadow: "0 10px 28px rgb(34 67 103 / 0.12)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="orders"
            name="Заявки"
            stroke="var(--chart-1)"
            strokeWidth={3}
            fill="url(#orders-fill)"
            dot={{ r: 3, fill: "#ffffff", strokeWidth: 2 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RegionsChart({ data }: { data: DashboardStats["regions"] }) {
  if (data.length === 0) return <EmptyChart>География появится после первой заявки.</EmptyChart>;
  return (
    <div className="h-60 w-full" role="img" aria-label="Диаграмма заявок по регионам Молдовы">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
        <BarChart data={data.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tick={{ fill: "var(--muted-foreground)" }}
          />
          <YAxis
            type="category"
            dataKey="region"
            width={86}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            tick={{ fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              borderRadius: 12,
              borderColor: "var(--border)",
              boxShadow: "0 10px 28px rgb(34 67 103 / 0.12)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="orders" name="Заявки" fill="var(--chart-2)" radius={[0, 6, 6, 0]} barSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourcesChart({ data }: { data: DashboardStats["sources"] }) {
  if (data.length === 0 || !data.some((entry) => entry.orders > 0)) {
    return <EmptyChart>Источники появятся после первой заявки.</EmptyChart>;
  }
  const total = data.reduce((sum, entry) => sum + entry.orders, 0);
  const { segments } = data.reduce<{ cursor: number; segments: string[] }>(
    (result, entry, index) => {
      const end = result.cursor + (entry.orders / total) * 360;
      return {
        cursor: end,
        segments: [...result.segments, `${chartColors[index % chartColors.length]} ${result.cursor}deg ${end}deg`],
      };
    },
    { cursor: 0, segments: [] },
  );
  return (
    <div
      className="grid min-h-60 items-center gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]"
      role="img"
      aria-label="Диаграмма источников заявок"
    >
      <div
        className="relative mx-auto flex size-36 items-center justify-center rounded-full shadow-inner"
        style={{ backgroundImage: `conic-gradient(${segments.join(", ")})` }}
      >
        <div className="flex size-[5.5rem] flex-col items-center justify-center rounded-full bg-white shadow-sm">
          <strong className="text-2xl tabular-nums">{total}</strong>
          <span className="font-bold text-[0.65rem] text-muted-foreground uppercase">{orderLabel(total)}</span>
        </div>
      </div>
      <ul className="space-y-2.5 text-xs">
        {data.slice(0, 5).map((entry, index) => (
          <li key={entry.source} className="flex items-start gap-2">
            <span
              className="mt-1 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: chartColors[index % chartColors.length] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 break-words text-muted-foreground">{entry.source}</span>
            <strong>{entry.orders}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
