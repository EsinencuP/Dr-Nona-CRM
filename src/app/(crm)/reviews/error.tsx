"use client";

import { Button } from "@/components/ui/button";

export default function ReviewsError({ reset }: { reset: () => void }) {
  return (
    <section role="alert" className="rounded-xl border bg-white p-6">
      <h1 className="font-bold text-2xl">Отзывы временно недоступны</h1>
      <p className="my-4">
        Не удалось загрузить отзывы. Повторите попытку или проверьте подключение CRM к базе данных.
      </p>
      <Button type="button" onClick={reset}>
        Повторить
      </Button>
    </section>
  );
}
