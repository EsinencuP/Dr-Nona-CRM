"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import type { ResultsData } from "../../../../../server/analytics/results-calculations";
import { amount, rate } from "./format";
import { ScrollTable } from "./scroll-table";

export function RegionDistributionCard({ regions }: { regions: ResultsData["regions"] }) {
  return (
    <Card className="mt-5">
      <CardHeader>
        <h2 className="font-bold text-xl">Топ регионов Молдовы</h2>
        <p className="text-muted-foreground">По количеству проданных единиц. Регион из текущей карточки клиента.</p>
      </CardHeader>
      <CardContent>
        <ScrollTable label="Распределение по регионам" vertical>
          <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
            <thead className="sticky top-[61px] bg-slate-50 text-xs">
              <tr>
                {["Регион", "Продано", "Доля", "Заказы", "Доход"].map((label) => (
                  <th key={label} scope="col" className="px-3 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {regions.map((region) => (
                <tr key={region.name}>
                  <th scope="row" className="px-3 py-3 font-medium">
                    {region.name}
                  </th>
                  <td className="px-3 py-3">{amount(region.units)}</td>
                  <td className="px-3 py-3">{rate(region.share)}%</td>
                  <td className="px-3 py-3">{region.orders}</td>
                  <td className="whitespace-nowrap px-3 py-3">{amount(region.revenue, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      </CardContent>
    </Card>
  );
}
