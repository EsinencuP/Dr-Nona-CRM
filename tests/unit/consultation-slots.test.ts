import { describe, expect, test } from "vitest";

import { chisinauLocalMinute, chisinauMinuteToDate } from "../../server/consultations/consultation-slots";

describe("consultation slot timezone conversion", () => {
  test("round-trips an unambiguous Chisinau minute across DST", () => {
    const value = "2030-06-20T14:30";
    const date = chisinauMinuteToDate(value);
    if (!date) throw new Error("Expected an unambiguous Chisinau minute");
    expect(chisinauLocalMinute(date)).toBe(value);
  });

  test("rejects invalid and DST-ambiguous local minutes", () => {
    expect(chisinauMinuteToDate("not-a-date")).toBeNull();
    expect(chisinauMinuteToDate("2026-10-25T03:30")).toBeNull();
  });
});
