"use client";

import { useState } from "react";

import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import type { ResultsData } from "../../../../../server/analytics/results-calculations";
import { amount, rate } from "./format";
import { filterPromotionRecommendations, promotionCategories } from "./promotion-filter";

const calendarDate = new Intl.DateTimeFormat("ru-MD", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Chisinau",
});

function catalogHref(name: string) {
  return `/catalog?${new URLSearchParams({ search: name }).toString()}`;
}

export function PromotionAdviceCards({
  recommendations,
  skus,
}: {
  recommendations: ResultsData["recommendations"];
  skus: ResultsData["skus"];
}) {
  const [category, setCategory] = useState("");
  const categories = promotionCategories(skus);
  const { masterclass, volume, seasonal } = filterPromotionRecommendations(recommendations, skus, category);

  return (
    <section aria-labelledby="promotion-heading" className="mt-6">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="promotion-heading" className="font-bold text-xl">
            Советы по продвижению и мероприятиям
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Каждая товарная рекомендация ведёт к существующей записи каталога.
          </p>
        </div>
        <label htmlFor="promotion-category" className="grid gap-1 font-semibold text-xs">
          Категория товаров
          <NativeSelect
            id="promotion-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full sm:w-64"
          >
            <NativeSelectOption value="">Все категории</NativeSelectOption>
            {categories.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <h3 className="font-bold">Мастер-классы</h3>
            <p className="text-muted-foreground text-xs">
              Высокая маржа в MDL и скорость не выше среднего по ассортименту.
            </p>
          </CardHeader>
          <CardContent>
            {masterclass.length ? (
              <ul className="space-y-4">
                {masterclass.map((sku) => (
                  <li key={sku.slug}>
                    <Link href={catalogHref(sku.name)} className="font-bold underline-offset-4 hover:underline">
                      {sku.name}
                    </Link>
                    <p className="mt-1 text-muted-foreground text-xs">
                      Маржа: {amount(sku.margin, true)} · {rate(sku.velocity)} шт./мес.
                    </p>
                    <p className="mt-1 text-xs">
                      Включите в демонстрацию или тематический набор по утверждённым ценам.
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Нет подходящих товаров с двумя утверждёнными ценами.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="font-bold">Драйверы объёма</h3>
            <p className="text-muted-foreground text-xs">Три лидера продаж за выбранный период.</p>
          </CardHeader>
          <CardContent>
            {volume.length ? (
              <ol className="space-y-4">
                {volume.map((sku, index) => (
                  <li key={sku.slug}>
                    <Link href={catalogHref(sku.name)} className="font-bold underline-offset-4 hover:underline">
                      {index + 1}. {sku.name}
                    </Link>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {amount(sku.units)} · Проверьте остаток и срок следующей поставки.
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground">Завершённых продаж за этот период нет.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="font-bold">Сезонный календарь</h3>
            <p className="text-muted-foreground text-xs">
              Планирование за 30–45 дней. Гипотезы менеджера, не доказанная сезонность продаж.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {seasonal.map((advice) => (
                <li key={advice.id}>
                  <strong>{advice.label}</strong>
                  {advice.due && (
                    <span className="ml-2 rounded bg-amber-50 px-1.5 py-1 font-semibold text-amber-900 text-xs">
                      Пора планировать
                    </span>
                  )}
                  <p className="mt-1 text-muted-foreground text-xs">
                    Подготовка: {calendarDate.format(new Date(advice.prepareFrom))} —{" "}
                    {calendarDate.format(new Date(advice.prepareTo))}. Сезон с{" "}
                    {calendarDate.format(new Date(advice.target))}.
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                    {advice.productNames.slice(0, 3).map((name) => (
                      <li key={name}>
                        <Link href={catalogHref(name)} className="underline-offset-4 hover:underline">
                          {name}
                        </Link>
                      </li>
                    ))}
                    {advice.productNames.length > 3 ? <li>и ещё {advice.productNames.length - 3}</li> : null}
                  </ul>
                  <p className="mt-1 text-xs">Используйте только утверждённые описания.</p>
                </li>
              ))}
            </ul>
            {seasonal.length === 0 ? (
              <p className="text-muted-foreground">Для выбранной категории сезонных рекомендаций нет.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {masterclass.length === 0 && volume.length === 0 && seasonal.length === 0 ? (
        <p role="status" className="mt-3 rounded-xl border bg-white p-4 text-muted-foreground text-sm">
          Для выбранной категории рекомендаций нет. Выберите другую категорию или покажите весь каталог.
        </p>
      ) : null}
    </section>
  );
}
