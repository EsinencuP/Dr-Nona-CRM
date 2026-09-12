import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  orders: vi.fn(),
  statuses: vi.fn(),
  clients: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/server/crm-auth", () => ({ requireCrmAccess: mocks.access }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findMany: mocks.orders, groupBy: mocks.statuses },
    client: { count: mocks.clients },
    $transaction: mocks.transaction,
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getDashboardStats } from "../../src/app/(crm)/actions";

describe("dashboard server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue(undefined);
    mocks.transaction.mockResolvedValue([[], [], 0, 0, []]);
  });
  test("auth guard precedes reads and failed access returns no financial data", async () => {
    mocks.access.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(getDashboardStats("30d")).rejects.toThrow("Unauthorized");
    expect(mocks.orders).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  test("90 day query includes comparison window and selects minimal recent feed fields", async () => {
    const data = await getDashboardStats("90d");
    expect(data.range).toBe("90d");
    expect(mocks.access).toHaveBeenCalledOnce();
    const query = mocks.orders.mock.calls[0][0];
    expect(query.where.createdAt.lt.getTime() - query.where.createdAt.gte.getTime()).toBe(180 * 86400000);
    expect(query.select.client).toEqual({ select: { region: true } });
    const recent = mocks.orders.mock.calls[1][0];
    expect(recent.take).toBe(8);
    expect(recent.select.client).toEqual({ select: { firstName: true, lastName: true } });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Array), { isolationLevel: "RepeatableRead" });
  });
  test("database failure is propagated, not fabricated empty data", async () => {
    mocks.transaction.mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(getDashboardStats("7d")).rejects.toThrow("DB unavailable");
  });
});
