import { beforeEach, expect, test, vi } from "vitest";

import { moderateReviewAction } from "../../src/app/(crm)/reviews/actions";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), moderate: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/server/crm-auth", () => ({ requireCrmAccess: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("../../server/reviews/review-service", () => ({ moderateReview: mocks.moderate }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(undefined);
  mocks.moderate.mockResolvedValue(true);
});
const form = () => {
  const value = new FormData();
  value.set("id", "11111111-1111-4111-8111-111111111111");
  value.set("version", "0");
  value.set("status", "APPROVED");
  return value;
};

test("direct action calls cannot bypass administrator authentication", async () => {
  mocks.auth.mockRejectedValueOnce(new Error("unauthorized"));
  await expect(moderateReviewAction({ message: "" }, form())).rejects.toThrow("unauthorized");
  expect(mocks.moderate).not.toHaveBeenCalled();
});
test("validates decisions and reports stale versions without a success message", async () => {
  const invalid = form();
  invalid.set("status", "PENDING");
  expect((await moderateReviewAction({ message: "" }, invalid)).message).toContain("Некорректное");
  expect(mocks.moderate).not.toHaveBeenCalled();
  mocks.moderate.mockResolvedValueOnce(false);
  expect((await moderateReviewAction({ message: "" }, form())).message).toContain("уже изменён");
});
