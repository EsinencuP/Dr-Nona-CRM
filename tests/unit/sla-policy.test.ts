import { describe, expect, test } from "vitest";

import { chisinauMidnightUtc, getSlaWindows, slaAgeMinutes } from "../../server/operations/sla-policy";

describe("CRM SLA policy", () => {
  test("uses the Chisinau offset before the spring DST switch", () => {
    expect(chisinauMidnightUtc(new Date("2026-03-29T10:00:00.000Z")).toISOString()).toBe("2026-03-28T22:00:00.000Z");
  });

  test("uses the Chisinau offset before the autumn DST switch", () => {
    expect(chisinauMidnightUtc(new Date("2026-10-25T10:00:00.000Z")).toISOString()).toBe("2026-10-24T21:00:00.000Z");
  });

  test("starts the operational week on local Monday and ages against current time", () => {
    const now = new Date("2026-09-16T07:30:00.000Z");
    const windows = getSlaWindows(now);
    expect(windows.todayStart.toISOString()).toBe("2026-09-15T21:00:00.000Z");
    expect(windows.weekStart.toISOString()).toBe("2026-09-13T21:00:00.000Z");
    expect(windows.overdueBefore.toISOString()).toBe("2026-09-16T06:30:00.000Z");
    expect(slaAgeMinutes(new Date("2026-09-16T05:59:30.000Z"), now)).toBe(90);
  });
});
