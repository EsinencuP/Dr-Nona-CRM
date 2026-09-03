import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="font-extrabold text-primary text-xs uppercase tracking-[0.14em]">Ошибка 404</p>
        <h1 className="mt-2 font-editorial font-semibold text-4xl">Раздел не найден</h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">В CRM доступны только рабочие разделы команды.</p>
        <Button className="mt-6" render={<Link href="/dashboard" />}>
          Вернуться к дашборду
        </Button>
      </section>
    </main>
  );
}
