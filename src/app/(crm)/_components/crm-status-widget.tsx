"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { Activity, AlertTriangle, CheckCircle2, CircleHelp, Clock3, RefreshCw, ShieldAlert, X } from "lucide-react";

import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { CrmStatusLevel, CrmStatusSnapshot } from "@/server/crm-status";

import { refreshCrmStatus } from "./status-actions";

const statusPresentation: Record<
  CrmStatusLevel,
  { label: string; detail: string; icon: typeof CheckCircle2; dot: string; trigger: string }
> = {
  healthy: {
    label: "Система работает",
    detail: "Доставка заявок и SLA проверены",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    trigger: "border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
  },
  warning: {
    label: "Требует внимания",
    detail: "Есть просроченные заявки или ожидающие повтора доставки",
    icon: AlertTriangle,
    dot: "bg-amber-500",
    trigger: "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100",
  },
  critical: {
    label: "Есть критическая проблема",
    detail: "Подтверждён сбой доставки или проверки базы",
    icon: ShieldAlert,
    dot: "bg-rose-600",
    trigger: "border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100",
  },
  unknown: {
    label: "Статус не подтверждён",
    detail: "Одна или несколько проверок временно недоступны",
    icon: CircleHelp,
    dot: "bg-slate-400",
    trigger: "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100",
  },
};

function formatCheckedAt(value: string, timezone = "Europe/Chisinau") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "время неизвестно";
  return new Intl.DateTimeFormat("ru-MD", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date);
}

function Metric({ label, value, emphasis = false }: { label: string; value: number | null; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <dt className="text-slate-500 text-xs">{label}</dt>
      <dd className={cn("mt-1 font-extrabold text-xl tabular-nums", emphasis ? "text-rose-600" : "text-slate-900")}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

export function CrmStatusWidget({ initialSnapshot }: { initialSnapshot: CrmStatusSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [stale, setStale] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await refreshCrmStatus();
      setSnapshot(next);
      setRefreshFailed(false);
      setStale(false);
    } catch {
      setRefreshFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const syncStaleness = () => {
      const age = Date.now() - Date.parse(snapshot.checkedAt);
      setStale(age >= snapshot.staleAfterSeconds * 1_000);
    };
    syncStaleness();
    const staleInterval = window.setInterval(syncStaleness, 15_000);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, snapshot.refreshAfterSeconds * 1_000);
    const onVisibilityChange = () => {
      const age = Date.now() - Date.parse(snapshot.checkedAt);
      setStale(age >= snapshot.staleAfterSeconds * 1_000);
      if (document.visibilityState === "visible" && age >= snapshot.refreshAfterSeconds * 1_000) void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(staleInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh, snapshot.checkedAt, snapshot.refreshAfterSeconds, snapshot.staleAfterSeconds]);

  const effectiveLevel: CrmStatusLevel = refreshFailed || stale ? "unknown" : snapshot.level;
  const presentation = statusPresentation[effectiveLevel];
  const Icon = presentation.icon;
  const health = snapshot.health;
  const sla = snapshot.sla;
  let databaseLabel = "не проверена";
  if (health?.database === "reachable") databaseLabel = "доступна";
  else if (health) databaseLabel = "недоступна";

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "inline-flex min-h-10 max-w-[13rem] items-center gap-2 rounded-full border px-3 py-2 text-left font-bold text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
          presentation.trigger,
        )}
        aria-label={`${presentation.label}. Открыть состояние системы`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={refreshing}
        onClick={() => setOpen(true)}
      >
        <span className={cn("size-2 shrink-0 rounded-full", presentation.dot)} aria-hidden="true" />
        <span className="truncate" aria-live="polite">
          {presentation.label}
        </span>
      </button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" showCloseButton={false} className="w-full overflow-y-auto sm:max-w-lg">
          <SheetClose
            render={
              <button
                type="button"
                className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="Закрыть состояние системы"
              />
            }
          >
            <X className="size-5" aria-hidden="true" />
          </SheetClose>
          <SheetHeader className="border-slate-200 border-b px-5 py-5 pr-14">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
                  presentation.trigger,
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <SheetTitle className="font-extrabold text-xl tracking-[-0.02em]">{presentation.label}</SheetTitle>
                <SheetDescription className="mt-1 leading-5">{presentation.detail}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-5 px-5 pb-6">
            {refreshFailed ? (
              <p role="status" className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-700 text-sm">
                Последнее обновление не удалось. Ниже показан последний полученный срез.
              </p>
            ) : null}
            {stale && !refreshFailed ? (
              <p role="status" className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-700 text-sm">
                Срез устарел. Обновляем данные, не интерпретируйте его как текущий статус системы.
              </p>
            ) : null}

            <section
              aria-labelledby="delivery-health-heading"
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 id="delivery-health-heading" className="flex items-center gap-2 font-bold text-slate-900">
                    <Activity className="size-4 text-cyan-700" aria-hidden="true" />
                    Доставка заявок
                  </h2>
                  <p className="mt-1 text-slate-500 text-xs">
                    {health ? `Окно наблюдения: ${health.windowMinutes} минут` : "Проверка временно недоступна"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 text-xs">
                  База: {databaseLabel}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Metric
                  label="Сбоев Telegram"
                  value={health?.deliveryFailures ?? null}
                  emphasis={(health?.deliveryFailures ?? 0) > 0}
                />
                <Metric
                  label="Зависших"
                  value={health?.staleDeliveries ?? null}
                  emphasis={(health?.staleDeliveries ?? 0) > 0}
                />
                <Metric
                  label="Подряд"
                  value={health?.consecutiveFailures ?? null}
                  emphasis={(health?.consecutiveFailures ?? 0) > 0}
                />
                <Metric label="Ожидают повтора" value={health?.pendingRetries ?? null} />
                <Metric
                  label="Требуют сверки"
                  value={health?.needsReview ?? null}
                  emphasis={(health?.needsReview ?? 0) > 0}
                />
              </dl>
              {health?.status === "attention" ? (
                <p className="mt-3 text-rose-700 text-xs leading-5">
                  TERMINAL можно повторить из заявки. NEEDS_REVIEW сначала сверьте с Telegram, чтобы не создать дубль.
                </p>
              ) : null}
            </section>

            <section aria-labelledby="sla-health-heading" className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 id="sla-health-heading" className="flex items-center gap-2 font-bold text-slate-900">
                    <Clock3 className="size-4 text-cyan-700" aria-hidden="true" />
                    SLA первого действия
                  </h2>
                  <p className="mt-1 text-slate-500 text-xs">
                    {sla
                      ? `${sla.slaMinutes} минут · живой срез NEW · Europe/Chisinau`
                      : "Проверка временно недоступна"}
                  </p>
                </div>
                <Link
                  href="/orders?status=NEW"
                  onClick={() => setOpen(false)}
                  className="font-semibold text-primary text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  Открыть заявки
                </Link>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Metric label="Сегодня" value={sla?.todayCount ?? null} />
                <Metric label="С понедельника" value={sla?.weekCount ?? null} />
                <Metric
                  label="Просрочено NEW"
                  value={sla?.overdueCount ?? null}
                  emphasis={(sla?.overdueCount ?? 0) > 0}
                />
              </dl>
              {sla?.oldestOverdue.length ? (
                <ul className="mt-4 space-y-2 border-slate-200 border-t pt-3 text-xs">
                  {sla.oldestOverdue.map((order) => (
                    <li key={order.id} className="flex justify-between gap-3">
                      <span className="font-semibold text-slate-800">#{order.id.slice(0, 8)}</span>
                      <span className="text-slate-500 tabular-nums">{order.ageMinutes} мин без действия</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {sla && sla.oldestOverdue.length === 0 ? (
                <p className="mt-4 border-slate-200 border-t pt-3 text-emerald-700 text-xs">
                  Просроченных новых заявок нет.
                </p>
              ) : null}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-slate-200 border-t pt-4">
              <p className="text-slate-500 text-xs">
                Проверено:{" "}
                <time dateTime={snapshot.checkedAt}>{formatCheckedAt(snapshot.checkedAt, sla?.timezone)}</time>
              </p>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-800 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw className={cn("size-4", refreshing && "motion-safe:animate-spin")} aria-hidden="true" />
                {refreshing ? "Обновляем…" : "Обновить"}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
