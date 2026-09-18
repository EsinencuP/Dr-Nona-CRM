"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Mail, MapPin, NotebookPen, Phone, Repeat2, Sparkles, UserRound, Warehouse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatLei, typeLabels } from "@/lib/crm-labels";
import type { ClientView } from "@/lib/crm-types";

import { MOLDOVA_REGIONS } from "../../../../../shared/constants/moldova-regions";
import { StatusBadge } from "../../_components/status-badge";
import { addClientNote, setClientNotificationOptOut, updateClientProfile } from "../../actions";

function whatsappHref(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function ClientsTable({ clients }: { clients: ClientView[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ClientView | null>(null);
  const [message, setMessage] = useState("");
  const [noteMessage, setNoteMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submitProfile(formData: FormData) {
    if (!selected) return;
    setMessage("");
    startTransition(() => {
      void updateClientProfile(selected.id, {
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        region: String(formData.get("region") ?? "") as (typeof MOLDOVA_REGIONS)[number],
      }).then((result) => {
        setMessage(result.message);
        if (result.ok) router.refresh();
      });
    });
  }

  function submitNote(formData: FormData) {
    if (!selected) return;
    setNoteMessage("");
    startTransition(() => {
      void addClientNote(selected.id, String(formData.get("body") ?? "")).then((result) => {
        setNoteMessage(result.message);
        if (result.ok) {
          setSelected(null);
          router.refresh();
        }
      });
    });
  }

  function toggleNotifications() {
    if (!selected) return;
    setNoteMessage("");
    startTransition(() => {
      void setClientNotificationOptOut(selected.id, !selected.notificationsOptedOut).then((result) => {
        setNoteMessage(result.message);
        if (result.ok) {
          setSelected(null);
          router.refresh();
        }
      });
    });
  }

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
                <section className="rounded-xl border bg-white p-4" aria-labelledby="client-insights-title">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 id="client-insights-title" className="font-extrabold text-sm">
                        Контекст клиента
                      </h3>
                      <p className="mt-1 text-muted-foreground text-xs">
                        Рассчитано из сохранённой истории, не назначено менеджером.
                      </p>
                    </div>
                    {selected.insights.repeatClient ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 font-bold text-primary text-xs">
                        <Repeat2 className="size-3.5" aria-hidden="true" />
                        Постоянный · {selected.insights.completedCount} завершено
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-3 py-1 font-semibold text-muted-foreground text-xs">
                        {selected.insights.completedCount} завершено
                      </span>
                    )}
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-muted/55 p-3">
                      <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Sparkles className="size-3.5" aria-hidden="true" /> Предпочтительные товары · рассчитано
                      </dt>
                      <dd className="mt-2 text-sm">
                        {selected.insights.preferredProducts.length
                          ? selected.insights.preferredProducts
                              .map((product) => `${product.name} × ${product.units}`)
                              .join("; ")
                          : "Недостаточно завершённых заказов"}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-muted/55 p-3">
                      <dt className="text-muted-foreground text-xs">Время связи · рассчитано</dt>
                      <dd className="mt-2 font-semibold text-sm">
                        {selected.insights.preferredContact
                          ? `${selected.insights.preferredContact.value} · указано ${selected.insights.preferredContact.count} раз(а)`
                          : "Клиент не указывал"}
                      </dd>
                    </div>
                  </dl>
                </section>

                <form action={submitProfile} className="rounded-xl border bg-muted/35 p-4">
                  <h3 className="font-extrabold text-sm">Канонический профиль</h3>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Новые заявки не изменяют эти данные автоматически.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input name="firstName" defaultValue={selected.firstName} aria-label="Имя" required />
                    <Input name="lastName" defaultValue={selected.lastName} aria-label="Фамилия" required />
                    <Input name="phone" defaultValue={selected.phone} aria-label="Телефон" required />
                    <Input name="email" defaultValue={selected.email ?? ""} aria-label="Email" type="email" />
                    <NativeSelect
                      name="region"
                      defaultValue={selected.region}
                      aria-label="Регион"
                      className="sm:col-span-2"
                    >
                      {MOLDOVA_REGIONS.map((region) => (
                        <NativeSelectOption key={region} value={region}>
                          {region}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <Button type="submit" className="mt-3" disabled={pending}>
                    {pending ? "Сохранение…" : "Сохранить профиль"}
                  </Button>
                  {message ? (
                    <p className="mt-2 text-sm" role="status">
                      {message}
                    </p>
                  ) : null}
                  {selected.profileAudits.length ? (
                    <p className="mt-3 text-muted-foreground text-xs">
                      Последнее изменение: {formatDate(selected.profileAudits[0].createdAt)} ·{" "}
                      {selected.profileAudits[0].actor}
                    </p>
                  ) : (
                    <p className="mt-3 text-muted-foreground text-xs">Ручных изменений ещё нет.</p>
                  )}
                </form>

                <section className="rounded-xl border bg-white p-4" aria-labelledby="client-notes-title">
                  <h3 id="client-notes-title" className="flex items-center gap-2 font-extrabold text-sm">
                    <NotebookPen className="size-4 text-primary" aria-hidden="true" /> Внутренние заметки
                  </h3>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Доступны только в CRM. Записи неизменяемы и сохраняют автора и время.
                  </p>
                  <form action={submitNote} className="mt-3">
                    <label htmlFor="client-note" className="sr-only">
                      Новая внутренняя заметка
                    </label>
                    <textarea
                      id="client-note"
                      name="body"
                      rows={3}
                      maxLength={1200}
                      required
                      className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Добавить фактический контекст для следующего обращения…"
                    />
                    <Button type="submit" className="mt-2" disabled={pending}>
                      Добавить в журнал
                    </Button>
                    {noteMessage ? (
                      <p className="mt-2 text-sm" role="status">
                        {noteMessage}
                      </p>
                    ) : null}
                  </form>
                  {selected.notes.length ? (
                    <ol className="mt-4 space-y-2">
                      {selected.notes.map((note) => (
                        <li key={note.id} className="rounded-lg bg-muted/55 p-3">
                          <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                          <p className="mt-2 text-muted-foreground text-xs">
                            {formatDate(note.createdAt)} · {note.actor}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-4 text-muted-foreground text-sm">Заметок пока нет.</p>
                  )}
                </section>

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
                    <p className="text-accent-foreground text-xs">Завершено на</p>
                    <p className="mt-1 font-extrabold text-accent-foreground text-xl">
                      {formatLei(selected.totalValue)}
                    </p>
                    {selected.insights.incompletePriceItems ? (
                      <p className="mt-1 text-[0.68rem] text-accent-foreground/75">
                        Без цены: {selected.insights.incompletePriceItems} поз.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-xl border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-extrabold text-sm">Статусные SMS</h3>
                      <p className="mt-1 text-muted-foreground text-xs">
                        {selected.notificationsOptedOut
                          ? "Клиент отказался от уведомлений."
                          : "Явный отказ не зафиксирован."}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={toggleNotifications} disabled={pending}>
                      {selected.notificationsOptedOut ? "Снять отказ" : "Зафиксировать отказ"}
                    </Button>
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
