import { z } from "zod";

import { REPORT_COLUMNS, type ReportType } from "../../src/lib/export-spec";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const schema = z
  .object({
    report: z.enum(["orders", "clients", "products", "regions"]),
    columns: z.array(z.string()).min(1).max(20),
    from: dateSchema.nullable(),
    to: dateSchema.nullable(),
    includeDemo: z.boolean(),
  })
  .strict();

export type ExportRequest = z.infer<typeof schema>;

function localMidnight(dateText: string) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== dateText) throw new Error("Invalid report date");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Chisinau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let instant = date.getTime();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const localAsUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    instant += date.getTime() - localAsUtc;
  }
  return new Date(instant);
}

export function parseExportRequest(value: unknown, now = new Date()) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("Invalid export request");
  const input = parsed.data;
  const allowed = REPORT_COLUMNS[input.report as ReportType];
  if (
    new Set(input.columns).size !== input.columns.length ||
    input.columns.some((column) => !Object.hasOwn(allowed, column))
  ) {
    throw new Error("Unapproved export columns");
  }
  const from = input.from ? localMidnight(input.from) : null;
  const to = input.to ? localMidnight(new Date(`${input.to}T00:00:00.000Z`).toISOString().slice(0, 10)) : null;
  const toExclusive = input.to
    ? localMidnight(new Date(Date.parse(`${input.to}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10))
    : null;
  if (from && to && from > to) throw new Error("Report start is after end");
  if (from && toExclusive && toExclusive.getTime() - from.getTime() > 366 * 86_400_000) {
    throw new Error("Report period exceeds one year");
  }
  if (from && from > now) throw new Error("Report begins in the future");
  return { ...input, fromDate: from, toDate: toExclusive };
}
