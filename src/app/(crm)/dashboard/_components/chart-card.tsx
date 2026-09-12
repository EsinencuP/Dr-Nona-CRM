import type { ReactNode } from "react";
export function ChartCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-base text-slate-800">{title}</h2>
          {description && <p className="mt-1 text-slate-500 text-xs leading-5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function EmptyChart() {
  return (
    <p className="flex h-[220px] items-center justify-center px-4 text-center text-slate-500 text-sm">
      Нет данных за выбранный период
    </p>
  );
}
