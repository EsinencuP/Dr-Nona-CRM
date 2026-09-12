export default function ResultsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="font-semibold">Загружаем результаты продаж…</p>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-40 rounded-xl border bg-white motion-safe:animate-pulse" />
        ))}
      </div>
    </div>
  );
}
