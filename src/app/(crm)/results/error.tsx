"use client";

import { Button } from "@/components/ui/button";

export default function ResultsError({ retry }: { retry: () => void }) {
  return (
    <section role="alert" className="rounded-xl border bg-white p-6">
      <h1 className="font-bold text-xl">Результаты временно недоступны</h1>
      <p className="my-3 text-muted-foreground">
        Не удалось получить данные. Повторите попытку; если ошибка сохраняется, обратитесь к администратору.
      </p>
      <Button onClick={retry}>Повторить</Button>
    </section>
  );
}
