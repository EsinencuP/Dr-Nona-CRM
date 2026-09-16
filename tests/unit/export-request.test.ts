import { describe, expect, test } from "vitest";

import { parseExportRequest } from "../../server/exports/request";

const base = {
  report: "orders",
  columns: ["id", "phone", "retailTotal"],
  from: null,
  to: null,
  includeDemo: false,
};

describe("Excel report request", () => {
  test("accepts selected approved columns and open period", () => {
    const result = parseExportRequest(base, new Date("2026-09-16T12:00:00Z"));
    expect(result.columns).toEqual(["id", "phone", "retailTotal"]);
    expect(result.fromDate).toBeNull();
    expect(result.toDate).toBeNull();
  });

  test("uses inclusive Moldova local days across spring DST", () => {
    const result = parseExportRequest(
      { ...base, from: "2026-03-29", to: "2026-03-29" },
      new Date("2026-09-16T12:00:00Z"),
    );
    expect(result.fromDate?.toISOString()).toBe("2026-03-28T22:00:00.000Z");
    expect(result.toDate?.toISOString()).toBe("2026-03-29T21:00:00.000Z");
  });

  test("rejects unapproved fields, duplicate columns, invalid dates and oversized periods", () => {
    expect(() => parseExportRequest({ ...base, columns: ["phone", "comment"] })).toThrow("Unapproved");
    expect(() => parseExportRequest({ ...base, columns: ["phone", "phone"] })).toThrow("Unapproved");
    expect(() => parseExportRequest({ ...base, from: "2026-02-30" })).toThrow();
    expect(() => parseExportRequest({ ...base, from: "2025-01-01", to: "2026-09-16" })).toThrow("one year");
  });
});
