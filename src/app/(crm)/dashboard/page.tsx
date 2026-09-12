import { CheckCircle2, Clock3, Inbox, Package, TrendingUp, Truck, UserPlus, XCircle } from "lucide-react";
import type { Metadata } from "next";

import { getDashboardStats } from "../actions";
import { ChartCard } from "./_components/chart-card";
import { dashboardRanges, normalizeRange } from "./_components/dashboard-data";
import { dashboardMoney, dashboardNumber } from "./_components/dashboard-format";
import { DashboardHeader } from "./_components/dashboard-header";
import { KpiCard } from "./_components/kpi-card";
import { OrdersRevenueChart } from "./_components/orders-revenue-chart";
import { PeakHoursChart } from "./_components/peak-hours-chart";
import { RecentOrdersFeed } from "./_components/recent-orders-feed";
import { RegionsChart } from "./_components/regions-chart";
import { SourcesDonutChart } from "./_components/sources-donut-chart";
import { StatusPill } from "./_components/status-pill";
import { TopProductsTable } from "./_components/top-products-table";
import styles from "./dashboard.module.css";
export const metadata: Metadata = { title: "Дашборд — операционная сводка", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const range = normalizeRange((await searchParams).range);
  const stats = await getDashboardStats(range);
  const period = dashboardRanges.find((option) => option.value === range)?.label ?? "Месяц";
  const incomplete =
    stats.quality.missingRetail +
      stats.quality.missingCost +
      stats.quality.previousMissingRetail +
      stats.quality.previousMissingCost >
    0;
  return (
    <div className={`${styles.dashboard} -m-4 space-y-5 bg-slate-50 px-4 py-5 md:-m-6 md:px-6 xl:-m-7 xl:px-7`}>
      <DashboardHeader range={range} asOf={stats.asOf} />
      <div id="dashboard-panel" role="tabpanel" aria-labelledby={`range-${range}`} className="space-y-5">
        {incomplete && (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-4 text-slate-500 text-sm leading-6">
            Цены для некоторых товаров не заданы — выручка может быть занижена. Без розничных снимков:{" "}
            {stats.quality.missingRetail} заказов сейчас / {stats.quality.previousMissingRetail} ранее; без закупочных:{" "}
            {stats.quality.missingCost} / {stats.quality.previousMissingCost}. Денежные суммы частичные, финансовое
            сравнение отключено.
          </p>
        )}
        <section
          aria-label="Ключевые показатели"
          className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            title="Выручка"
            metric={stats.kpis.revenue}
            icon={TrendingUp}
            tone="bg-emerald-50 text-emerald-500"
            money
            comparison={range !== "all"}
          />
          <KpiCard
            title="Заявок принято"
            metric={stats.kpis.total}
            icon={CheckCircle2}
            tone="bg-blue-50 text-blue-500"
            comparison={range !== "all"}
          />
          <KpiCard
            title="Продано штук"
            metric={stats.kpis.unitsSold}
            icon={Package}
            tone="bg-violet-50 text-violet-500"
            comparison={range !== "all"}
          />
          <KpiCard
            title="Новые клиенты"
            metric={stats.kpis.newClients}
            icon={UserPlus}
            tone="bg-amber-50 text-amber-500"
            comparison={range !== "all"}
          />
        </section>
        <section aria-label="Текущие статусы всех заявок">
          <h2 className="mb-2 font-medium text-slate-500 text-xs">
            Операционные статусы · все заявки на момент загрузки
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatusPill title="Новые" count={stats.kpis.new} status="NEW" icon={Inbox} tone="text-slate-500" />
            <StatusPill
              title="В обработке"
              count={stats.kpis.processing}
              status="PROCESSING"
              icon={Clock3}
              tone="text-amber-500"
            />
            <StatusPill
              title="В доставке"
              count={stats.kpis.delivery}
              status="DELIVERY"
              icon={Truck}
              tone="text-violet-500"
            />
            <StatusPill
              title="Отменены"
              count={stats.kpis.cancelledNow}
              status="CANCELLED"
              icon={XCircle}
              tone="text-rose-500"
            />
          </div>
        </section>
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <OrdersRevenueChart data={stats.timeline} />
          </div>
          <TopProductsTable products={stats.topProducts} period={period} />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
          <RegionsChart data={stats.regionOrders} />
          <SourcesDonutChart data={stats.utmSources} />
          <PeakHoursChart data={stats.peakHours} />
        </div>
        <ChartCard
          title="Итоги периода"
          description="Все заявки — для конверсии; завершённые товарные заказы — для денежных показателей."
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Выполнено заявок", dashboardNumber(stats.kpis.done.value)],
              ["Доля выполненных", `${dashboardNumber(stats.kpis.conversionRate.value)}%`],
              ["Средний чек", dashboardMoney(stats.kpis.aov.value)],
              ["Доход минус закупка", dashboardMoney(stats.kpis.profit.value)],
              ["Отменённые продажи", dashboardMoney(stats.lostRevenue)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500 text-xs">{label}</dt>
                <dd className="mt-1 break-words font-bold text-lg text-slate-800 tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-slate-500 text-xs leading-5">
            Прибыль не включает доставку, налоги и другие расходы. Отменённые продажи — стоимость товарных заявок со
            статусом CANCELLED, без вычитания из полученной выручки.
            {stats.quality.cancelledMissingRetail > 0
              ? ` Неизвестны цены в ${stats.quality.cancelledMissingRetail} отменённых заказах.`
              : ""}
          </p>
        </ChartCard>
        <RecentOrdersFeed orders={stats.recentOrders} asOf={stats.asOf} />
        <p className="text-slate-500 text-xs leading-5">
          Периоды — скользящие 7, 30 или 90 суток с равным предыдущим окном. Дни и часы графиков — по Кишинёву. Заявки
          отнесены к дате создания, статус — текущий; даты завершения отдельно нет. «Всё время» не имеет предыдущего
          периода. Обновите страницу для свежих операционных статусов.
        </p>
      </div>
    </div>
  );
}
