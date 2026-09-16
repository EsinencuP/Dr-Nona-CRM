import { beforeEach, describe, expect, test, vi } from "vitest";

const { findOrders, findClients } = vi.hoisted(() => ({ findOrders: vi.fn(), findClients: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({
  prisma: { order: { findMany: findOrders }, client: { findMany: findClients } },
}));

import { getReportData } from "../../server/exports/report-data";
import { parseExportRequest } from "../../server/exports/request";

const now = new Date("2026-09-16T12:00:00.000Z");

beforeEach(() => {
  findOrders.mockReset();
  findClients.mockReset();
});

describe("CRM Excel report data", () => {
  test("orders preserve missing historical retail price as a blank cell", async () => {
    findOrders.mockResolvedValue([
      {
        id: "real-1",
        createdAt: now,
        type: "order",
        status: "DONE",
        submittedFirstName: "Anna",
        submittedLastName: "R",
        submittedPhone: "=SUM(1,1)",
        submittedEmail: null,
        submittedRegion: "Chișinău",
        utmSource: null,
        items: [
          { productSlug: "solaris-body-lotion", quantity: 2, retailPriceAtPurchase: 0, distributorPriceAtPurchase: 50 },
        ],
      },
    ]);
    const input = parseExportRequest(
      {
        report: "orders",
        columns: ["phone", "retailTotal", "distributorTotal", "margin"],
        from: null,
        to: null,
        includeDemo: false,
      },
      now,
    );
    const report = await getReportData(input);
    expect(report.rows).toEqual([["=SUM(1,1)", null, 100, null]]);
    expect(findOrders.mock.calls[0][0].where.id).toEqual({ not: { startsWith: "demo-" } });
  });

  test("product demand counts each order once even when it has repeated lines", async () => {
    findOrders.mockResolvedValue([
      {
        id: "real-1",
        type: "order",
        status: "DONE",
        submittedRegion: "Chișinău",
        items: [
          {
            productSlug: "solaris-body-lotion",
            quantity: 2,
            retailPriceAtPurchase: 100,
            distributorPriceAtPurchase: 50,
          },
          {
            productSlug: "solaris-body-lotion",
            quantity: 1,
            retailPriceAtPurchase: 100,
            distributorPriceAtPurchase: 50,
          },
        ],
      },
    ]);
    const input = parseExportRequest(
      {
        report: "products",
        columns: ["orderCount", "units", "retailTotal", "margin"],
        from: null,
        to: null,
        includeDemo: false,
      },
      now,
    );
    const report = await getReportData(input);
    expect(report.rows).toEqual([[1, 3, 300, 150]]);
  });

  test("refuses a partially truncated report", async () => {
    findOrders.mockResolvedValue(
      Array.from({ length: 10_001 }, () => ({
        id: "x",
        submittedRegion: "A",
        type: "order",
        status: "NEW",
        items: [],
      })),
    );
    const input = parseExportRequest(
      { report: "regions", columns: ["region", "orders"], from: null, to: null, includeDemo: true },
      now,
    );
    await expect(getReportData(input)).rejects.toThrow("10000 rows");
  });
});
