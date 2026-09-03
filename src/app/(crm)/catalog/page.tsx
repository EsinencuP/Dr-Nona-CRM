import Link from "next/link";

import { Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatDate, formatLei } from "@/lib/crm-labels";

import { PageHeader } from "../_components/page-header";
import { getCatalogProducts } from "../actions";
import { PriceForm } from "./_components/price-form";

export const metadata: Metadata = { title: "Каталог и цены" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; page?: string }>;
}) {
  const { search = "", category = "", page = "1" } = await searchParams;
  const catalog = await getCatalogProducts();
  const categories = [...new Set(catalog.map((product) => product.category))].sort((left, right) =>
    left.localeCompare(right, "ru"),
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("ru");
  const filtered = catalog.filter((product) => {
    const matchesCategory = !category || product.category === category;
    const matchesSearch =
      !normalizedSearch ||
      `${product.name} ${product.sku} ${product.slug}`.toLocaleLowerCase("ru").includes(normalizedSearch);
    return matchesCategory && matchesSearch;
  });
  const pageSize = 15;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const requestedPage = Number.parseInt(page, 10);
  const currentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), pages) : 1;
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const configured = catalog.filter((product) => product.internalPrice > 0).length;

  function pageHref(nextPage: number) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    params.set("page", String(nextPage));
    return `/catalog?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        eyebrow="Внутренний финансовый учёт"
        title="Каталог и цены"
        description="Единый перечень опубликованных товаров. Значения используются только в CRM и никогда не показываются на публичном сайте."
      >
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-950">
          <ShieldCheck className="size-5" aria-hidden="true" />
          <div>
            <p className="font-bold text-xs">Цены настроены</p>
            <p className="font-extrabold text-sm">
              {configured} из {catalog.length}
            </p>
          </div>
        </div>
      </PageHeader>

      <form
        action="/catalog"
        className="mb-4 grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[minmax(14rem,1fr)_15rem_auto]"
      >
        <label className="relative" htmlFor="catalog-search">
          <span className="sr-only">Поиск товара</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="catalog-search"
            name="search"
            defaultValue={search}
            placeholder="Название, SKU или slug"
            className="pl-8"
          />
        </label>
        <label htmlFor="catalog-category">
          <span className="sr-only">Категория</span>
          <NativeSelect id="catalog-category" name="category" defaultValue={category} className="w-full">
            <NativeSelectOption value="">Все категории</NativeSelectOption>
            {categories.map((item) => (
              <NativeSelectOption key={item} value={item}>
                {item}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <Button type="submit">Применить</Button>
      </form>

      <section className="crm-panel overflow-hidden rounded-xl border bg-white" aria-label="Товары и внутренние цены">
        <div className="hidden grid-cols-[minmax(14rem,1.6fr)_7rem_9rem_9rem_minmax(16rem,1fr)] gap-3 border-b bg-slate-50/80 px-4 py-3 font-bold text-muted-foreground text-xs lg:grid">
          <span>Товар</span>
          <span>SKU</span>
          <span>Категория</span>
          <span>Текущая цена</span>
          <span>Редактирование, MDL</span>
        </div>
        <ul className="divide-y">
          {visible.map((product) => (
            <li
              key={product.slug}
              className="grid gap-3 p-4 lg:grid-cols-[minmax(14rem,1.6fr)_7rem_9rem_9rem_minmax(16rem,1fr)] lg:items-center"
            >
              <div className="min-w-0">
                <strong className="block truncate text-sm">{product.name}</strong>
                <span className="mt-0.5 block truncate text-muted-foreground text-xs">{product.slug}</span>
              </div>
              <dl className="grid grid-cols-3 gap-2 lg:contents">
                <div className="min-w-0 rounded-lg bg-muted/55 p-2 lg:rounded-none lg:bg-transparent lg:p-0">
                  <dt className="font-bold text-[0.65rem] text-muted-foreground uppercase lg:hidden">SKU</dt>
                  <dd className="mt-1 truncate font-mono text-xs lg:mt-0">{product.sku}</dd>
                </div>
                <div className="min-w-0 rounded-lg bg-muted/55 p-2 lg:rounded-none lg:bg-transparent lg:p-0">
                  <dt className="font-bold text-[0.65rem] text-muted-foreground uppercase lg:hidden">Категория</dt>
                  <dd className="mt-1 truncate text-xs lg:mt-0 lg:text-sm">{product.category}</dd>
                </div>
                <div className="min-w-0 rounded-lg bg-muted/55 p-2 lg:rounded-none lg:bg-transparent lg:p-0">
                  <dt className="font-bold text-[0.65rem] text-muted-foreground uppercase lg:hidden">Цена</dt>
                  <dd className="mt-1 lg:mt-0">
                    <strong className="block truncate text-xs lg:text-sm">
                      {product.internalPrice > 0 ? formatLei(product.internalPrice) : "Не задана"}
                    </strong>
                    {product.updatedAt ? (
                      <span className="mt-0.5 block truncate text-[0.66rem] text-muted-foreground">
                        {formatDate(product.updatedAt)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>
              <div className="border-t pt-3 lg:border-0 lg:pt-0">
                <PriceForm slug={product.slug} value={product.internalPrice} />
              </div>
            </li>
          ))}
        </ul>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground text-sm">Товары по выбранным условиям не найдены.</p>
        ) : null}
      </section>

      {filtered.length > pageSize ? (
        <nav
          className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-white p-3"
          aria-label="Пагинация каталога"
        >
          {currentPage > 1 ? (
            <Link
              href={pageHref(currentPage - 1)}
              className={buttonVariants({ variant: "outline", size: "lg", className: "min-h-11 md:min-h-9" })}
            >
              Назад
            </Link>
          ) : (
            <Button variant="outline" size="lg" disabled>
              Назад
            </Button>
          )}
          <div className="text-center text-xs">
            <strong className="block text-sm">
              {currentPage} / {pages}
            </strong>
            <span className="text-muted-foreground">Найдено: {filtered.length}</span>
          </div>
          {currentPage < pages ? (
            <Link
              href={pageHref(currentPage + 1)}
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
