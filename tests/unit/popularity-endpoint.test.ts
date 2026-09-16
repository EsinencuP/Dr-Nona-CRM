import { beforeEach, describe, expect, test, vi } from "vitest";

const { getCandidate } = vi.hoisted(() => ({ getCandidate: vi.fn() }));
vi.mock("../../server/popularity/service", () => ({ getPopularityCandidate: getCandidate }));

import { GET } from "../../src/app/api/internal/popularity-candidate/route";

const url = "https://crm.example/api/internal/popularity-candidate";
const token = "a".repeat(48);

beforeEach(() => {
  getCandidate.mockReset().mockResolvedValue({ version: 1, status: "insufficient", counts: [] });
  vi.stubEnv("POPULARITY_EXPORT_TOKEN", token);
});

describe("aggregate-only popularity endpoint", () => {
  test("fails closed without configuration or a matching bearer token", async () => {
    vi.stubEnv("POPULARITY_EXPORT_TOKEN", "");
    expect((await GET(new Request(url))).status).toBe(503);
    vi.stubEnv("POPULARITY_EXPORT_TOKEN", token);
    expect((await GET(new Request(url))).status).toBe(401);
    expect((await GET(new Request(url, { headers: { Authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(getCandidate).not.toHaveBeenCalled();
  });

  test("serves only the candidate with no-store to the dedicated token", async () => {
    const response = await GET(new Request(url, { headers: { Authorization: `Bearer ${token}` } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({ version: 1, status: "insufficient", counts: [] });
    expect(getCandidate).toHaveBeenCalledOnce();
  });
});
