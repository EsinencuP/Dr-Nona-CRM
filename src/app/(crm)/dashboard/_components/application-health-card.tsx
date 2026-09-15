import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";

import type { ApplicationHealth } from "@/server/application-health";

export function ApplicationHealthCard({ health }: { health: ApplicationHealth }) {
  const attention = health.status === "attention";
  const Icon = attention ? AlertTriangle : CheckCircle2;
  return (
    <section
      aria-labelledby="application-health-title"
      role={attention ? "alert" : "status"}
      className={`rounded-xl border p-4 ${
        attention ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="application-health-title" className="font-semibold text-sm">
              {attention ? "Доставка заявок требует внимания" : "Доставка заявок работает штатно"}
            </h2>
            <span className="inline-flex items-center gap-1 text-xs tabular-nums opacity-75">
              <Activity className="size-3.5" aria-hidden="true" />
              Окно {health.windowMinutes} мин
            </span>
          </div>
          {health.database === "unavailable" ? (
            <p className="mt-2 text-sm leading-6">
              CRM не смогла проверить журнал доставки. Проверьте доступность базы и события{" "}
              <code>application.db.write</code>.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6">
              Сбоев Telegram: {health.deliveryFailures}; зависших доставок: {health.staleDeliveries}; подряд:{" "}
              {health.consecutiveFailures}. Алерт включается при {health.failureThreshold} последовательных сбоях или
              одной доставке старше 2 минут.
            </p>
          )}
          {attention && (
            <p className="mt-2 text-xs leading-5 opacity-80">
              Найдите requestId в логах Vercel. Повторяйте только DELIVERY_FAILED; DELIVERY_STARTED сначала сверяйте с
              Telegram, чтобы не создать дубль.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
