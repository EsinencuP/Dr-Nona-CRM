import { describe, expect, test } from "vitest";

import {
  buildResultsPeriodHref,
  buildResultsViewHref,
  parseResultsView,
} from "../../src/app/(crm)/results/results-view";

describe("results view URL contract", () => {
  test.each<[string | string[] | undefined, string]>([
    [undefined, "sales"],
    ["sales", "sales"],
    ["forecast", "forecast"],
    ["promotion", "promotion"],
    ["invalid", "sales"],
    [["forecast"], "sales"],
  ])("parses %j as %s", (value, expected) => {
    expect(parseResultsView(value)).toBe(expected);
  });

  test("changes only view and preserves the selected reporting period", () => {
    expect(buildResultsViewHref("forecast", "period=6m&view=sales")).toBe("/results?period=6m&view=forecast");
    expect(buildResultsViewHref("promotion", "period=1y")).toBe("/results?period=1y&view=promotion");
  });

  test("changes only period and preserves the selected view", () => {
    expect(buildResultsPeriodHref("1y", "period=1m&view=promotion")).toBe("/results?period=1y&view=promotion");
  });
});
