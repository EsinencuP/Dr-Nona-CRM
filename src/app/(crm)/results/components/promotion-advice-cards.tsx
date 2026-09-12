"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import type { ResultsData } from "../../../../../server/analytics/results-calculations";
import { amount, rate } from "./format";

const calendarDate = new Intl.DateTimeFormat("ru-MD", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Chisinau",
});

export function PromotionAdviceCards({ recommendations }: { recommendations: ResultsData["recommendations"] }) {
  return (
    <section aria-labelledby="promotion-heading" className="mt-6">
      <h2 id="promotion-heading" className="mb-3 font-bold text-xl">
        Советы по продвижению и мероприятиям
      </h2>
      <div className="grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <h3 className="font-bold">Мастер-классы</h3>
            <p className="text-muted-foreground text-xs">
              Высокая маржа в MDL и скорость не выше среднего по ассортименту.
            </p>
          </CardHeader>
          <CardContent>
            {recommendations.masterclass.length ? (
              <ul className="space-y-4">
                {recommendations.masterclass.map((sku) => (
                  <li key={sku.slug}>
                    <strong>{sku.name}</strong>
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
            {recommendations.volume.length ? (
              <ol className="space-y-4">
                {recommendations.volume.map((sku, index) => (
                  <li key={sku.slug}>
                    <strong>
                      {index + 1}. {sku.name}
                    </strong>
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
              {recommendations.seasonal.map((advice) => (
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
                  <p className="mt-1 text-xs">
                    {advice.productNames.slice(0, 3).join(", ")}
                    {advice.productNames.length > 3 ? ` и ещё ${advice.productNames.length - 3}` : ""}. Используйте
                    только утверждённые описания.
                  </p>
                </li>
              ))}
            </ul>
            {recommendations.seasonal.length === 0 && (
              <p className="text-muted-foreground">В каталоге нет товаров для сезонных правил.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
