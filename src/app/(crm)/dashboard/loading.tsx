export default function DashboardLoading() {
  return (
    <section aria-label="Загрузка дашборда" role="status" className="space-y-5">
      <p className="text-slate-500">Загружаем операционную сводку…</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div
            key={key}
            aria-hidden="true"
            className="h-48 rounded-xl border border-slate-200 bg-white motion-safe:animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
