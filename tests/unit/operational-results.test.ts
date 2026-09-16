import { describe, expect, test } from "vitest";

import { calculateOperationalResults, type OperationalOrder } from "../../server/analytics/operational-results";

const now = new Date("2026-09-16T12:00:00Z");
const day = 86_400_000;

function order(ageDays: number, overrides: Partial<OperationalOrder> = {}): OperationalOrder {
  const createdAt = new Date(now.getTime() - ageDays * day);
  return {
    createdAt,
    status: "NEW",
    firstActionAt: null,
    submittedRegion: "Кишинёв",
    ...overrides,
  };
}

describe("operational results", () => {
  test("uses created cohorts, includes open applications in the denominator, and handles empty periods", () => {
    const data = calculateOperationalResults(
      [
        order(2, { status: "DONE" }),
        order(3, { status: "PROCESSING" }),
        order(35, { status: "DONE" }),
        order(61, { status: "DONE" }),
        order(0, { status: "DONE" }),
      ],
      "1m",
      now,
    );
    expect(data.current).toMatchObject({ applications: 2, completed: 1, completionRate: 50 });
    expect(data.previous).toMatchObject({ applications: 1, completed: 1, completionRate: 100 });
    expect(calculateOperationalResults([], "1m", now).current.completionRate).toBeNull();
  });

  test("measures first action only from validated timestamps and leaves historical unknowns unknown", () => {
    const measured = order(2);
    measured.firstActionAt = new Date(measured.createdAt.getTime() + 90 * 60_000);
    const invalid = order(3);
    invalid.firstActionAt = new Date(invalid.createdAt.getTime() - 1000);
    const data = calculateOperationalResults([measured, invalid, order(4)], "1m", now);
    expect(data.current).toMatchObject({
      measuredFirstActions: 1,
      missingFirstActions: 2,
      averageFirstActionMinutes: 90,
    });
    expect(data.previous.averageFirstActionMinutes).toBeNull();
  });

  test("assigns weekday in Europe/Chisinau across DST and uses immutable submitted region", () => {
    const spring = new Date("2026-03-29T21:30:00Z"); // Monday 00:30 in Chisinau after DST begins.
    const data = calculateOperationalResults(
      [
        { createdAt: spring, status: "DONE", firstActionAt: null, submittedRegion: "Кишинёв" },
        {
          createdAt: new Date("2026-03-29T20:30:00Z"),
          status: "CANCELLED",
          firstActionAt: null,
          submittedRegion: "Unknown",
        },
      ],
      "1m",
      new Date("2026-03-31T00:00:00Z"),
    );
    expect(data.weekdays.find((day) => day.day === "Mon")).toMatchObject({ applications: 1, completed: 1 });
    expect(data.weekdays.find((day) => day.day === "Sun")).toMatchObject({ applications: 1, completed: 0 });
    expect(data.regions.find((region) => region.name === "Кишинёв")?.completionRate).toBe(100);
    expect(data.regions.find((region) => region.name === "Регион не распознан")?.completionRate).toBe(0);
  });
});
