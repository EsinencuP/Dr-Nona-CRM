import { describe, expect, test } from "vitest";

import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/seed-demo-reviews.mjs", import.meta.url));

describe("demo reviews seed", () => {
  test("plans four public and six pending clearly labelled examples with published products", () => {
    const plan = JSON.parse(execFileSync(process.execPath, [script, "--dry-run", "--json"], { encoding: "utf8" }));
    expect(plan).toMatchObject({ total: 10, approved: 4, pending: 6 });
    expect(plan.fixtures).toHaveLength(10);
    expect(new Set(plan.fixtures.map((row: { idempotencyKey: string }) => row.idempotencyKey)).size).toBe(10);
    for (const row of plan.fixtures) {
      expect(row.authorName).toMatch(/ТЕСТ|TEST/u);
      expect(row.body).toMatch(/не отзыв реального клиента|nu este recenzia unui client real/u);
    }
    expect(plan.fixtures.some((row: { productSlug: string | null }) => row.productSlug === null)).toBe(true);
  });
  test("refuses remote databases, unrelated local databases and production", () => {
    for (const [url, environment] of [
      ["postgresql://test:test@remote.example/drnona_reviews", "development"],
      ["postgresql://test:test@127.0.0.1/customer_data", "development"],
      ["postgresql://test:test@127.0.0.1/drnona_reviews", "production"],
    ] as const) {
      const run = spawnSync(process.execPath, [script], {
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: url, NODE_ENV: environment },
      });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain("Demo reviews require a loopback DATABASE_URL");
    }
  });
});
