"use client";
import { Button } from "@/components/ui/button";
export default function DashboardError({ retry }: { retry: () => void }) {
  return (
    <section aria-label="Ошибка загрузки дашборда" className="rounded-xl border border-slate-200 bg-white p-5">
      <h1 className="font-semibold text-slate-800 text-xl">Сводка временно недоступна</h1>
      <p className="my-3 text-slate-500 text-sm">Не удалось получить данные. Повторите попытку.</p>
      <Button onClick={retry}>Повторить</Button>
    </section>
  );
}
