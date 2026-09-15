import { describe, expect, test } from "vitest";
import {
  chisinauLocalMinute,
  getAppointmentBounds,
  validateAppointmentWindow,
} from "../../shared/applications/appointment-policy";

describe("appointment policy", () => {
  const now = new Date("2030-01-15T10:30:00.000Z");

  test("allows exact consultation boundaries and rejects values outside 90 days", () => {
    const bounds = getAppointmentBounds("consultation", now);
    const [minimumDate, minimumTime] = bounds.minimumMinute.split("T");
    const [maximumDate, maximumTime] = bounds.maximumMinute.split("T");
    expect(validateAppointmentWindow("consultation", minimumDate, minimumTime, now)).toBeNull();
    expect(validateAppointmentWindow("consultation", maximumDate, maximumTime, now)).toBeNull();
    expect(validateAppointmentWindow("consultation", minimumDate, "00:00", now)).toBe("before_minimum");
    expect(validateAppointmentWindow("consultation", "2030-04-16", "23:59", now)).toBe("after_maximum");
  });

  test("requires masterclasses from the next day through day 180", () => {
    const bounds = getAppointmentBounds("masterclass", now);
    const [minimumDate, minimumTime] = bounds.minimumMinute.split("T");
    const [maximumDate, maximumTime] = bounds.maximumMinute.split("T");
    expect(validateAppointmentWindow("masterclass", minimumDate, minimumTime, now)).toBeNull();
    expect(validateAppointmentWindow("masterclass", maximumDate, maximumTime, now)).toBeNull();
    expect(validateAppointmentWindow("masterclass", "2030-01-15", "23:59", now)).toBe("before_minimum");
    expect(validateAppointmentWindow("masterclass", "2030-07-15", "00:00", now)).toBe("after_maximum");
  });

  test("uses Europe/Chisinau DST rather than a fixed UTC offset", () => {
    expect(chisinauLocalMinute(new Date("2026-03-29T00:30:00.000Z"))).toBe("2026-03-29T02:30");
    expect(chisinauLocalMinute(new Date("2026-03-29T01:30:00.000Z"))).toBe("2026-03-29T04:30");
    expect(chisinauLocalMinute(new Date("2026-10-25T00:30:00.000Z"))).toBe("2026-10-25T03:30");
    expect(chisinauLocalMinute(new Date("2026-10-25T01:30:00.000Z"))).toBe("2026-10-25T03:30");
  });

  test.each([
    ["2030-02-31", "10:00"],
    ["2030-02-01", "24:00"],
  ])("rejects invalid calendar input %s %s", (date, time) => {
    expect(validateAppointmentWindow("consultation", date, time, now)).toBe("invalid");
  });
});
