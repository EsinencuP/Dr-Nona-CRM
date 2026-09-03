"use client";

import { useState } from "react";

import { Mail, MapPin, Phone, UserRound, Warehouse } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatLei, typeLabels } from "@/lib/crm-labels";
import type { ClientView } from "@/lib/crm-types";

import { StatusBadge } from "../../_components/status-badge";

function whatsappHref(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function ClientsTable({ clients }: { clients: ClientView[] }) {
  const [selected, setSelected] = useState<ClientView | null>(null);

  if (clients.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border bg-white px-6 text-center">
        <UserRound className="size-9 text-primary" aria-hidden="true" />
        <h2 className="mt-3 font-extrabold text-xl tracking-[-0.02em]">Клиенты не найдены</h2>
        <p className="mt-1 text-muted-foreground text-sm">Измените поисковый запрос.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3 md:hidden" aria-label="Список клиентов">
        {clients.map((client) => (
          <li key={client.id}>
            <button
              type="button"
              className="crm-panel w-full rounded-xl border bg-white p-4 text-left transition-colors hover:bg-muted/35"
              aria-label={`Открыть карточку ${client.firstName} ${client.lastName}`}
              onClick={() => setSelected(client)}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <strong className="block truncate text-base">
                    {client.firstName} {client.lastName}
                  </strong>
                  <span className="mt-1 flex items-center gap-1.5 text-muted-foreground text-xs">
                    <MapPin className="size-3.5 text-primary" aria-hidden="true" />
                    {client.region}
                  </span>
                </span>
                <span className="rounded-xl bg-secondary px-3 py-2 text-center text-secondary-foreground">
                  <strong className="block text-lg tabular-nums">{client.orderCount}</strong>
                  <span className="block text-[0.62rem] uppercase">обращ.</span>
                </span>
              </span>
              <span className="mt-4 grid gap-2 rounded-xl bg-muted/55 p-3 text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <Phone className="size-4 text-primary" aria-hidden="true" />
                  {client.phone}
                </span>
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate">{client.email || "Email не указан"}</span>
                </span>
              </span>
              <span className="mt-3 flex justify-between gap-4 text-xs">
                <span>
                  <span className="block text-muted-foreground">Первое</span>
                  <strong className="mt-0.5 block">
                    {client.firstOrderAt ? formatDate(client.firstOrderAt, false) : "—"}
                  </strong>
                </span>
                <span className="text-right">
                  <span className="block text-muted-foreground">Последнее</span>
                  <strong className="mt-0.5 block">
                    {client.lastOrderAt ? formatDate(client.lastOrderAt, false) : "—"}
                  </strong>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="crm-panel hidden rounded-xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Клиент</TableHead>
              <TableHead>Контакты</TableHead>
              <TableHead>Регион</TableHead>
              <TableHead className="text-right">Обращения</TableHead>
              <TableHead>Первое</TableHead>
              <TableHead>Последнее</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow
                key={client.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                aria-label={`Открыть карточку ${client.firstName} ${client.lastName}`}
                onClick={() => setSelected(client)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(client);
                  }
                }}
              >
                <TableCell>
                  <strong>
                    {client.firstName} {client.lastName}
                  </strong>
                </TableCell>
                <TableCell>
                  <span className="block font-semibold">{client.phone}</span>
                  <span className="mt-0.5 block max-w-52 truncate text-muted-foreground text-xs">
                    {client.email || "Email не указан"}
                  </span>
                </TableCell>
                <TableCell>{client.region}</TableCell>
                <TableCell className="text-right font-extrabold tabular-nums">{client.orderCount}</TableCell>
                <TableCell>{client.firstOrderAt ? formatDate(client.firstOrderAt, false) : "—"}</TableCell>
                <TableCell>{client.lastOrderAt ? formatDate(client.lastOrderAt, false) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected ? (
            <>
              <SheetHeader className="border-b px-5 py-5">
                <SheetTitle className="font-extrabold text-2xl tracking-[-0.03em]">
                  {selected.firstName} {selected.lastName}
                </SheetTitle>
                <SheetDescription>
                  Клиент с {formatDate(selected.createdAt, false)} · {selected.region}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-5 pb-6">
                <section className="grid grid-cols-2 gap-3">
                  <a
                    href={`tel:${selected.phoneNormalized}`}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 font-bold text-sm text-white"
                  >
                    <Phone className="size-4" />
                    Позвонить
                  </a>
                  <a
                    href={whatsappHref(selected.phoneNormalized)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-white px-3 font-bold text-primary text-sm"
                  >
                    WhatsApp
                  </a>
                  {selected.email ? (
                    <a
                      href={`mailto:${selected.email}`}
                      className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-white px-3 font-bold text-primary text-sm"
                    >
                      <Mail className="size-4" />
                      {selected.email}
                    </a>
                  ) : null}
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted p-4">
                    <p className="text-muted-foreground text-xs">Всего обращений</p>
                    <p className="mt-1 font-extrabold text-2xl">{selected.orderCount}</p>
                  </div>
                  <div className="rounded-xl bg-accent p-4">
                    <p className="text-accent-foreground text-xs">Сумма по заявкам</p>
                    <p className="mt-1 font-extrabold text-accent-foreground text-xl">
                      {formatLei(selected.totalValue)}
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="font-extrabold text-xl tracking-[-0.02em]">История обращений</h3>
                  {selected.orders.length ? (
                    <ul className="mt-3 space-y-2">
                      {selected.orders.map((order) => (
                        <li key={order.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border bg-white p-3">
                          <div className="min-w-0">
                            <p className="font-bold text-sm">
                              #{order.id.slice(0, 8)} · {typeLabels[order.type]}
                            </p>
                            <p className="mt-1 text-muted-foreground text-xs">{formatDate(order.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={order.status} />
                            <p className="mt-1 font-bold text-xs">{formatLei(order.value)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted p-4 text-muted-foreground text-sm">
                      <Warehouse className="size-4" />
                      История пока пуста.
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
