import { describe, expect, test } from "vitest";

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const seedScript = fileURLToPath(new URL("../../scripts/seed-demo-analytics.mjs", import.meta.url));

describe("demo analytics seed plan", () => {
  test("covers every product, all order statuses and multiple reporting periods", () => {
    const output = execFileSync(process.execPath, [seedScript, "--dry-run", "--json"], {
      encoding: "utf8",
    });
    const plan = JSON.parse(output);

    expect(plan).toMatchObject({
      mode: "dry-run",
      clients: 6,
      orders: 15,
      productPrices: 50,
      minOrdersPerClient: 2,
      statuses: {
        CANCELLED: 2,
        DELIVERY: 1,
        DONE: 10,
        NEW: 1,
        PROCESSING: 1,
      },
    });
    expect(plan.orderItems).toBeGreaterThan(15);
    expect(plan.orderAgesDays.some((days: number) => days <= 7)).toBe(true);
    expect(plan.orderAgesDays.some((days: number) => days > 30 && days <= 90)).toBe(true);
    expect(plan.orderAgesDays.some((days: number) => days > 90)).toBe(true);
    expect(plan.retailPriceRange[0]).toBeGreaterThan(plan.distributorPriceRange[0]);
    expect(plan.retailPriceRange[1]).toBeGreaterThan(plan.distributorPriceRange[1]);
  });
});
