import Link from "next/link";

import { ArrowUpRight, CheckCircle2, Clock3, PackageCheck, Truck } from "lucide-react";
import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLei } from "@/lib/crm-labels";
import type { DashboardRange } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

import { getDashboardStats } from "../actions";
import { OrdersTimeline, RegionsChart, SourcesChart } from "./_components/dashboard-charts";

export const metadata: Metadata = { title: "Дашборд" };
export const dynamic = "force-dynamic";

const ranges: Array<{ value: DashboardRange; label: string }> = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "Месяц" },
  { value: "all", label: "Всё время" },
];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const requestedRange = (await searchParams).range;
  const range: DashboardRange = requestedRange === "7d" || requestedRange === "all" ? requestedRange : "30d";
  const stats = await getDashboardStats(range);
  const cards = [
    {
      label: "Всего заявок",
      value: stats.kpis.total,
      icon: PackageCheck,
      note: "За всё время",
      tone: "crm-kpi--blue",
    },
    {
      label: "В обработке",
      value: stats.kpis.processing,
      icon: Clock3,
      note: "Требуют внимания",
      tone: "crm-kpi--amber",
    },
    {
      label: "В доставке",
      value: stats.kpis.delivery,
      icon: Truck,
      note: "Активные отправки",
      tone: "crm-kpi--violet",
    },
    {
      label: "Выполнено",
      value: stats.kpis.done,
      icon: CheckCircle2,
      note: "Закрытые заявки",
      tone: "crm-kpi--emerald",
    },
  ];

  return (
    <div className="space-y-4">
      <section className="crm-command-band crm-enter p-5 md:p-6" aria-labelledby="dashboard-title">
        <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.95fr)_minmax(0,1.65fr)] xl:items-stretch">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <p className="font-extrabold text-[0.72rem] text-cyan-200 uppercase tracking-[0.14em]">
                Операционная сводка
              </p>
              <h1
                id="dashboard-title"
                className="mt-2 font-extrabold text-3xl leading-tight tracking-[-0.04em] md:text-4xl"
              >
                Дашборд и аналитика
              </h1>
              <p className="mt-2 max-w-xl text-blue-50/78 text-sm leading-6">
                Заявки, география, рекламные источники и востребованность продуктов в одном рабочем экране.
              </p>
            </div>
            <nav
              className="mt-5 inline-flex w-fit rounded-xl border border-white/15 bg-slate-950/16 p-1"
              aria-label="Период аналитики"
            >
              {ranges.map((option) => (
                <Link
                  key={option.value}
                  href={`/dashboard?range=${option.value}`}
                  aria-current={range === option.value ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-lg px-3 py-1.5 font-bold text-xs transition-colors",
                    range === option.value
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-blue-50/75 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {option.label}
                </Link>
              ))}
            </nav>
          </div>

          <ul
            className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4"
            aria-label="Ключевые показатели"
          >
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <li key={card.label} className={cn("crm-kpi p-3 min-[360px]:p-4", card.tone)}>
                  <div className="flex items-start justify-between gap-1.5 min-[360px]:gap-2">
                    <p className="min-w-0 pt-1 font-bold text-[0.65rem] text-muted-foreground leading-4 min-[360px]:text-xs">
                      {card.label}
                    </p>
                    <span className="crm-kpi__icon flex size-8 shrink-0 items-center justify-center rounded-lg min-[360px]:size-9 min-[360px]:rounded-xl">
                      <Icon className="size-4 min-[360px]:size-[1.1rem]" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-3 font-extrabold text-3xl tabular-nums tracking-[-0.04em]">{card.value}</p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground leading-4">{card.note}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <Card className="crm-panel gap-3 py-5">
          <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div>
              <CardTitle className="font-extrabold tracking-[-0.02em]">Динамика заказов</CardTitle>
              <p className="mt-1 text-muted-foreground text-xs">Новые записи за выбранный период</p>
            </div>
            <Link
              href="/orders"
              className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 font-bold text-primary text-xs transition-colors hover:bg-secondary md:min-h-9"
            >
              Все заявки
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            <OrdersTimeline data={stats.timeline} />
          </CardContent>
        </Card>
        <Card className="crm-panel gap-3 py-5">
          <CardHeader>
            <CardTitle className="font-extrabold tracking-[-0.02em]">География по Молдове</CardTitle>
            <p className="text-muted-foreground text-xs">Заявки по региону клиента</p>
          </CardHeader>
          <CardContent>
            <RegionsChart data={stats.regions} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
        <Card className="crm-panel gap-3 py-5">
          <CardHeader>
            <CardTitle className="font-extrabold tracking-[-0.02em]">Источники рекламы</CardTitle>
            <p className="text-muted-foreground text-xs">Распределение по UTM Source</p>
          </CardHeader>
          <CardContent>
            <SourcesChart data={stats.sources} />
          </CardContent>
        </Card>
        <Card className="crm-panel gap-3 py-5">
          <CardHeader className="grid-cols-1 items-start gap-3 min-[360px]:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <CardTitle className="font-extrabold tracking-[-0.02em]">Популярность товаров</CardTitle>
              <p className="mt-1 text-muted-foreground text-xs">Топ-10 по суммарному количеству</p>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-accent px-3 py-2 text-right">
              <p className="font-bold text-[0.64rem] text-accent-foreground uppercase tracking-[0.08em]">
                Выполнено по ценам
              </p>
              <p className="font-extrabold text-accent-foreground text-sm">{formatLei(stats.completedTurnover)}</p>
            </div>
          </CardHeader>
          <CardContent>
            {stats.products.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Продукт</TableHead>
                    <TableHead className="text-right">Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.products.map((product) => (
                    <TableRow key={product.slug}>
                      <TableCell className="max-w-80 truncate font-semibold">{product.name}</TableCell>
                      <TableCell className="text-right font-extrabold tabular-nums">{product.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex min-h-52 items-center justify-center rounded-xl bg-muted/55 px-5 text-center text-muted-foreground text-sm">
                Популярность появится после заявок с товарами.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
