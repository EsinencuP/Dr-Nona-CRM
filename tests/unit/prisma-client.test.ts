import { describe, expect, test } from "vitest";

import { assertPooledRuntimeDatabaseUrl } from "../../src/lib/prisma";

describe("Prisma runtime ownership", () => {
  test("accepts a pooled Neon runtime URL with a direct migration URL", () => {
    expect(() =>
      assertPooledRuntimeDatabaseUrl({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/db?sslmode=require",
        DATABASE_URL_UNPOOLED: "postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/db?sslmode=require",
      }),
    ).not.toThrow();
  });

  test.each([
    {
      DATABASE_URL: "postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/db?sslmode=require",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/db?sslmode=require",
    },
    {
      DATABASE_URL: "postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/db?sslmode=require",
      DATABASE_URL_UNPOOLED: "postgresql://other:pass@ep-other.eu-central-1.aws.neon.tech/db?sslmode=require",
    },
  ])("rejects an unpooled production Neon runtime", (urls) => {
    expect(() => assertPooledRuntimeDatabaseUrl({ NODE_ENV: "production", ...urls })).toThrow(/pool/u);
  });

  test("permits a local PostgreSQL URL used by migration integration tests", () => {
    expect(() =>
      assertPooledRuntimeDatabaseUrl({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/test",
        DATABASE_URL_UNPOOLED: "postgresql://postgres:postgres@127.0.0.1:5432/test",
      }),
    ).not.toThrow();
  });
});
