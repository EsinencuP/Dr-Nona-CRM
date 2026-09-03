"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Clock3, Mail, MapPin, PackageOpen, Phone } from "lucide-react";

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatLei, statusLabels, typeLabels } from "@/lib/crm-labels";
import type { OrderStatus, OrdersResult, OrderView } from "@/lib/crm-types";
import { ORDER_STATUSES } from "@/lib/crm-types";

import { StatusBadge } from "../../_components/status-badge";
import { updateOrderStatus } from "../../actions";

function OrderDetail({ order }: { order: OrderView }) {
  const total = order.items.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0);
  return (
    <div className="space-y-5 px-5 pb-6">
      <section className="grid gap-3 rounded-xl border bg-muted/45 p-4 sm:grid-cols-2">
        <div>
          <p className="font-bold text-muted-foreground text-xs">Клиент</p>
          <p className="mt-1 font-bold">
            {order.client.firstName} {order.client.lastName}
          </p>
        </div>
        <div>
          <p className="font-bold text-muted-foreground text-xs">Регион</p>
          <p className="mt-1 flex items-center gap-1.5 font-semibold">
            <MapPin className="size-4 text-primary" />
            {order.client.region}
          </p>
        </div>
        <a
          href={`tel:${order.client.phoneNormalized}`}
          className="flex items-center gap-2 font-semibold text-primary text-sm hover:underline"
        >
          <Phone className="size-4" />
          {order.client.phone}
        </a>
        {order.client.email ? (
          <a
            href={`mailto:${order.client.email}`}
            className="flex items-center gap-2 break-all font-semibold text-primary text-sm hover:underline"
          >
            <Mail className="size-4 shrink-0" />
            {order.client.email}
          </a>
        ) : (
          <span className="text-muted-foreground text-sm">Email не указан</span>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-extrabold text-xl tracking-[-0.02em]">Состав заявки</h3>
          <strong className="text-primary text-sm">{formatLei(total)}</strong>
        </div>
        {order.items.length ? (
          <ul className="divide-y rounded-xl border bg-white">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-sm">{item.name}</p>
                  <p className="mt-0.5 text-muted-foreground text-xs">{item.productSlug}</p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <strong>× {item.quantity}</strong>
                  <p className="text-muted-foreground text-xs">{formatLei(item.priceAtPurchase)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-muted/55 p-4 text-muted-foreground text-sm">В заявке нет товарных позиций.</p>
        )}
      </section>

      {order.masterclassTopic || order.eventDate || order.eventTime || order.consultationMode ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
          <h3 className="font-bold text-amber-950">Детали встречи</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            {order.masterclassTopic ? (
              <div>
                <dt className="text-amber-800 text-xs">Тема</dt>
                <dd className="mt-0.5 font-semibold">{order.masterclassTopic}</dd>
              </div>
            ) : null}
            {order.consultationMode ? (
              <div>
                <dt className="text-amber-800 text-xs">Формат</dt>
                <dd className="mt-0.5 font-semibold">{order.consultationMode === "online" ? "Онлайн" : "Офлайн"}</dd>
              </div>
            ) : null}
            {order.eventDate ? (
              <div>
                <dt className="text-amber-800 text-xs">Дата</dt>
                <dd className="mt-0.5 font-semibold">{order.eventDate}</dd>
              </div>
            ) : null}
            {order.eventTime ? (
              <div>
                <dt className="text-amber-800 text-xs">Время</dt>
                <dd className="mt-0.5 font-semibold">{order.eventTime}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="font-extrabold text-sm">Пожелания клиента</h3>
          <p className="mt-2 rounded-xl bg-muted/55 p-3 text-muted-foreground text-sm leading-6">
            {order.comment ?? "Комментарий не оставлен."}
          </p>
          {order.preferredCallTime ? (
            <p className="mt-2 flex items-center gap-2 font-semibold text-xs">
              <Clock3 className="size-4 text-primary" />
              Звонок: {order.preferredCallTime}
            </p>
          ) : null}
        </div>
        <div>
          <h3 className="font-extrabold text-sm">Маркетинговая атрибуция</h3>
          <dl className="mt-2 space-y-2 rounded-xl bg-muted/55 p-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Источник</dt>
              <dd className="text-right font-semibold">{order.utmSource ?? "Прямой"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Канал</dt>
              <dd className="text-right font-semibold">{order.utmMedium ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Кампания</dt>
              <dd className="max-w-40 truncate text-right font-semibold">{order.utmCampaign ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Точка входа</dt>
              <dd className="max-w-40 truncate text-right font-semibold">{order.entryPoint ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </section>

      {order.sessionHistory.length ? (
        <section>
          <h3 className="font-extrabold text-sm">Просмотренные товары</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {order.sessionHistory.map((slug) => (
              <span key={slug} className="rounded-full border bg-white px-2.5 py-1 text-xs">
                {slug}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="font-extrabold text-sm">Предыдущие обращения</h3>
        {order.client.previousOrders.length ? (
          <ul className="mt-2 space-y-2">
            {order.client.previousOrders.map((previous) => (
              <li
                key={previous.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs"
              >
                <span>
                  <strong>#{previous.id.slice(0, 8)}</strong> · {formatDate(previous.createdAt)}
                </span>
                <StatusBadge status={previous.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted-foreground text-sm">Это первое обращение клиента.</p>
        )}
      </section>
    </div>
  );
}

export function OrdersTable({ result }: { result: OrdersResult }) {
  const router = useRouter();
  const [selected, setSelected] = useState<OrderView | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function changeStatus(order: OrderView, status: OrderStatus) {
    setMessage("");
    startTransition(() => {
      void updateOrderStatus(order.id, status).then((response) => {
        setMessage(response.message);
        if (response.ok) {
          setSelected((current) => (current?.id === order.id ? { ...current, status } : current));
          router.refresh();
        }
      });
    });
  }

  if (result.rows.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border bg-white px-6 text-center">
        <PackageOpen className="size-9 text-primary" aria-hidden="true" />
        <h2 className="mt-3 font-extrabold text-xl tracking-[-0.02em]">Заявки не найдены</h2>
        <p className="mt-1 text-muted-foreground text-sm">Измените фильтры или дождитесь нового обращения.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label="Список заявок">
        {result.rows.map((order) => (
          <li key={order.id} className="crm-panel overflow-hidden rounded-xl border bg-white">
            <button
              type="button"
              className="w-full p-4 text-left transition-colors hover:bg-muted/35"
              aria-label={`Открыть заявку ${order.id.slice(0, 8)}`}
              onClick={() => setSelected(order)}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <strong className="block text-sm">#{order.id.slice(0, 8)}</strong>
                  <span className="mt-0.5 block text-muted-foreground text-xs">{formatDate(order.createdAt)}</span>
                </span>
                <StatusBadge status={order.status} />
              </span>
              <span className="mt-4 grid grid-cols-2 gap-2">
                <span className="rounded-lg bg-muted/55 p-2.5">
                  <span className="block font-bold text-[0.65rem] text-muted-foreground uppercase">Клиент</span>
                  <span className="mt-1 block truncate font-bold text-sm">
                    {order.client.firstName} {order.client.lastName}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground text-xs">{order.client.phone}</span>
                </span>
                <span className="rounded-lg bg-muted/55 p-2.5">
                  <span className="block font-bold text-[0.65rem] text-muted-foreground uppercase">Регион</span>
                  <span className="mt-1 flex items-center gap-1.5 truncate font-semibold text-sm">
                    <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    {order.client.region}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground text-xs">{typeLabels[order.type]}</span>
                </span>
              </span>
              <span className="mt-3 block text-muted-foreground text-xs">Состав / тема</span>
              <span className="mt-1 line-clamp-2 block font-semibold text-sm leading-5">
                {order.masterclassTopic ||
                  order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ") ||
                  "Без товарных позиций"}
              </span>
            </button>
            <div className="flex items-center gap-3 border-t bg-slate-50/70 px-4 py-3">
              <label className="shrink-0 font-bold text-muted-foreground text-xs" htmlFor={`status-mobile-${order.id}`}>
                Статус
              </label>
              <NativeSelect
                id={`status-mobile-${order.id}`}
                className="min-w-0 flex-1"
                value={order.status}
                disabled={pending}
                onChange={(event) => changeStatus(order, event.target.value as OrderStatus)}
              >
                {ORDER_STATUSES.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {statusLabels[status]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </li>
        ))}
      </ul>

      <div className="crm-panel hidden rounded-xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID / Дата</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Регион</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Состав / Тема</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <button
                    type="button"
                    className="block rounded-md text-left hover:text-primary"
                    aria-label={`Открыть заявку ${order.id.slice(0, 8)}`}
                    onClick={() => setSelected(order)}
                  >
                    <strong className="block">#{order.id.slice(0, 8)}</strong>
                    <span className="mt-0.5 block text-muted-foreground text-xs">{formatDate(order.createdAt)}</span>
                  </button>
                </TableCell>
                <TableCell>
                  <strong className="block">
                    {order.client.firstName} {order.client.lastName}
                  </strong>
                  <span className="mt-0.5 block text-muted-foreground text-xs">{order.client.phone}</span>
                </TableCell>
                <TableCell>{order.client.region}</TableCell>
                <TableCell>
                  <span className="rounded-full bg-muted px-2.5 py-1 font-bold text-xs">{typeLabels[order.type]}</span>
                </TableCell>
                <TableCell className="max-w-64 truncate">
                  {order.masterclassTopic ||
                    order.items.map((item) => `${item.name} ×${item.quantity}`).join(", ") ||
                    "Без товарных позиций"}
                </TableCell>
                <TableCell>
                  <NativeSelect
                    className="min-w-40"
                    value={order.status}
                    disabled={pending}
                    aria-label={`Статус заявки ${order.id.slice(0, 8)}`}
                    onChange={(event) => changeStatus(order, event.target.value as OrderStatus)}
                  >
                    {ORDER_STATUSES.map((status) => (
                      <NativeSelectOption key={status} value={status}>
                        {statusLabels[status]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 min-h-5 text-muted-foreground text-xs" aria-live="polite">
        {message}
      </p>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelected(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader className="border-b px-5 py-5">
                <div className="flex items-start justify-between gap-8">
                  <div>
                    <SheetTitle className="font-extrabold text-2xl tracking-[-0.03em]">
                      Заявка #{selected.id.slice(0, 8)}
                    </SheetTitle>
                    <SheetDescription className="mt-1">
                      {formatDate(selected.createdAt)} · {typeLabels[selected.type]}
                    </SheetDescription>
                  </div>
                  <StatusBadge status={selected.status} className="mt-1" />
                </div>
              </SheetHeader>
              <OrderDetail order={selected} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
