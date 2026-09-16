import { beforeEach, describe, expect, test, vi } from "vitest";

const { createAudit, getReportData } = vi.hoisted(() => ({ createAudit: vi.fn(), getReportData: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: { reportExportAudit: { create: createAudit } } }));
vi.mock("../../server/exports/report-data", () => ({ getReportData }));

import { POST } from "../../src/app/api/exports/route";

const target = "https://crm.example/api/exports";
const selected = { report: "orders", columns: ["id", "phone"], from: null, to: null, includeDemo: false };

function request(body: unknown, options: { authorized?: boolean; origin?: string } = {}) {
  const headers = new Headers({ "Content-Type": "application/json", Origin: options.origin ?? "https://crm.example" });
  if (options.authorized !== false)
    headers.set("Authorization", `Basic ${Buffer.from("manager:secret").toString("base64")}`);
  return new Request(target, { method: "POST", headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.stubEnv("CRM_BASIC_USER", "manager");
  vi.stubEnv("CRM_BASIC_PASSWORD", "secret");
  createAudit.mockReset().mockResolvedValue({});
  getReportData
    .mockReset()
    .mockResolvedValue({ sheetName: "Заказы", headers: ["ID", "Телефон"], rows: [["1", "123"]], rowCount: 1 });
});

describe("private Excel export route", () => {
  test("rejects unauthenticated and cross-origin requests before reading data", async () => {
    expect((await POST(request(selected, { authorized: false }))).status).toBe(401);
    expect((await POST(request(selected, { origin: "https://other.example" }))).status).toBe(403);
    expect(getReportData).not.toHaveBeenCalled();
  });

  test("downloads an XLSX with only approved selected columns and an audit row", async () => {
    const response = await POST(request(selected));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("spreadsheetml.sheet");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(
      Buffer.from(await response.arrayBuffer())
        .subarray(0, 4)
        .toString("hex"),
    ).toBe("504b0304");
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ report: "orders", columns: ["id", "phone"], outcome: "CREATED", rowCount: 1 }),
      }),
    );
  });

  test("rejects arbitrary columns and records the failure", async () => {
    const response = await POST(request({ ...selected, columns: ["comment"] }));
    expect(response.status).toBe(400);
    expect(getReportData).not.toHaveBeenCalled();
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: "FAILED", errorCode: "INVALID_REQUEST" }) }),
    );
  });

  test("fails closed when the audit store cannot record a generated file", async () => {
    createAudit.mockRejectedValue(new Error("audit unavailable"));
    const response = await POST(request(selected));
    expect(response.status).toBe(503);
  });
});
