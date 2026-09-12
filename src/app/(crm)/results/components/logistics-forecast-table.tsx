"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { ResultsData } from "../../../../../server/analytics/results-calculations";
import { amount, percent, rate } from "./format";
import { ScrollTable } from "./scroll-table";

export function LogisticsForecastTable({ skus }: { skus: ResultsData["skus"] }) {
  const [search, setSearch] = useState("");
  const rows = skus.filter((sku) =>
    `${sku.name} ${sku.sku} ${sku.slug}`.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")),
  );
  return (
    <Card className="mt-5 min-w-0">
      <CardHeader>
        <h2 className="font-bold text-xl">Прогноз поставок и логистика</h2>
        <p className="text-muted-foreground">
          Оценка спроса, шт. Заказ включает резерв 15%; вычтите доступный остаток и поставки в пути перед закупкой.
        </p>
        <label htmlFor="sku-search" className="mt-3 font-medium text-xs">
          Поиск по товару или SKU
        </label>
        <Input
          id="sku-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Название или SKU"
          className="max-w-sm"
        />
      </CardHeader>
      <CardContent>
        <ScrollTable label="Прогноз по товарам, таблица с горизонтальной прокруткой">
          <table className="w-full min-w-[960px] text-left text-sm tabular-nums">
            <caption className="sr-only">
              Продажи, месячная скорость и прогноз на три месяца. На узком экране прокрутите таблицу вправо.
            </caption>
            <thead className="border-b bg-slate-50 text-muted-foreground text-xs">
              <tr>
                {[
                  "Товар / SKU",
                  "Продано",
                  "К прошлому периоду",
                  "За 30 дней, тренд",
                  "Скорость, шт./мес.",
                  "Месяц 1",
                  "Месяц 2",
                  "Месяц 3",
                  "Заказ +15%",
                ].map((title) => (
                  <th key={title} scope="col" className="px-3 py-3 font-semibold">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((sku) => (
                <tr key={sku.slug} className="hover:bg-slate-50/70">
                  <th scope="row" className="min-w-52 max-w-72 px-3 py-4 font-medium">
                    <span className="block">{sku.name}</span>
                    <span className="mt-1 block font-mono text-muted-foreground text-xs">{sku.sku}</span>
                  </th>
                  <td className="px-3 py-4 font-bold">{amount(sku.units)}</td>
                  <td className="px-3 py-4">{percent(sku.trend.percent)}</td>
                  <td className="px-3 py-4">{percent(sku.monthlyTrend.percent)}</td>
                  <td className="px-3 py-4">{rate(sku.velocity)}</td>
                  {[1, 2, 3].map((month) => (
                    <td key={month} className="px-3 py-4">
                      {amount(sku.months[month - 1] ?? 0)}
                    </td>
                  ))}
                  <td className="bg-blue-50/50 px-3 py-4 font-bold text-blue-900">{amount(sku.reorder)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-5">Товары не найдены. Измените поисковый запрос.</p>}
        </ScrollTable>
        <p className="mt-3 text-muted-foreground text-xs">
          Все товары: {skus.length}. Нулевой прогноз означает отсутствие зарегистрированного спроса, а не рекомендацию
          прекратить поставки.
        </p>
      </CardContent>
    </Card>
  );
}
