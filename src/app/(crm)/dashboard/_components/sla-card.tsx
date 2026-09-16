import Link from "next/link";

import { AlertTriangle, Clock3 } from "lucide-react";

import type { DashboardStats } from "@/lib/crm-types";

export function SlaCard({ operations }: { operations: DashboardStats["operations"] }) {
  const attention = operations.overdueCount > 0;
  return (
    <section
      aria-labelledby="sla-title"
      role={attention ? "alert" : "status"}
      className={`rounded-xl border bg-white p-4 ${attention ? "border-rose-200" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="sla-title" className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
            {attention ? (
              <AlertTriangle className="size-4 text-rose-500" aria-hidden="true" />
            ) : (
              <Clock3 className="size-4 text-emerald-500" aria-hidden="true" />
            )}
            SLA первого действия: {operations.slaMinutes} минут
          </h2>
          <p className="mt-1 text-slate-500 text-xs">
            Живой срез NEW · Europe/Chisinau ·{" "}
            {new Date(operations.checkedAt).toLocaleString("ru-MD", { timeZone: operations.timezone })}
          </p>
        </div>
        <Link href="/orders?status=NEW" className="font-semibold text-primary text-sm hover:underline">
          Открыть новые заявки
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-slate-500 text-xs">Сегодня</dt>
          <dd className="mt-1 font-bold text-xl tabular-nums">{operations.todayCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs">С понедельника</dt>
          <dd className="mt-1 font-bold text-xl tabular-nums">{operations.weekCount}</dd>
        </div>
        <div>
          <dt className="text-slate-500 text-xs">Просрочено NEW</dt>
          <dd className={`mt-1 font-bold text-xl tabular-nums ${attention ? "text-rose-600" : "text-emerald-600"}`}>
            {operations.overdueCount}
          </dd>
        </div>
      </dl>
      {operations.oldestOverdue.length > 0 ? (
        <ul className="mt-4 space-y-1 border-t pt-3 text-xs">
          {operations.oldestOverdue.map((order) => (
            <li key={order.id} className="flex justify-between gap-3">
              <span className="font-semibold">#{order.id.slice(0, 8)}</span>
              <span className="text-slate-500 tabular-nums">{order.ageMinutes} мин без действия</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border-t pt-3 text-emerald-700 text-xs">Просроченных новых заявок нет.</p>
      )}
    </section>
  );
}
