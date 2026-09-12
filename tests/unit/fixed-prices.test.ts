import { describe, expect, test } from "vitest";

import { fixedPriceSchema } from "../../server/catalog/fixed-prices";

describe("approved catalogue price input", () => {
  test.each([null, undefined, "", " ", "0", "-1", "1.001", "1e3", "Infinity", "NaN", "1000000.01"])(
    "rejects unavailable, malformed or out-of-range price %s",
    (value) => {
      expect(fixedPriceSchema.safeParse(value).success).toBe(false);
    },
  );
  test.each([
    ["0.01", 0.01],
    ["125.50", 125.5],
    [" 200 ", 200],
    ["1000000", 1_000_000],
  ])("accepts a fixed MDL price %s", (value, expected) => {
    expect(fixedPriceSchema.parse(value)).toBe(expected);
  });
});
