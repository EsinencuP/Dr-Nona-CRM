"use client";

import { useState } from "react";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DEFAULT_REPORT_COLUMNS, REPORT_COLUMNS, REPORT_LABELS, type ReportType } from "@/lib/export-spec";

export function ExportDialog({ initialReport = "orders" }: { initialReport?: ReportType }) {
  const [report, setReport] = useState<ReportType>(initialReport);
  const [columns, setColumns] = useState<string[]>([...DEFAULT_REPORT_COLUMNS[initialReport]]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [includeDemo, setIncludeDemo] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  function chooseReport(value: ReportType) {
    setReport(value);
    setColumns([...DEFAULT_REPORT_COLUMNS[value]]);
    setMessage("");
  }

  function toggleColumn(column: string) {
    setColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    );
  }

  async function download(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || columns.length === 0) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, columns, from: from || null, to: to || null, includeDemo }),
      });
      if (!response.ok) {
        setMessage(
          response.status === 413
            ? "Слишком много строк. Сузьте период и повторите попытку."
            : "Не удалось создать отчёт. Проверьте период и повторите попытку.",
        );
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename="([a-zA-Z0-9._-]+)"/u)?.[1] ??
        `dr-nona-${report}.xlsx`;
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      setMessage(`Файл ${filename} создан. В нём только выбранные столбцы.`);
    } catch {
      setMessage("Соединение прервалось. Повторите попытку.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" className="gap-2" />}>
        <Download className="size-4" aria-hidden="true" /> Выгрузить Excel
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Выгрузка отчёта в Excel</DialogTitle>
          <DialogDescription>
            Выберите отчёт, период и столбцы. Файл создаётся для скачивания и не хранится на сервере.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={download} className="space-y-4">
          <label className="grid gap-1.5 font-semibold" htmlFor="export-report">
            Тип отчёта
            <select
              id="export-report"
              value={report}
              onChange={(event) => chooseReport(event.target.value as ReportType)}
              className="min-h-10 rounded-md border bg-white px-3 font-normal"
            >
              {(Object.keys(REPORT_LABELS) as ReportType[]).map((key) => (
                <option key={key} value={key}>
                  {REPORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 font-semibold" htmlFor="export-from">
              С даты
              <Input id="export-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label className="grid gap-1.5 font-semibold" htmlFor="export-to">
              По дату включительно
              <Input
                id="export-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </div>
          <p className="text-muted-foreground text-xs">
            Пустые даты охватывают всю историю; максимум 10 000 строк в файле.
          </p>
          <fieldset className="rounded-xl border p-3">
            <legend className="px-1 font-semibold">Столбцы отчёта</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(REPORT_COLUMNS[report]).map(([key, label]) => (
                <label key={key} className="flex min-h-8 items-start gap-2 text-sm leading-5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={columns.includes(key)}
                    onChange={() => toggleColumn(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-2 text-sm leading-5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={includeDemo}
              onChange={(event) => setIncludeDemo(event.target.checked)}
            />
            Включить демонстрационные записи — они будут помечены в отчёте
          </label>
          <p className="text-muted-foreground text-xs">
            Пустые денежные ячейки означают, что историческая цена не подтверждена.
          </p>
          {message && (
            <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
              {message}
            </p>
          )}
          <DialogFooter className="-mx-4 -mb-4">
            <Button type="submit" disabled={pending || columns.length === 0}>
              {pending ? "Создаём файл…" : "Скачать .xlsx"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
