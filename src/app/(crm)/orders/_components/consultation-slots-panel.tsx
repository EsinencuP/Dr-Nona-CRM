"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ConsultationSlotView } from "@/lib/crm-types";

import { changeConsultationSlotStateAction, createConsultationSlotAction } from "../../actions";

const stateLabels = { OPEN: "Доступен", RESERVED: "Зарезервирован", CLOSED: "Закрыт", CANCELLED: "Отменён" } as const;

function formatSlot(value: string) {
  return new Intl.DateTimeFormat("ru-MD", {
    timeZone: "Europe/Chisinau",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ConsultationSlotsPanel({ slots }: { slots: ConsultationSlotView[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function create(formData: FormData) {
    setMessage("");
    startTransition(() => {
      void createConsultationSlotAction({
        localStart: String(formData.get("localStart") ?? ""),
        durationMinutes: Number(formData.get("durationMinutes") ?? 60),
        mode: String(formData.get("mode") ?? "online") as "online" | "offline",
      }).then((result) => {
        setMessage(result.message);
        if (result.ok) router.refresh();
      });
    });
  }

  function change(slotId: string, nextState: "OPEN" | "CLOSED" | "CANCELLED") {
    setMessage("");
    startTransition(() => {
      void changeConsultationSlotStateAction(slotId, nextState, "manager_action").then((result) => {
        setMessage(result.message);
        if (result.ok) router.refresh();
      });
    });
  }

  return (
    <section className="mb-4 rounded-xl border bg-white p-4" aria-labelledby="consultation-slots-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="consultation-slots-title" className="flex items-center gap-2 font-extrabold text-lg">
            <CalendarClock className="size-5 text-primary" aria-hidden="true" /> Слоты консультаций
          </h2>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            Публикуются вручную по времени Кишинёва. Один слот принимает одну заявку; резервирование выполняется
            атомарно.
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 font-semibold text-xs">Europe/Chisinau</span>
      </div>
      <form action={create} className="mt-4 grid gap-2 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
        <label htmlFor="consultation-slot-start">
          <span className="sr-only">Начало слота</span>
          <Input
            id="consultation-slot-start"
            name="localStart"
            type="datetime-local"
            required
            aria-label="Начало слота по времени Кишинёва"
          />
        </label>
        <NativeSelect name="durationMinutes" defaultValue="60" aria-label="Длительность слота">
          {[30, 45, 60, 90, 120].map((minutes) => (
            <NativeSelectOption key={minutes} value={String(minutes)}>
              {minutes} минут
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="mode" defaultValue="online" aria-label="Формат консультации">
          <NativeSelectOption value="online">Онлайн</NativeSelectOption>
          <NativeSelectOption value="offline">Офлайн</NativeSelectOption>
        </NativeSelect>
        <Button type="submit" disabled={pending}>
          Опубликовать
        </Button>
      </form>
      {message ? (
        <p className="mt-2 text-sm" role="status">
          {message}
        </p>
      ) : null}
      {slots.length ? (
        <ul className="mt-4 grid gap-2 lg:grid-cols-2">
          {slots.slice(0, 20).map((slot) => (
            <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/45 p-3">
              <div>
                <p className="font-bold text-sm">
                  {formatSlot(slot.startsAt)} · {slot.mode === "online" ? "онлайн" : "офлайн"}
                </p>
                <p className="mt-1 text-muted-foreground text-xs">
                  {stateLabels[slot.state]}
                  {slot.reservedOrderId ? ` · #${slot.reservedOrderId.slice(0, 8)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {slot.state === "OPEN" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => change(slot.id, "CLOSED")}
                    disabled={pending}
                  >
                    Закрыть
                  </Button>
                ) : null}
                {slot.state === "CLOSED" || slot.state === "CANCELLED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => change(slot.id, "OPEN")}
                    disabled={pending}
                  >
                    Открыть
                  </Button>
                ) : null}
                {slot.state !== "RESERVED" && slot.state !== "CANCELLED" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => change(slot.id, "CANCELLED")}
                    disabled={pending}
                  >
                    Отменить
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg bg-muted/55 p-3 text-muted-foreground text-sm">Опубликованных слотов пока нет.</p>
      )}
    </section>
  );
}
