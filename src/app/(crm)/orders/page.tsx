import Link from "next/link";

import { Search } from "lucide-react";
import type { Metadata } from "next";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { statusLabels, typeLabels } from "@/lib/crm-labels";
import { ORDER_STATUSES, ORDER_TYPES } from "@/lib/crm-types";
import { cn } from "@/lib/utils";

import { PageHeader } from "../_components/page-header";
import { getOrderRegions, getOrders } from "../actions";
import { OrdersTable } from "./_components/orders-table";

export const metadata: Metadata = { title: "Заказы и заявки" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function buildPageHref(params: SearchParams, changes: Record<string, string | number | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) next.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `/orders?${query}` : "/orders";
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = {
    status: stringParam(params.status),
    type: stringParam(params.type),
    region: stringParam(params.region),
    search: stringParam(params.search),
    from: stringParam(params.from),
    to: stringParam(params.to),
    page: Number(stringParam(params.page)) || 1,
  };
  const [result, regions] = await Promise.all([getOrders(filters), getOrderRegions()]);

  return (
    <>
      <PageHeader
        eyebrow="Рабочая очередь"
        title="Заказы и заявки"
        description="Поиск, фильтрация, полная карточка клиента и изменение статуса без перехода между экранами."
      >
        <div className="rounded-xl border bg-white px-4 py-2 text-right">
          <p className="text-muted-foreground text-xs">Найдено</p>
          <p className="font-extrabold text-xl tabular-nums">{result.total}</p>
        </div>
      </PageHeader>

      <nav className="mb-3 flex gap-1 overflow-x-auto rounded-xl border bg-white p-1" aria-label="Фильтр по статусу">
        <Link
          href={buildPageHref(params, { status: undefined, page: 1 })}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 font-bold text-xs md:min-h-8",
            !filters.status ? "bg-primary text-white" : "hover:bg-muted",
          )}
        >
          Все
        </Link>
        {ORDER_STATUSES.map((status) => (
          <Link
            key={status}
            href={buildPageHref(params, { status, page: 1 })}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 font-bold text-xs md:min-h-8",
              filters.status === status ? "bg-primary text-white" : "hover:bg-muted",
            )}
          >
            {statusLabels[status]}
          </Link>
        ))}
      </nav>

      <form
        className="mb-4 grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-2 xl:grid-cols-[minmax(13rem,1.6fr)_1fr_1fr_0.8fr_0.8fr_auto]"
        action="/orders"
      >
        <label className="relative" htmlFor="orders-search">
          <span className="sr-only">Поиск заявки</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="orders-search"
            name="search"
            defaultValue={filters.search}
            placeholder="Имя, телефон или ID"
            className="pl-8"
          />
        </label>
        <label htmlFor="orders-type">
          <span className="sr-only">Тип заявки</span>
          <NativeSelect id="orders-type" name="type" defaultValue={filters.type} className="w-full">
            <NativeSelectOption value="">Все типы</NativeSelectOption>
            {ORDER_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {typeLabels[type]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label htmlFor="orders-region">
          <span className="sr-only">Регион</span>
          <NativeSelect id="orders-region" name="region" defaultValue={filters.region} className="w-full">
            <NativeSelectOption value="">Все регионы</NativeSelectOption>
            {regions.map((region) => (
              <NativeSelectOption key={region} value={region}>
                {region}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label htmlFor="orders-from">
          <span className="sr-only">Дата с</span>
          <Input id="orders-from" type="date" name="from" defaultValue={filters.from} title="Дата с" />
        </label>
        <label htmlFor="orders-to">
          <span className="sr-only">Дата по</span>
          <Input id="orders-to" type="date" name="to" defaultValue={filters.to} title="Дата по" />
        </label>
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        <Button type="submit">Применить</Button>
      </form>

      <OrdersTable result={result} />

      {result.pages > 1 ? (
        <nav
          className="mt-4 flex items-center justify-between rounded-xl border bg-white p-3 text-sm"
          aria-label="Пагинация заявок"
        >
          {result.page > 1 ? (
            <Link
              href={buildPageHref(params, { page: result.page - 1 })}
              className={buttonVariants({ variant: "outline", size: "lg", className: "min-h-11 md:min-h-9" })}
            >
              Назад
            </Link>
          ) : (
            <Button variant="outline" size="lg" disabled>
              Назад
            </Button>
          )}
          <span className="font-bold">
            Страница {result.page} из {result.pages}
          </span>
          {result.page < result.pages ? (
            <Link
              href={buildPageHref(params, { page: result.page + 1 })}
              className={buttonVariants({ variant: "outline", size: "lg", className: "min-h-11 md:min-h-9" })}
            >
              Вперёд
            </Link>
          ) : (
            <Button variant="outline" size="lg" disabled>
              Вперёд
            </Button>
          )}
        </nav>
      ) : null}
    </>
  );
}
