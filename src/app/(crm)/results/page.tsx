import type { Metadata } from "next";

import { parseResultsPeriod } from "../../../../server/analytics/results-calculations";
import { getResultsData } from "../../../../server/analytics/results-service";
import { PageHeader } from "../_components/page-header";
import { ForecastResultsSection, PromotionResultsSection, SalesResultsSection } from "./components/results-sections";
import { ResultsTabs } from "./components/results-tabs";
import { parseResultsView } from "./results-view";

export const metadata: Metadata = { title: "Результаты — продажи и поставки", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[]; view?: string | string[] }>;
}) {
  const params = await searchParams;
  const period = parseResultsPeriod(params.period);
  const view = parseResultsView(params.view);
  const data = await getResultsData(period);
  return (
    <>
      <PageHeader
        eyebrow="Продажи · продвижение · логистика"
        title="Результаты"
        description="Продажи, прогноз спроса и аналитические рекомендации разделены по рабочим задачам без изменения расчётов."
      />
      <ResultsTabs view={view} />
      {view === "sales" ? <SalesResultsSection data={data} /> : null}
      {view === "forecast" ? <ForecastResultsSection data={data} /> : null}
      {view === "promotion" ? <PromotionResultsSection data={data} /> : null}
    </>
  );
}
