import Link from "next/link";

import type { Metadata } from "next";

import { parseResultsPeriod } from "../../../../server/analytics/results-calculations";
import { getResultsData } from "../../../../server/analytics/results-service";
import { ExportDialog } from "../_components/export-dialog";
import { PageHeader } from "../_components/page-header";
import { KpiGrid } from "./components/kpi-grid";
import { LogisticsForecastTable } from "./components/logistics-forecast-table";
import { OperationalIntelligence } from "./components/operational-intelligence";
import { PeriodFilter } from "./components/period-filter";
import { PromotionAdviceCards } from "./components/promotion-advice-cards";
import { RegionDistributionCard } from "./components/region-distribution-card";

export const metadata: Metadata = { title: "Результаты — продажи и поставки", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const date = new Intl.DateTimeFormat("ru-MD", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Chisinau" });

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ period?: string | string[] }> }) {
  const period = parseResultsPeriod((await searchParams).period);
  const data = await getResultsData(period);
  const incomplete =
    data.current.missingRetail + data.current.missingCost + data.previous.missingRetail + data.previous.missingCost > 0;
  return (
    <>
      <PageHeader
        eyebrow="Продажи · продвижение · логистика"
        title="Результаты"
        description="Завершённые товарные заказы, фиксированные цены и планирование поставок. Сравнение с предыдущим равным периодом."
      />
      <div className="mb-4">
        <ExportDialog initialReport="products" />
      </div>
      <PeriodFilter period={period} />
      {data.demoOrdersInComparison > 0 && (
        <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 text-sm">
          <strong>В сравнении есть демонстрационные заказы.</strong> {data.demoOrdersInComparison} записей созданы
          тестовым seed и включены в показанные расчёты. Эти показатели не подтверждают реальные продажи или спрос.
        </div>
      )}
      <p className="mb-4 text-muted-foreground text-xs">
        {date.format(new Date(data.start))} — {date.format(new Date(data.end))} · Кишинёв · Завершённых заказов:{" "}
        {data.current.orders}
      </p>
      {incomplete && (
        <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 text-sm">
          <strong>Денежные показатели доступны не полностью.</strong>
          <p className="mt-1">
            Заказы без розничного снимка: {data.current.missingRetail} сейчас / {data.previous.missingRetail} ранее. Без
            закупочного: {data.current.missingCost} / {data.previous.missingCost}. Продажи в штуках учтены.{" "}
            <Link href="/catalog" className="font-bold underline">
              Заполните утверждённые цены
            </Link>{" "}
            для будущих заказов. Исторические данные требуют документального подтверждения.
          </p>
        </div>
      )}
      {data.current.orders === 0 && (
        <p className="mb-4 rounded-xl border bg-white p-4 text-sm">
          За выбранный период завершённых товарных заказов нет. Выберите другой период; прогноз использует последние 90
          дней.
        </p>
      )}
      <KpiGrid kpis={data.kpis} />
      <details className="mt-4 rounded-xl border bg-white p-4 text-sm leading-6">
        <summary className="cursor-pointer font-semibold">Как рассчитаны показатели и прогноз</summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p>
            Учитываются заявки типа «заказ» со статусом DONE по дате создания, поскольку дата завершения отдельно не
            хранится. Начало включено, конец исключён. Прошлый период: {date.format(new Date(data.previousStart))} —{" "}
            {date.format(new Date(data.start))}.
          </p>
          <p>
            Доход и закупка берутся из снимков цен заказа. «Чистая прибыль» здесь — доход минус закупка; доставка,
            налоги и прочие расходы не включены. Нулевые снимки означают отсутствие данных. Процент при нулевой базе
            обозначен «—».
          </p>
          <p>
            Скорость: 50% продаж последних 30 дней + 30% предшествующих 30 дней + 20% самых ранних 30 дней. Рост
            сравнивает два последних окна по 30 дней и ограничен диапазоном −50%…+50%; при нулевой базе рост равен 0.
          </p>
          <p>
            Прогноз месяца N = скорость × (1 + рост)ᴺ, округление вверх. Месяцы 1, 2, 3 — отдельные последовательные
            окна по 30 дней, не накопительный итог. Заказ = прогноз месяца 1 × 1,15 с округлением вверх.
          </p>
          <p>
            Короткая история, возвраты и изменения статусов могут искажать оценку. Модель не хранит складские остатки и
            поставки в пути; итоговую закупку подтверждает менеджер. Цены не пересчитываются и не рекомендуются к
            изменению.
          </p>
        </div>
      </details>
      <PromotionAdviceCards recommendations={data.recommendations} />
      <LogisticsForecastTable skus={data.skus} />
      <RegionDistributionCard regions={data.regions} />
      <OperationalIntelligence data={data.operations} />
    </>
  );
}
