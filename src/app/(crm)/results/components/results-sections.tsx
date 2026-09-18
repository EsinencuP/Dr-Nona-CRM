import Link from "next/link";

import type { getResultsData } from "../../../../../server/analytics/results-service";
import { ExportDialog } from "../../_components/export-dialog";
import { KpiGrid } from "./kpi-grid";
import { LogisticsForecastTable } from "./logistics-forecast-table";
import { OperationalIntelligence } from "./operational-intelligence";
import { PeriodFilter } from "./period-filter";
import { PromotionAdviceCards } from "./promotion-advice-cards";
import { RegionDistributionCard } from "./region-distribution-card";

type ResultsPageData = Awaited<ReturnType<typeof getResultsData>>;

const date = new Intl.DateTimeFormat("ru-MD", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Chisinau",
});

function DemoNotice({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div role="status" className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 text-sm">
      <strong>В сравнении есть демонстрационные заказы.</strong> {count} записей созданы тестовым seed и включены в
      показанные расчёты. Эти показатели не подтверждают реальные продажи или спрос.
    </div>
  );
}

function IncompletePriceNotice({ data }: { data: ResultsPageData }) {
  const incomplete =
    data.current.missingRetail + data.current.missingCost + data.previous.missingRetail + data.previous.missingCost > 0;
  if (!incomplete) return null;
  return (
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
  );
}

export function SalesResultsSection({ data }: { data: ResultsPageData }) {
  return (
    <section id="results-panel-sales" role="tabpanel" aria-labelledby="results-tab-sales">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-bold text-xl">Продажи за выбранный период</h2>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            Финансовый итог, география продаж и обработка товарных заявок. Сравнение выполняется с предыдущим равным
            периодом.
          </p>
        </div>
        <ExportDialog initialReport="products" contextLabel="Продажи за выбранный период" />
      </div>
      <PeriodFilter period={data.period} />
      <DemoNotice count={data.demoOrdersInComparison} />
      <p className="mb-4 text-muted-foreground text-xs">
        {date.format(new Date(data.start))} — {date.format(new Date(data.end))} · Кишинёв · Завершённых заказов:{" "}
        {data.current.orders}
      </p>
      <IncompletePriceNotice data={data} />
      {data.current.orders === 0 ? (
        <p className="mb-4 rounded-xl border bg-white p-4 text-sm">
          За выбранный период завершённых товарных заказов нет. Выберите другой период.
        </p>
      ) : null}
      <KpiGrid kpis={data.kpis} />
      <RegionDistributionCard regions={data.regions} />
      <OperationalIntelligence data={data.operations} />
      <details className="mt-5 rounded-xl border bg-white p-4 text-sm leading-6">
        <summary className="cursor-pointer font-semibold">Как рассчитаны показатели продаж</summary>
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
        </div>
      </details>
    </section>
  );
}

export function ForecastResultsSection({ data }: { data: ResultsPageData }) {
  return (
    <section id="results-panel-forecast" role="tabpanel" aria-labelledby="results-tab-forecast">
      <div role="note" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 text-sm">
        <strong>Это оценка будущего спроса, а не подтверждённая потребность склада.</strong>
        <p className="mt-1">
          Расчёт обновлён {date.format(new Date(data.end))} и всегда использует последние 90 дней. Остатки, поставки в
          пути, возвраты и сроки поставщика модель не хранит; итоговый объём подтверждает менеджер.
        </p>
      </div>
      <LogisticsForecastTable skus={data.skus} />
      <details className="mt-5 rounded-xl border bg-white p-4 text-sm leading-6">
        <summary className="cursor-pointer font-semibold">Методика 90-дневного прогноза</summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p>
            Скорость: 50% продаж последних 30 дней + 30% предшествующих 30 дней + 20% самых ранних 30 дней. Рост
            сравнивает два последних окна и ограничен диапазоном −50%…+50%; при нулевой базе рост равен 0.
          </p>
          <p>
            Прогноз месяца N = скорость × (1 + рост)ᴺ, округление вверх. Месяцы 1, 2, 3 — отдельные последовательные
            окна по 30 дней, не накопительный итог. Рекомендация заказа = прогноз месяца 1 × 1,15 с округлением вверх.
          </p>
        </div>
      </details>
    </section>
  );
}

export function PromotionResultsSection({ data }: { data: ResultsPageData }) {
  return (
    <section id="results-panel-promotion" role="tabpanel" aria-labelledby="results-tab-promotion">
      <p className="mb-4 max-w-3xl text-muted-foreground text-sm">
        Аналитические подсказки для планирования. Это не утверждённые кампании, скидки или публичные маркетинговые
        заявления. Лидеры объёма и мастер-классы зависят от выбранного периода.
      </p>
      <PeriodFilter period={data.period} />
      <DemoNotice count={data.demoOrdersInComparison} />
      <PromotionAdviceCards recommendations={data.recommendations} skus={data.skus} />
    </section>
  );
}
